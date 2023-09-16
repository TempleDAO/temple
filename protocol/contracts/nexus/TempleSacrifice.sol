pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/TempleSacrifice.sol)

import { IRelic } from "../interfaces/nexus/IRelic.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ITempleERC20Token } from "../interfaces/core/ITempleERC20Token.sol";
import { CommonEventsAndErrors } from "../common/CommonEventsAndErrors.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

contract TempleSacrifice is Ownable {

    ///@notice the Relic ERC721A token
    IRelic public immutable relic;
    /// @notice the temple token used for payment in minting a relic
    ITempleERC20Token public immutable templeToken;
    /// @notice start time from which price increases
    uint64 public originTime;
    /// @notice custom price set by governance
    uint256 public customPrice;

    uint256 private constant MINIMUM_CUSTOM_PRICE = 30 ether;
    uint256 private constant ONE_ETHER = 1 ether;

    PriceParam public priceParams;

    struct PriceParam {
        uint64 priceMaxPeriod;
        uint128 minimumPrice;
        uint128 maximumPrice;
    }

    event OriginTimeSet(uint64 originTime);
    event CustomPriceSet(uint256 price);
    event TempleSacrificed(address account, uint256 amount);
    event PriceParamsSet(PriceParam params);

    error FutureOriginTime(uint64 originTime);

    constructor(address _relic, address _templeToken) Ownable() {
        relic = IRelic(_relic);
        templeToken = ITempleERC20Token(_templeToken);
        /// @dev caution so that origin time is never 0 and lesser than or equal to current block timestamp
        originTime = uint64(block.timestamp);
    }

    function setPriceParams(PriceParam calldata _priceParams) external onlyOwner {
        if (_priceParams.minimumPrice > _priceParams.maximumPrice) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_priceParams.minimumPrice < MINIMUM_CUSTOM_PRICE) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_priceParams.priceMaxPeriod == 0) { revert CommonEventsAndErrors.InvalidParam(); }
        priceParams.priceMaxPeriod = _priceParams.priceMaxPeriod;
        priceParams.minimumPrice = _priceParams.minimumPrice;
        priceParams.maximumPrice = _priceParams.maximumPrice;

        emit PriceParamsSet(_priceParams);
    }

    function setOriginTime(uint64 _originTime) external onlyOwner {
        if (_originTime < block.timestamp) { revert CommonEventsAndErrors.InvalidParam(); }
        originTime = _originTime;
        emit OriginTimeSet(originTime);
    }

    /// @notice owner can reset price with 0 _price value
    function setCustomPrice(uint256 _price) external onlyOwner {
        if (_price != 0 && _price < MINIMUM_CUSTOM_PRICE) { revert CommonEventsAndErrors.InvalidParam(); }
        customPrice = _price;
        emit CustomPriceSet(customPrice);
    }

    function sacrifice(address account, IRelic.Enclave enclave) external {
        if (block.timestamp < originTime) { revert FutureOriginTime(originTime); }
        uint256 amount = _getPrice();
        templeToken.burnFrom(account, amount);
        relic.mintRelic(account, enclave);
        emit TempleSacrificed(account, amount);
    }

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
        /// @notice starts from params.minimumPrice and tops at params.maximumPrice over params.priceMaxPeriod. 
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
}