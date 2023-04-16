pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";
import { Governable } from "contracts/common/access/Governable.sol";

contract TempleDebtTokenTestnetAdmin {

    ITempleDebtToken public immutable dUSD;

    constructor(address _dUSD) {
        dUSD = ITempleDebtToken(_dUSD);
    }

    function addMinter(address account) external {
        dUSD.addMinter(account);
    }

    function removeMinter(address account) external {
        dUSD.removeMinter(account);
    }

    function setBaseInterestRate(uint256 _rate) external {
        dUSD.setBaseInterestRate(_rate);
    }

    function setRiskPremiumInterestRate(address _debtor, uint256 _rate) external {
        dUSD.setRiskPremiumInterestRate(_debtor, _rate);
    }

    function proposeNewGov(address newProposedGov) external {
        Governable(address(dUSD)).proposeNewGov(newProposedGov);
    }

    function acceptGov() external {
        Governable(address(dUSD)).acceptGov();
    }
}