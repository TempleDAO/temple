pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../core/Vault.sol";
import "./interfaces/IBalancerVault.sol";

contract AscendZaps is Ownable {
    address public vaultedTemple;
    IBalancerVault private immutable balancerVault = IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
    IERC20 public immutable temple;

    // Used to check how much Vault ERC20 has been 'zapped' in
    mapping(IERC20 => uint256) internal withdrawn;

    // Errors
    error FirstVaultCycle();
    error CanNotExitVault();
    error BalancerVaultSwapError(string reason);
    error SwapDataDoesNotMatch();
    error SendToAddressZero();
    error WithdrawSendFailed();

    // Events
    event EarlyWithdraw(address account, uint256 fromAmount, address vault, address toToken, uint256 toTokenAmount);

    constructor(address _vaultedTemple, IERC20 _temple) {
        vaultedTemple = _vaultedTemple;
        temple = _temple;
    }

     /**
     * @notice Allows user to withdraw their Temple from a vault before the exit window, forfeits any yield
     */
    function exitVaultEarly(
        uint256 amount, 
        Vault vaultErc, 
        IBalancerVault.SingleSwap memory singleSwap, 
        IBalancerVault.FundManagement memory funds, 
        uint256 limit, 
        uint256 deadline
    ) external returns (uint256 amountCalculated) {
        (uint256 cycleNum,) = vaultErc.inEnterExitWindow();
        if (cycleNum == 0) { 
            revert FirstVaultCycle();
        }
        // Transfer vault tokens to contract, and determine how much Temple that is currently worth
        SafeERC20.safeTransferFrom(IERC20(vaultErc), msg.sender, address(this), amount);
        uint256 shareAmount = vaultErc.toSharesAmount(amount);
        uint256 templeBal = vaultErc.toTokenAmount(shareAmount);
        
        // Check that the supplied offchain swap data is correct; not strictly needed 
        if (address(singleSwap.assetIn) != address(temple) || singleSwap.amount != templeBal) {
            revert SwapDataDoesNotMatch();
        }

        withdrawn[IERC20(vaultErc)] += amount;

        SafeERC20.safeIncreaseAllowance(temple, address(balancerVault), templeBal);

        // Swap 
        try balancerVault.swap(singleSwap, funds, limit, deadline) returns (uint256 _amountCalculated) {
            emit EarlyWithdraw(msg.sender, amount, address(vaultErc), address(singleSwap.assetOut), _amountCalculated);
            amountCalculated = _amountCalculated;
        } catch Error(string memory reason) {
            revert BalancerVaultSwapError(reason);
        }
    }

    /**
     * @notice Allows owner to redeem any vault shares from users that have exited early. Expects that owner has called OpsManager#increaseVaultTemple prior
     */
    function redeemVaultTokenToTemple(Vault vaultErc) public onlyOwner {
        if (!vaultErc.canExit()) {
            revert CanNotExitVault();
        }
        uint256 balance = vaultErc.balanceOf(address(this));

        uint256 amountOriginallyReceived = withdrawn[IERC20(vaultErc)];
        uint256 delta = balance - amountOriginallyReceived;
        uint256 interestEarnedShares = vaultErc.toSharesAmount(delta);
        uint256 interestEarnedTemple = vaultErc.toTokenAmount(interestEarnedShares);

        vaultErc.withdraw(balance);

        // redistribute interest 
        SafeERC20.safeTransferFrom(temple, address(this), vaultedTemple, interestEarnedTemple);

        withdrawn[IERC20(vaultErc)] = 0;
    }

    /**
     * @notice Allows caller to check to see whether the zap contract has accrued any interest while holding vault tokens
     */
    function checkInterestAccrued(Vault vaultErc) public view returns (uint256 interestAccrued) {
        // Get amount of Temple current 'owned' by the zapped in asset
        uint256 contractShareAmount = vaultErc.shareBalanceOf(address(this));
        uint256 contractTempleBal = vaultErc.toTokenAmount(contractShareAmount);

        uint256 withdrawnAmount = withdrawn[IERC20(vaultErc)];
        uint256 withdrawnShareAmount = vaultErc.toSharesAmount(withdrawnAmount);
        uint256 withdrawnTempleBal = vaultErc.toTokenAmount(withdrawnShareAmount);

        uint256 interestAccrued = contractTempleBal - withdrawnTempleBal;
    }

    /**
    * @notice Transfer out amount of token to provided address. This function should never be called unless the accounting
              within the contract prevents withdrawal and redistribution of the Vault ERC20.
    */
    function withdraw(address token, address to, uint256 amount) public onlyOwner {
        if (to == address(0)) {
            revert SendToAddressZero();
        }

        if (token == address(0)) {
            (bool sent,) = payable(to).call{value: amount}("");
            if (!sent) {
                revert WithdrawSendFailed();
            }
        } else {
            SafeERC20.safeTransfer(IERC20(token), to, amount);
        }
    }
}