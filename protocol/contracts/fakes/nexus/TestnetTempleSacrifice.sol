pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/TempleSacrifice.sol)

import { IRelic } from "../../interfaces/nexus/IRelic.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ITempleERC20Token } from "../../interfaces/core/ITempleERC20Token.sol";
import { CommonEventsAndErrors } from "../../common/CommonEventsAndErrors.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

contract TestnetTempleSacrifice {
    using SafeERC20 for ITempleERC20Token;

    /// @notice the Relic ERC721A token
    IRelic public immutable relic;
    /// @notice the temple token used for payment in minting a relic
    ITempleERC20Token public immutable templeToken;
    /// @notice send sacrificed temple to this address
    address public sacrificedTempleRecipient;
    /// @notice start time from which price increases
    uint64 public originTime;
    /// @notice custom price set by governance
    uint256 public customPrice;

    uint256 private constant MINIMUM_CUSTOM_PRICE = 30 ether;
    uint256 private constant ONE_ETHER = 1 ether;
    /// @notice Price parameters 
    PriceParam public priceParams;
    /// @notice testnet only operators
    mapping(address => bool) public operators;

    struct PriceParam {
        uint64 priceMaxPeriod;
        uint128 minimumPrice;
        uint128 maximumPrice;
    }

    event OriginTimeSet(uint64 originTime);
    event CustomPriceSet(uint256 price);
    event TempleSacrificed(address account, uint256 amount);
    event PriceParamsSet(PriceParam params);
    event TempleRecipientSet(address recipient);
    event OperatorSet(address operator, bool allow);

    error FutureOriginTime(uint64 originTime);

    constructor(address _relic, address _templeToken) {
        relic = IRelic(_relic);
        templeToken = ITempleERC20Token(_templeToken);
        /// @dev caution so that origin time is never 0 and lesser than or equal to current block timestamp
        originTime = uint64(block.timestamp);
        operators[msg.sender] = true;
    }

    function setOperator(address operator, bool allow) external onlyOperator {
        operators[operator] = allow;
        emit OperatorSet(operator, allow);
    }

    /*
     * @notice Set recipient for sacrificed temple
     * @param recipient Recipient
     */
    function setSacrificedTempleRecipient(address recipient) external onlyOperator {
        if (recipient == address(0)) { revert CommonEventsAndErrors.InvalidParam(); }
        sacrificedTempleRecipient = recipient;
        emit TempleRecipientSet(recipient);
    }

    /*
     * @notice Set price parameters.
     * @param _priceParams Price parameters to set
     */
    function setPriceParams(PriceParam calldata _priceParams) external onlyOperator {
        if (_priceParams.minimumPrice > _priceParams.maximumPrice) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_priceParams.minimumPrice < MINIMUM_CUSTOM_PRICE) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_priceParams.priceMaxPeriod == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        priceParams.priceMaxPeriod = _priceParams.priceMaxPeriod;
        priceParams.minimumPrice = _priceParams.minimumPrice;
        priceParams.maximumPrice = _priceParams.maximumPrice;

        emit PriceParamsSet(_priceParams);
    }

    /*
     * @notice Set origin time.
     * Origin time is the start of the linear ascending price to params.priceMaxPeriod
     * @param _originTime Origin time
     */
    function setOriginTime(uint64 _originTime) external onlyOperator {
        if (_originTime < block.timestamp) { revert CommonEventsAndErrors.InvalidParam(); }
        originTime = _originTime;
        emit OriginTimeSet(originTime);
    }

    /*
     * @notice Set custom price
     * owner can reset price with 0 _price value. Custom price can be set anytime during or after params.priceMaxPeriod on
     * a flash sale or at a discounted price.
     * @param _price Custom price 
     */
    function setCustomPrice(uint256 _price) external onlyOperator {
        if (_price != 0 && _price < MINIMUM_CUSTOM_PRICE) { revert CommonEventsAndErrors.InvalidParam(); }
        customPrice = _price;
        emit CustomPriceSet(customPrice);
    }

    /*
     * @notice Sacrifice TEMPLE tokens to mint a Relic
     * Caller must approve contract to spend TEMPLE tokens
     * @param enclaveId Enclave ID 
     */
    function sacrifice(uint256 enclaveId) external {
        if (block.timestamp < originTime) { revert FutureOriginTime(originTime); }
        uint256 amount = _getPrice();
        templeToken.safeTransferFrom(msg.sender, sacrificedTempleRecipient, amount);
        relic.mintRelic(msg.sender, enclaveId);
        emit TempleSacrificed(msg.sender, amount);
    }

   
    /*
     * @notice Get amount of TEMPLE tokens to mint a Relic
     * @return Relic price
     */
    function getPrice() external view returns (uint256) {
        if (block.timestamp < originTime && customPrice == 0) {
            return type(uint256).max;
        }
        return _getPrice();
    }

    function _getPrice() private view returns (uint256) {
        if (customPrice > 0) {
            return customPrice;
        }
        /// @dev starts from params.minimumPrice and tops at params.maximumPrice over params.priceMaxPeriod. 
        /// Rounded up. price unit in TEMPLE
        uint256 timeDifference;
        unchecked {
            /// @dev safe because timestamp is checked in parent function.
            timeDifference = block.timestamp - originTime;
        }
        PriceParam memory paramsCache = priceParams;
        uint256 price = paramsCache.minimumPrice + 
            _muldivRoundUp(paramsCache.maximumPrice, timeDifference, paramsCache.priceMaxPeriod);
        if (price > paramsCache.maximumPrice) {
            price = paramsCache.maximumPrice;
        }
        return price;
    }

    function _muldivRoundUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        // See OZ Math.sol for the equivalent mulDiv() with rounding.
        if (mulmod(x, y, denominator) > 0) {
            result += 1;
        }
    }

    modifier onlyOperator() {
        if (!operators[msg.sender]) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }
}