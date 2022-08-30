pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./Vault.sol";

/**
    @title A proxy contract for interacting with Temple Vaults in the context of Temple Ascend
    @author TempleDAO
    @notice Proxies calls 
 */
contract AscendProxy is Ownable {
    address internal vaultedTemple;
    IERC20 public immutable temple;

    mapping(IERC20 => uint256) internal withdrawn;

    // Errors
    error FirstVaultCycle();
    error CanNotExitVault();

    // Events
    event EarlyWithdraw(address account, uint256 amount, address vault);

    constructor(address _vaultedTemple, IERC20 _temple) {
        vaultedTemple = _vaultedTemple;
        temple = _temple;
    }

     /**
     * @notice Allows user to withdraw their Temple from a vault before the exit window, forfeits any yield
     */
    function exitVaultEarly(uint256 amount, Vault vaultErc) external {
        (uint256 cycleNum,) = vaultErc.inEnterExitWindow();
        if (cycleNum == 0) { 
            revert FirstVaultCycle();
        }

        SafeERC20.safeTransferFrom(IERC20(vaultErc), msg.sender, address(this), amount);
        uint256 shareAmount = vaultErc.toSharesAmount(amount);
        uint256 templeBal = vaultErc.toTokenAmount(shareAmount);
        SafeERC20.safeTransfer(temple, msg.sender, templeBal);

        withdrawn[IERC20(vaultErc)] += amount;

        emit EarlyWithdraw(msg.sender, amount, address(vaultErc));
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
    }

    /**
     * @notice Allows owner to redeem any vault shares and then withdraw to the provided address
     */
    function redeemVaultTokenToTempleAndWithdraw(Vault vaultErc, address to, uint256 amount) external onlyOwner {
        redeemVaultTokenToTemple(vaultErc);
        //withdraw(address(temple), to, amount);
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