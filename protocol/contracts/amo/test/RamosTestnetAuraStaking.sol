pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (amo/test/RamosTestnetAuraStaking.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { IAuraStaking } from "contracts/interfaces/amo/IAuraStaking.sol";
import { IAuraBooster } from "contracts/interfaces/external/aura/IAuraBooster.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/// @notice A version of the Aura Staking which only just holds the BPT in this contract.
/// So there's no dependency on a testnet Aura dependency.
contract RamosTestnetAuraStaking is IAuraStaking, TempleElevatedAccess {
    using SafeERC20 for IERC20;

    // @notice BPT tokens for balancer pool
    IERC20 public immutable override bptToken;
    
    constructor(
        address _initialRescuer,
        address _initialExecutor,
        IERC20 _bptToken
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor) {
        bptToken = _bptToken;
    }

    function auraPoolInfo() external override pure returns (
        address /*token*/,
        address /*rewards*/,
        uint32 /*pId*/
    ) {
        revert CommonEventsAndErrors.Unimplemented();
    }

    function booster() external override pure returns (IAuraBooster) {
        revert CommonEventsAndErrors.Unimplemented();
    }

    function rewardsRecipient() external override pure returns (address) {
        revert CommonEventsAndErrors.Unimplemented();
    }

    function rewardTokens(uint256 /*index*/) external override pure returns (address) {
        revert CommonEventsAndErrors.Unimplemented();
    }
    
    function setAuraPoolInfo(uint32 /*_pId*/, address /*_token*/, address /*_rewards*/) external override pure {
        revert CommonEventsAndErrors.Unimplemented();
    }

    function setRewardsRecipient(address /*_recipeint*/) external override pure {
        revert CommonEventsAndErrors.Unimplemented();
    }

    function setRewardTokens(address[] memory /*_rewardTokens*/) external override pure {
        revert CommonEventsAndErrors.Unimplemented();
    }

    function recoverToken(address token, address to, uint256 amount) external override onlyElevatedAccess {
        IERC20(token).safeTransfer(to, amount);
        emit RecoveredToken(token, to, amount);
    }

    function isAuraShutdown() external override pure returns (bool) {
        return true;
    }

    function depositAndStake(uint256 /*amount*/) external override {
        // noop
    }

    function withdrawAndUnwrap(uint256 amount, bool /*claim*/, address recipient) external override onlyElevatedAccess {
        if (recipient != address(0)) {
            bptToken.safeTransfer(recipient, amount);
        }
    }

    function withdrawAllAndUnwrap(bool /*claim*/, address recipient) external override onlyElevatedAccess {
        if (recipient != address(0)) {
            uint256 bptBalance = bptToken.balanceOf(address(this));
            bptToken.safeTransfer(recipient, bptBalance);
        }
    }

    function getReward(bool /*claimExtras*/) external override pure {
        revert CommonEventsAndErrors.Unimplemented();
    }

    function stakedBalance() external override pure returns (uint256) {
        return 0;
    }

    // /**
    //  * @notice The total balance of BPT owned by this contract - either staked in Aura 
    //  * or unstaked
    //  */
    function totalBalance() external override view returns (uint256) {
        return bptToken.balanceOf(address(this));
    }

    function earned() external override pure returns (uint256) {
        return 0;
    }

    function showPositions() external override pure returns (Position memory position) {
        position.staked = 0;
        position.earned = 0;
    }
}