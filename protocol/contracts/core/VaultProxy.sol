pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./Vault.sol";
import "../util/ABDKMathQuad.sol";
import "../deprecated/TempleStaking.sol";
import "../deprecated/Faith.sol";

/**
    @notice A proxy contract for interacting with Temple Vaults. 
 */
contract VaultProxy is Ownable {
    using ABDKMathQuad for bytes16;
    /** @notice Tokens / Contracted required for the proxy contract  */
    IERC20 public immutable ogTemple;
    IERC20 public immutable temple;
    TempleStaking public immutable templeStaking;
    Faith public immutable faith;
    bool public faithClaimEnabled;

    constructor(
        OGTemple _ogTemple,
        IERC20 _temple,
        TempleStaking _templeStaking,
        Faith _faith
    ) Ownable(msg.sender) {
        ogTemple = _ogTemple;
        temple = _temple;
        templeStaking = _templeStaking;
        faith = _faith;
        faithClaimEnabled = true;
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
    function depositTempleWithFaith(uint256 _amountTemple, uint112 _amountFaith, Vault vault) public {
        require(faithClaimEnabled, "VaultProxy: Faith claim no longer enabled");
        faith.redeem(msg.sender, _amountFaith);
        uint256 boostedAmount = getFaithMultiplier(_amountFaith, _amountTemple);
        SafeERC20.safeTransferFrom(temple, msg.sender, address(this), _amountTemple);
        SafeERC20.safeIncreaseAllowance(temple, address(vault), boostedAmount);
        vault.depositFor(msg.sender, boostedAmount);
    }

    /**
        @notice Takes provided faith and OGT, unstakes the OGT into Temple, applies the boost and then immediately
        deposits into a vault
     */
    function unstakeAndDepositTempleWithFaith(uint256 _amountOGT, uint112 _amountFaith, Vault vault) external {
        require(faithClaimEnabled, "VaultProxy: Faith claim no longer enabled");
        faith.redeem(msg.sender, _amountFaith);
        uint256 unstakedTemple = unstakeOGT(_amountOGT);
        uint256 boostedAmount = getFaithMultiplier(_amountFaith, unstakedTemple);
        SafeERC20.safeIncreaseAllowance(temple, address(vault), boostedAmount);
        vault.depositFor(msg.sender, boostedAmount);
    }

    /**
        @notice Takes provided OGT, unstakes into Temple and immediately deposits into a vault
     */
    function unstakeAndDepositIntoVault(uint256 _amountOGT, Vault vault) external {
        uint256 unstakedTemple = unstakeOGT(_amountOGT);
        SafeERC20.safeIncreaseAllowance(temple, address(vault), unstakedTemple);
        vault.depositFor(msg.sender, unstakedTemple);
    }
    
    /**
        @notice Private function which will take OGT, unstake it, ensure correct amount came back and then pass back 
        to the calling function.
     */
    function unstakeOGT(uint256 _amountOGT) private returns (uint256) {
        SafeERC20.safeIncreaseAllowance(ogTemple, address(templeStaking), _amountOGT);
        SafeERC20.safeTransferFrom(ogTemple, msg.sender, address(this), _amountOGT);
        
        uint256 templeBeforeBalance = temple.balanceOf(address(this));
        templeStaking.unstake(_amountOGT);
        uint256 templeAfterBalance = temple.balanceOf(address(this));
        require(templeAfterBalance > templeBeforeBalance, "Vault Proxy: no Temple received when unstaking");

        return templeAfterBalance - templeBeforeBalance;
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

    /**
    * Toggle whether faith is claimable
    */
    function toggleFaithClaimEnabled() external onlyOwner {
        faithClaimEnabled = !faithClaimEnabled;
    }

    /**
    * transfer out amount of token to provided address
    */
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "to address zero");

        if (token == address(0)) {
            (bool sent,) = payable(to).call{value: amount}("");
            require(sent, "send failed");
        } else {
            SafeERC20.safeTransfer(IERC20(token), to, amount);
        }
    }
}