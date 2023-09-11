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
    /// @notice whitelisting contract for validation before sacrifice
    address public whitelistContract;
    /// @notice start time from which price increases
    uint64 public originTime;
    /// @notice custom price set by governance
    uint256 public customPrice;

    uint256 private constant MINIMUM_CUSTOM_PRICE = 30 ether; //10*10**18;
    uint256 private constant ONE_ETHER = 1 ether;
    uint256 private constant PRICE_MAX_PERIOD = 365 days;

    event OriginTimeSet(uint64 originTime);
    event CustomPriceSet(uint256 price);
    event WhitelistContractSet(address whitelistContract);
    event TempleSacrificed(address account, uint256 amount);

    error FutureOriginTime(uint64 originTime);

    constructor(address _relic, address _templeToken) Ownable() {
        relic = IRelic(_relic);
        templeToken = ITempleERC20Token(_templeToken);
        /// @dev caution so that origin time is never 0 and lesser than or equal to current block timestamp
        originTime = uint64(block.timestamp);
    }

    function setWhitelistContract(address _whitelistContract) external onlyOwner {
        if (_whitelistContract == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); } 
        whitelistContract = _whitelistContract;
        emit WhitelistContractSet(whitelistContract);
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

    function sacrifice(address account, IRelic.Enclave enclave) external onlyWhitelistContract {
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
        /// @notice starts from 30 TEMPLE and tops at 100 TEMPLE over 1 year
        /// @dev safe because timestamp is checked in parent function.
        /// @notice rounded up
        // uint256 numerator = 100 * ONE_ETHER * (originTime - block.timestamp);
        // uint256 price = _divUp(numerator, 365 days) + MINIMUM_CUSTOM_PRICE;
        // return price;
        
       
        uint256 maxPrice = 100 * ONE_ETHER;
        uint256 timeDifference = originTime - block.timestamp;
        uint256 price =  _muldivRoundUp(maxPrice, timeDifference, PRICE_MAX_PERIOD);
        return price;
        
        // uint256 price = customPrice != 0
        //     ? customPrice
        //     : (10 *
        //         10**18 +
        //         (40 *
        //             10**18 *
        //             (((((block.timestamp - originTime) / 60 / 60 / 24) * 100) /
        //                 365) * 100)) /
        //         10000);
        // if (price > 50 * 10**18) {
        //     price = 50 * 10**18;
        // }
        // return price;
    }

    function _muldivRoundUp(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        // See OZ Math.sol for the equivalent mulDiv() with rounding.
        if (mulmod(x, y, denominator) > 0) {
            result += 1;
        }
    }

    modifier onlyWhitelistContract() {
        if (msg.sender != whitelistContract) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }
}