pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Vault.sol";
import "../ABDKMathQuad.sol";
import "../OGTemple.sol";
import "../TempleERC20Token.sol";
import "../TempleStaking.sol";
import "../devotion/Faith.sol";

// import "hardhat/console.sol";

/**
    @notice A proxy contract for interacting with Temple Vaults. 
 */
contract VaultProxy {
    using ABDKMathQuad for bytes16;
    /** @notice Tokens / Contracted required for the proxy contract  */
    OGTemple public ogTemple;
    TempleERC20Token public temple;
    TempleStaking public templeStaking;
    Faith public faith;

    constructor(
        OGTemple _ogTemple,
        TempleERC20Token _temple,
        TempleStaking _templeStaking,
        Faith _faith
    ) {
        ogTemple = _ogTemple;
        temple = _temple;
        templeStaking = _templeStaking;
        faith = _faith;
    }

    bytes16 private constant MAX_MULT = 0x3fff4ccccccccccccccccccccccccccc; // 1.3
    bytes16 private constant TA_MULT = 0x40004000000000000000000000000000; // 2.5

    /**
        @notice Given an amount of Faith and Temple, apply the boosting curve and produce the amount of boosted Temple one can expect to receive.
                Formula is BoostedTemple = TempleProvided * min(1.3, (1+faith/(2.5*TempleProvided)))
     */
    function getFaithMultiplier(uint256 _amountFaith, uint256 _amountTemple) pure public returns (uint256) {
        // Tl = Ta * min(1.3, (1+faith/2.5*Ta))
        bytes16 amountFaith = ABDKMathQuad.fromUInt(_amountFaith);
        bytes16 amountTemple = ABDKMathQuad.fromUInt(_amountTemple);
        bytes16 t = ABDKMathQuad.fromUInt(1).add(amountFaith.div(TA_MULT.mul(amountTemple)));
        bytes16 mult = MAX_MULT < t ? MAX_MULT : t;

        return ABDKMathQuad.toUInt(amountTemple.mul(mult));
    }

    /**
        @notice Takes provided faith and Temple, applies the boost then immediate deposits into a vault
     */
    function depositTempleWithFaith(uint256 _amountTemple, uint112 _amountFaith, Vault vault) external {
        faith.redeem(msg.sender, _amountFaith);
        uint256 boostedAmount = getFaithMultiplier(_amountFaith, _amountTemple);
        SafeERC20.safeTransferFrom(temple, msg.sender, address(this), _amountTemple);
        SafeERC20.safeIncreaseAllowance(temple, address(vault), boostedAmount);
        vault.depositFor(msg.sender, boostedAmount);
    }
    
    /**
        @notice Takes OGT from the user, unstakes from the staking contract and then immediately deposits into a vault

        @dev This is loosely coupled with the InstantExitQueue insomuch that this function assumes the staking contract
             exit queue has been set to instantly withdraw, otherwise this function will fail.
     */
    function unstakeAndDepositIntoVault(uint256 _amountOGT, Vault vault) external {
        SafeERC20.safeIncreaseAllowance(ogTemple, address(templeStaking), _amountOGT);
        SafeERC20.safeTransferFrom(ogTemple, msg.sender, address(this), _amountOGT);
        uint256 expectedTemple = templeStaking.balance(_amountOGT);
        
        uint256 templeBeforeBalance = temple.balanceOf(address(this));
        templeStaking.unstake(_amountOGT);
        uint256 templeAfterBalance = temple.balanceOf(address(this));
        require(templeAfterBalance > templeBeforeBalance, "Vault Proxy: no Temple received when unstaking");

        SafeERC20.safeIncreaseAllowance(temple, address(vault), expectedTemple);
        vault.depositFor(msg.sender, expectedTemple);
    }

    /**
        @notice A proxy function for depositing into a vault; useful if we wish to limit number of approvals to one, rather than for each underlying 
                vault instance. 
     */
    function depositTempleFor(uint256 _amount, Vault vault) public {
        SafeERC20.safeIncreaseAllowance(temple, address(vault), _amount);
        SafeERC20.safeTransferFrom(temple, msg.sender, address(this), _amount);
        vault.depositFor(msg.sender, _amount);
    }

    //todo add escape hatch for ERC20 in this contract
}