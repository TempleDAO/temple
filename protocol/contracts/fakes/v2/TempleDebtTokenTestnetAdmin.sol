pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";

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

    function mint(address to, uint256 amount) external {
        dUSD.mint(to, amount);
    }

    function burn(address from, uint256 amount, bool capBurnAmount) external {
        dUSD.burn(from, amount, capBurnAmount);
    }

    function setBaseInterestRate(uint256 _rate) external {
        dUSD.setBaseInterestRate(_rate);
    }

    function setRiskPremiumInterestRate(address _debtor, uint256 _rate) external {
        dUSD.setRiskPremiumInterestRate(_debtor, _rate);
    }

    function setRescueMode(bool value) external {
        dUSD.setRescueMode(value);
    }

    function setRescuer(address account, bool value) external {
        dUSD.setRescuer(account, value);
    }

    function setExecutor(address account, bool value) external {
        dUSD.setExecutor(account, value);
    }

    function setExplicitAccess(address allowedCaller, bytes4 fnSelector, bool value) external {
        dUSD.setExplicitAccess(allowedCaller, fnSelector, value);
    }
}