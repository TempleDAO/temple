pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/TempleSacrifice.sol)

import { IRelic } from "../interfaces/nexus/IRelic.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";
import { CommonEventsAndErrors } from "../common/CommonEventsAndErrors.sol";

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

    uint256 private MINIMUM_CUSTOM_PRICE = 20**18;

    event OriginTimeSet(uint64 originTime);
    event CustomPriceSet(uint256 price);
    event WhitelistContractSet(address whitelistContract);
    event TempleSacrificed(address account, uint256 amount);

    constructor(address _relic, address _templeToken) {
        relic = IRelic(_relic);
        templeToken = ITempleERC20Token(_templeToken);
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

    function setCustomPrice(uint256 _price) external onlyOwner {
        if (_price < MINIMUM_CUSTOM_PRICE) { revert CommonEventsAndErrors.InvalidParam(); }
        customPrice = _price;
        emit CustomPriceSet(customPrice);
    }

    function sacrifice(address account, IRelic.Enclave enclave) external onlyWhitelistContract {
        uint256 amount = _getPrice();
        templeToken.burnFrom(account, amount);
        relic.mintRelic(account, enclave);
        emit TempleSacrificed(account, amount);
    }

    function getPrice() external view returns (uint256) {
        return _getPrice();
    }

    function _getPrice() private view returns (uint256) {
         uint256 price = customPrice != 0
            ? customPrice
            : (10 *
                10**18 +
                (40 *
                    10**18 *
                    (((((block.timestamp - originTime) / 60 / 60 / 24) * 100) /
                        365) * 100)) /
                10000);
        if (price > 50 * 10**18) {
            price = 50 * 10**18;
        }
        return price;
    }

    modifier onlyWhitelistContract() {
        if (msg.sender != whitelistContract) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }
}