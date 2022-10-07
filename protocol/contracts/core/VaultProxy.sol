pragma solidity 0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./Vault.sol";
import "../deprecated/TempleStaking.sol";

/**
 * @title A proxy contract for interacting with Temple Vaults.
 * @author TempleDAO
 * @notice Proxies calls to Temple Vaults without the need to approve Temple for each individual vault
 */
contract VaultProxy is Ownable {
    using SafeERC20 for IERC20;

    /// @notice OGTemple token address
    IERC20 public immutable ogTemple;

    /// @notice Temple token address
    IERC20 public immutable temple;

    /// @notice temple staking address
    TempleStaking public immutable templeStaking;

    // Errors
    error NoTempleReceivedWhenUnstaking();
    error SendToAddressZero();
    error WithdrawSendFailed();
    error WithdrawZeroAmount();

    // Events
    event EarlyWithdraw(address account, uint256 amount, address vault);

    constructor(
        OGTemple _ogTemple,
        IERC20 _temple,
        TempleStaking _templeStaking
    ) {
        ogTemple = _ogTemple;
        temple = _temple;
        templeStaking = _templeStaking;
    }

    /**
     * @notice Takes provided OGT, unstakes into Temple and immediately deposits into a vault
     * @param amountOGT OG Temple token amount
     * @param vault vault address
     */
    function unstakeAndDepositIntoVault(uint256 amountOGT, Vault vault)
        external
    {
        uint256 unstakedTemple = unstakeOGT(amountOGT);
        temple.safeIncreaseAllowance(address(vault), unstakedTemple);
        vault.depositFor(msg.sender, unstakedTemple);
    }

    /**
     * @dev Private function which will take OGT, unstake it, ensure correct amount came back and then pass back 
            to the calling function.
     * @param amountOGT OG Temple token amount
     * @return unstaked unstaked temple amount
     */
    function unstakeOGT(uint256 amountOGT) private returns (uint256 unstaked) {
        ogTemple.safeIncreaseAllowance(address(templeStaking), amountOGT);
        ogTemple.safeTransferFrom(msg.sender, address(this), amountOGT);

        uint256 templeBeforeBalance = temple.balanceOf(address(this));
        templeStaking.unstake(amountOGT);
        uint256 templeAfterBalance = temple.balanceOf(address(this));
        if (templeAfterBalance < templeBeforeBalance) {
            revert NoTempleReceivedWhenUnstaking();
        }

        unstaked = templeAfterBalance - templeBeforeBalance;
    }

    /**
     * @notice A proxy function for depositing into a vault; useful if we wish to limit number of approvals to one,
                rather than for each underlying vault instance.
     * @param amount deposit amount
     * @param vault vault address
     */
    function depositTempleFor(uint256 amount, Vault vault) public {
        temple.safeIncreaseAllowance(address(vault), amount);
        temple.safeTransferFrom(msg.sender, address(this), amount);
        vault.depositFor(msg.sender, amount);
    }

    /**
     * @notice Transfer out amount of token to provided address
     * @param token token address to withdraw
     * @param to recipient address
     * @param amount withdraw amount
     */
    function withdraw(
        address token,
        address to,
        uint256 amount
    ) public onlyOwner {
        if (to == address(0)) {
            revert SendToAddressZero();
        }
        if (amount == 0) {
            revert WithdrawZeroAmount();
        }

        if (token == address(0)) {
            (bool sent, ) = payable(to).call{value: amount}("");
            if (!sent) {
                revert WithdrawSendFailed();
            }
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}
