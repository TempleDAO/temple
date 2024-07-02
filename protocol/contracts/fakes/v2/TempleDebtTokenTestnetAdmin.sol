pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";
import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";

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

    function burn(address from, uint256 amount) external {
        dUSD.burn(from, amount);
    }

    function setBaseInterestRate(uint96 _rate) external {
        dUSD.setBaseInterestRate(_rate);
    }

    function setRiskPremiumInterestRate(address _debtor, uint96 _rate) external {
        dUSD.setRiskPremiumInterestRate(_debtor, _rate);
    }

    function setRescueMode(bool value) external {
        dUSD.setRescueMode(value);
    }

    function proposeNewRescuer(address account) external {
        dUSD.proposeNewRescuer(account);
    }

    function acceptRescuer() external {
        dUSD.acceptRescuer();
    }

    function proposeNewExecutor(address account) external {
        dUSD.proposeNewExecutor(account);
    }

    function acceptExecutor() external {
        dUSD.acceptExecutor();
    }
    
    function setExplicitAccess(address allowedCaller, ITempleElevatedAccess.ExplicitAccess[] memory access) external {
        dUSD.setExplicitAccess(allowedCaller, access);
    }
}