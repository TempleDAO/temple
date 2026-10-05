// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.20;
// (contracts/wishingwell/WishingWell.sol)

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IWishingWell } from "contracts/interfaces/wishingwell/IWishingWell.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";


/// @notice Read-only compliance adapter. Reverts deliberately fail screening closed (FPA-31).
interface IComplianceCheck {
    /// @dev FPA-31.
    /// @param account Account to check.
    function isBlocked(address account) external view returns (bool);
}

/// @notice Auction construction only; later delisting does not affect existing auctions (FPA-1).
interface IAuctionTokenRegistry {
    /// @dev FPA-1, FPA-6.
    /// @param token Token address.
    function isSupported(address token) external view returns (bool);
}

/**
 * @title WishingWell
 * @notice Persistent, multi-token demand signals independent of auctions.
 * Balance-backed signals without custody, reserved tokens or auction calls.
 * Registry administrators must approve tokens with reliable ERC-20 balances.
 * Sell amounts use target-token base units. Buy amounts use the selected payment asset.
 * One record per account/targetToken, shared across directions and payment assets.
 */
contract WishingWell is IWishingWell, EIP712, TempleElevatedAccess {
    /// @inheritdoc IWishingWell
    uint64 public constant override MAX_WISH_DURATION = 365 days;

    /// @notice Maxumum number of accounts list for totalForAccounts()
    uint256 public constant override MAX_ACCOUNTS = 100;

    uint64 public constant override DEFAULT_QUORUM_DURATION = 3 days;
    uint64 public constant override MIN_QUORUM_DURATION = 1 hours;
    uint64 public constant override MAX_QUORUM_DURATION = 30 days;

    /// @notice Wishing Well type hash
    bytes32 public constant WISH_TYPEHASH = keccak256(
        "Wish(address account,address targetToken,address amountAsset,uint8 direction,uint128 amount,uint64 expiresAt,uint256 nonce,uint64 submissionDeadline)"
    );

    /// @inheritdoc IWishingWell
    address public immutable override tokenRegistry;
    /// @inheritdoc IWishingWell
    address public override complianceCheck;
    /// @inheritdoc IWishingWell
    mapping(address => address) public override buyPaymentAsset;
    /// @inheritdoc IWishingWell
    mapping(address => mapping(Direction => uint256)) public override threshold;

    mapping(address => mapping(Direction => uint64)) private _quorumDuration;

    /// @inheritdoc IWishingWell
    mapping(address account => uint256) public override nonces;

    /// @notice Accounts excluded from making wishes
    mapping(address targetToken => mapping(address account => bool)) public excluded;

    mapping(address account => mapping(address targetToken => Wish)) private _wishes;

    /// @notice Keep track of stored amounts grouped by market and expiry day rounded up.
    mapping(bytes32 market => mapping(uint256 expiryDay => uint256)) private _expiryBuckets;
    /// @notice Keep track of an account's  wish bucket contribution. This also inclides expired wishes awaiting removal.
    mapping(address account => mapping(address targetToken => bool)) private _counted;

    constructor(
        address executor_,
        address rescuer_,
        address tokenRegistry_,
        address complianceCheck_,
        string memory name_,
        string memory version_
    ) EIP712(name_, version_) TempleElevatedAccess(rescuer_, executor_) {
        tokenRegistry = tokenRegistry_;
        _setComplianceCheck(complianceCheck_);
    }

     /// @inheritdoc IWishingWell
    function setWish(
        address targetToken,
        Direction direction,
        address amountAsset,
        uint128 amount,
        uint64 duration
    ) external override {
        uint256 expiry = block.timestamp + uint256(duration);
        if (duration == 0 ) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (duration > MAX_WISH_DURATION) { revert InvalidWish(); }
        _setWish(msg.sender, targetToken, direction, amountAsset, amount, uint64(expiry));
    }

    /// @inheritdoc IWishingWell
    function setWishBySignature(SignedWish calldata wish, bytes calldata signature) external override {
        if (wish.account == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (block.timestamp >= wish.submissionDeadline) { revert SignatureExpired(); }
        if (wish.submissionDeadline > wish.expiresAt) { revert InvalidWish(); }
        if (wish.nonce != nonces[wish.account]) { revert InvalidNonce(); }
        if (!SignatureChecker.isValidSignatureNow(wish.account, wishDigest(wish), signature)) {
            revert InvalidSignature();
        }
        _setWish(wish.account, wish.targetToken, wish.direction, wish.amountAsset, wish.amount, wish.expiresAt);
    }

    /// @inheritdoc IWishingWell
    function revokeWish(address targetToken) external override {
        if (targetToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        // Remove the old contribution
        _removeContribution(msg.sender, targetToken);
        delete _wishes[msg.sender][targetToken];
        // Invalidate pending signatures
        uint256 nonce = nonces[msg.sender]++;

        emit WishRevoked(msg.sender, targetToken, nonce);
    }

    /// @inheritdoc IWishingWell
    function getWish(address account, address targetToken) external view override returns (Wish memory) {
        return _wishes[account][targetToken];
    }

    /// @inheritdoc IWishingWell
    function activeAmount(
        address account,
        address targetToken,
        Direction direction,
        address amountAsset
    ) public view override returns (uint256) {
        Wish memory wish = _wishes[account][targetToken];
        if (
            excluded[targetToken][account] || wish.expiresAt <= block.timestamp || wish.direction != direction
                || wish.amountAsset != amountAsset
        ) { return 0; }

        if (!_marketEnabled(targetToken, direction, amountAsset) || _isBlocked(account)) { return 0; }

        uint256 balance = IERC20(amountAsset).balanceOf(account);
        return balance < wish.amount ? balance : wish.amount;
    }

    /// @inheritdoc IWishingWell
    function totalForAccounts(
        address targetToken,
        Direction direction,
        address amountAsset,
        address[] calldata accounts
    ) external view override returns (uint256 total) {
        if (accounts.length > MAX_ACCOUNTS) { revert InvalidAccountList(); }
        address previous;
        uint256 i = 0;
        for (i; i < accounts.length;) {
            if (accounts[i] <= previous) { revert InvalidAccountList(); }
            previous = accounts[i];
            total += activeAmount(accounts[i], targetToken, direction, amountAsset);
            ++i;
        }
        // At most 100 uint128 amounts: the uint256 sum cannot overflow.
    }

    /// @inheritdoc IWishingWell
    function wishDigest(SignedWish calldata wish) public view override returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    WISH_TYPEHASH,
                    wish.account,
                    wish.targetToken,
                    wish.amountAsset,
                    wish.direction,
                    wish.amount,
                    wish.expiresAt,
                    wish.nonce,
                    wish.submissionDeadline
                )
            )
        );
    }

    /// @inheritdoc IWishingWell
    function setExcluded(
        address targetToken,
        address account,
        bool excluded_
    ) external override onlyElevatedAccess {
        if (targetToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (account == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        // Excluding account changes totals without changing the wish or nonce.
        // Avoid double counting
        _removeContribution(account, targetToken);
        excluded[targetToken][account] = excluded_;
        _addContribution(account, targetToken);

        emit ExclusionSet(targetToken, account, excluded_);
    }

    /// @inheritdoc IWishingWell
    function setBuyPaymentAsset(address targetToken, address asset) external override onlyElevatedAccess {
        if (targetToken == address(0)) {
            revert CommonEventsAndErrors.InvalidAddress();
        }

        // Zero disables Buy wishes
        if (asset != address(0)) {
            if (asset == targetToken) { revert InvalidWish(); }

            _requireSupported(targetToken);
            _requireSupported(asset);
        }

        buyPaymentAsset[targetToken] = asset;

        emit BuyPaymentAssetSet(targetToken, asset);
    }

    /// @inheritdoc IWishingWell
    function setThreshold(address targetToken, Direction direction, uint256 amount) external override onlyElevatedAccess {
        if (targetToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        threshold[targetToken][direction] = amount;

        emit ThresholdSet(targetToken, direction, amount);
    }

    /// @inheritdoc IWishingWell
    function setMinQuorumDuration(address targetToken, Direction direction, uint64 duration) external override onlyElevatedAccess {
        if (targetToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (duration == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (duration < MIN_QUORUM_DURATION || duration > MAX_QUORUM_DURATION) { revert InvalidQuorumDuration(); }

        _quorumDuration[targetToken][direction] = duration;

        emit MinQuorumDurationSet(targetToken, direction, duration);
    }

     /// @inheritdoc IWishingWell
    function setComplianceCheck(address complianceCheck_) external override onlyElevatedAccess {
        _setComplianceCheck(complianceCheck_);
    }

    // @inheritdoc IWishingWell
    function minQuorumDuration(address targetToken, Direction direction) external view override returns (uint64) {
        uint64 duration = _quorumDuration[targetToken][direction];
        return duration == 0 ? DEFAULT_QUORUM_DURATION : duration;
    }

    function totalStated(
        address targetToken,
        Direction direction,
        address amountAsset
    ) external view override returns (uint256 total) {
        if (!_marketEnabled(targetToken, direction, amountAsset)) { return 0; }
        bytes32 market = _marketKey(targetToken, direction, amountAsset);
        uint256 currentDay = block.timestamp / 1 days;
        // Scan at most 366 buckets
        uint256 lastDay = currentDay + MAX_WISH_DURATION / 1 days + 1;
        uint256 day;
        for (day = currentDay + 1; day <= lastDay;) {
            total += _expiryBuckets[market][day];
            ++day;
        }
    }

    function name() external view returns (string memory) {
        return _EIP712Name();
    }

    function version() external view returns (string memory) {
        return _EIP712Version();
    }

    function _setComplianceCheck(address source) private {
        if (source == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }

        complianceCheck = source;
        
        emit ComplianceCheckSet(source);
    }

    function _isBlocked(address account) private view returns (bool) {
        return complianceCheck != address(0) && IComplianceCheck(complianceCheck).isBlocked(account);
    }

    function _requireSupported(address token) private view {
        if (!IAuctionTokenRegistry(tokenRegistry).isSupported(token)) { revert UnsupportedToken(token); }
    }

    function _marketEnabled(address targetToken, Direction direction, address amountAsset) private view returns (bool) {
        if (!IAuctionTokenRegistry(tokenRegistry).isSupported(targetToken)) { return false; }
        if (direction == Direction.Sell) { return amountAsset == targetToken; }

        return amountAsset != address(0) && amountAsset == buyPaymentAsset[targetToken]
            && IAuctionTokenRegistry(tokenRegistry).isSupported(amountAsset);
    }

    function _addContribution(address account, address targetToken) private {
        Wish memory wish = _wishes[account][targetToken];
        if (excluded[targetToken][account] || wish.amount == 0 || wish.expiresAt <= block.timestamp) { return; }

        bytes32 market = _marketKey(targetToken, wish.direction, wish.amountAsset);
        _expiryBuckets[market][_expiryDay(wish.expiresAt)] += wish.amount;
        _counted[account][targetToken] = true;
    }

    function _removeContribution(address account, address targetToken) private {
        if (!_counted[account][targetToken]) { return; }
        Wish memory wish = _wishes[account][targetToken];
        uint256 day = _expiryDay(wish.expiresAt);
        // Past buckets are already ignored
        if (day > block.timestamp / 1 days) {
            bytes32 market = _marketKey(targetToken, wish.direction, wish.amountAsset);
            _expiryBuckets[market][day] -= wish.amount;
        }
        delete _counted[account][targetToken];
    }

    function _expiryDay(uint64 expiresAt) private pure returns (uint256) {
        // Rounding up keeps the stored total an upper bound until the next day
        return (uint256(expiresAt) + 1 days - 1) / 1 days;
    }

    function _marketKey(address targetToken, Direction direction, address amountAsset) private pure returns (bytes32) {
        return keccak256(abi.encode(targetToken, direction, amountAsset));
    }

    function _setWish(
        address account,
        address targetToken,
        Direction direction,
        address amountAsset,
        uint128 amount,
        uint64 expiresAt
    ) private {
        if (targetToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (amountAsset == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (expiresAt <= block.timestamp) { revert InvalidWish(); }
        // Signed wishes have the same maximum remaining lifetime.
        if (uint256(expiresAt) - block.timestamp > MAX_WISH_DURATION) { revert InvalidWish(); }

        // Validate the target and the payment asset
        _requireSupported(targetToken);
        if (direction == Direction.Buy) { _requireSupported(amountAsset); }
        if (
            (direction == Direction.Sell && amountAsset != targetToken)
                || (direction == Direction.Buy
                    && (amountAsset == targetToken || amountAsset != buyPaymentAsset[targetToken]))
        ) { revert InvalidWish(); }

        if (_isBlocked(account)) { revert BlockedAccount(account); }
        if (amount > IERC20(amountAsset).balanceOf(account)) { revert InsufficientWishBalance(); }
        // Replacement removes the previous market's contribution first.
        _removeContribution(account, targetToken);
        uint256 nonce = nonces[account]++;
        _wishes[account][targetToken] = Wish(amountAsset, amount, expiresAt, direction);
        _addContribution(account, targetToken);

        emit WishSet(account, targetToken, amountAsset, direction, amount, expiresAt, nonce);
    }
}