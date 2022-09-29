pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./Vault.sol";
import "../deprecated/TempleStaking.sol";

/**
    @title A proxy contract for interacting with Temple Vaults. 
    @author TempleDAO
    @notice Proxies calls to Temple Vaults without the need to approve Temple for each individual vault
 */
contract VaultProxy is Ownable {
    // Tokens / Contracted required for the proxy contract 
    IERC20 public immutable ogTemple;
    IERC20 public immutable temple;
    TempleStaking public immutable templeStaking;

    // Errors
    error NoTempleReceivedWhenUnstaking();
    error SendToAddressZero();
    error WithdrawSendFailed();

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
        @notice Takes provided OGT, unstakes into Temple and immediately deposits into a vault
     */
    function unstakeAndDepositIntoVault(uint256 _amountOGT, Vault vault) external {
        uint256 unstakedTemple = unstakeOGT(_amountOGT);
        SafeERC20.safeIncreaseAllowance(temple, address(vault), unstakedTemple);
        vault.depositFor(msg.sender, unstakedTemple);
    }
    
    /**
        @dev Private function which will take OGT, unstake it, ensure correct amount came back and then pass back 
        to the calling function.
     */
    function unstakeOGT(uint256 _amountOGT) private returns (uint256) {
        SafeERC20.safeIncreaseAllowance(ogTemple, address(templeStaking), _amountOGT);
        SafeERC20.safeTransferFrom(ogTemple, msg.sender, address(this), _amountOGT);
        
        uint256 templeBeforeBalance = temple.balanceOf(address(this));
        templeStaking.unstake(_amountOGT);
        uint256 templeAfterBalance = temple.balanceOf(address(this));
        if (templeAfterBalance < templeBeforeBalance) {
            revert NoTempleReceivedWhenUnstaking();
        }

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
    * @notice Transfer out amount of token to provided address
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