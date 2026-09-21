// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.20;
// (contracts/wishingwell/WishingWell.sol)

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import { IWishingWell } from "contracts/interfaces/wishingwell/IWishingWell.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";


/**
 * @title WishingWell
 * @notice Persistent, multi-token demand signals independent of auctions.
 * @dev Constructor deployment, not a proxy implementation. No token calls, custody,
 * price commitment, auction creation, or balance backing. The amount is stated intent.
 * Sell amounts use target-token base units. Buy amounts use the selected payment asset.
 * One record per account/targetToken, shared across directions and payment assets.
 */
contract WishingWell is IWishingWell, EIP712, TempleElevatedAccess {

    /// @notice Maxumum number of accounts list for totalForAccounts()
    uint256 public constant MAX_ACCOUNTS = 100;

    /// @notice Wishing Well type hash
    bytes32 public constant WISH_TYPEHASH = keccak256(
        "Wish(address account,address targetToken,address amountAsset,uint8 direction,uint128 amount,uint64 expiresAt,uint256 nonce,uint64 submissionDeadline)"
    );

    /// @notice Nonces for account target amounts
    mapping(address account => mapping(address targetToken => uint256)) public nonces;

    /// @notice Accounts excluded from making wishes
    mapping(address targetToken => mapping(address account => bool)) public excluded;

    mapping(address account => mapping(address targetToken => Wish)) private _wishes;

    constructor(
        address executor_,
        address rescuer_,
        string memory name_,
        string memory version_
    ) EIP712(name_, version_) TempleElevatedAccess(rescuer_, executor_) {}

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
        _setWish(msg.sender, targetToken, direction, amountAsset, amount, uint64(expiry));
    }

    /// @inheritdoc IWishingWell
    function setWishBySignature(SignedWish calldata wish, bytes calldata signature) external override {
        if (wish.account == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (block.timestamp >= wish.submissionDeadline) { revert SignatureExpired(); }
        if (wish.submissionDeadline > wish.expiresAt) { revert InvalidWish(); }
        if (wish.nonce != nonces[wish.account][wish.targetToken]) { revert InvalidNonce(); }
        if (!SignatureChecker.isValidSignatureNow(wish.account, wishDigest(wish), signature)) {
            revert InvalidSignature();
        }
        _setWish(wish.account, wish.targetToken, wish.direction, wish.amountAsset, wish.amount, wish.expiresAt);
    }

    /// @inheritdoc IWishingWell
    function revokeWish(address targetToken) external override {
        if (targetToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        delete _wishes[msg.sender][targetToken];
        // Advance even if no wish exists, invalidating pending off-chain authorizations.
        uint256 nonce = nonces[msg.sender][targetToken]++;
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

        return wish.amount;
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
        for (uint256 i; i < accounts.length; ++i) {
            if (accounts[i] <= previous) { revert InvalidAccountList(); }
            previous = accounts[i];
            total += activeAmount(accounts[i], targetToken, direction, amountAsset);
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
        excluded[targetToken][account] = excluded_;
        emit ExclusionSet(targetToken, account, excluded_);
    }

    function name() external view returns (string memory) {
        return _EIP712Name();
    }

    function version() external view returns (string memory) {
        return _EIP712Version();
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
        if (
            (direction == Direction.Sell && amountAsset != targetToken)
                || (direction == Direction.Buy && amountAsset == targetToken)
        ) { revert InvalidWish(); }
        uint256 nonce = nonces[account][targetToken]++;
        _wishes[account][targetToken] = Wish(amountAsset, amount, expiresAt, direction);
        emit WishSet(account, targetToken, amountAsset, direction, amount, expiresAt, nonce);
    }
}