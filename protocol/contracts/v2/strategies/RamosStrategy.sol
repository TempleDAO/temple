pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/RamosStrategy.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { AMO__IBalancerVault } from "contracts/amo/interfaces/AMO__IBalancerVault.sol";
import { AMO__IBalancerHelpers } from "contracts/amo/interfaces/AMO__IBalancerHelpers.sol";
import { AMO__IBaseRewardPool } from "contracts/amo/interfaces/AMO__IBaseRewardPool.sol";
import { RAMOS } from "contracts/amo/Ramos.sol";
import { AuraStaking } from "contracts/amo/AuraStaking.sol";
import { PoolHelper } from "contracts/amo/helpers/PoolHelper.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

/**
 * STIL WIP
 */

contract RamosStrategy  is AbstractStrategy {
    using SafeERC20 for IERC20;
    string public constant VERSION = "1.0.0";

    /**
     * @notice 
     */
    RAMOS public ramos;
    PoolHelper public poolHelper;
    AuraStaking public auraStaking;

    IERC20 public templeToken;
    AMO__IBalancerHelpers public balancerHelpers;

    // Used when the executor wants to schedule a withdraw.
    uint256 public bptScheduledToWithdraw;

    /**
     * @notice When adding/removing treasury funds, what is the target amount of liquidity
     * to end up in RAMOS.
     */
    uint256 public ramosTargetLiquidity;

    event RamosSet(address ramos);
    event RamosTargetLiquiditySet(uint256 ramosTargetLiquidity);
    event Borrow(uint256 amount);
    event Repay(uint256 amount);
    event BptWithdrawAndRepayScheduled(uint256 bptAmount);

    constructor(
        address _initialGov,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _ramos,
        uint256 _ramosTargetLiquidity
    ) AbstractStrategy(_initialGov, _strategyName, _treasuryReservesVault) {
        ramos = RAMOS(_ramos);
        ramosTargetLiquidity = _ramosTargetLiquidity;
    }

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external override pure returns (string memory) {
        return VERSION;
    }

    // /**
    //  * @notice 
    //  */
    // function setRamos(address _ramos) external onlyStrategyExecutors {
    //     ramos = _ramos;
    //     emit RamosSet(_ramos);
    // }

    /**
     * @notice 
     */
    function setRamosTargetLiquidity(uint256 _ramosTargetLiquidity) external onlyStrategyExecutors {
        ramosTargetLiquidity = _ramosTargetLiquidity;
        emit RamosTargetLiquiditySet(_ramosTargetLiquidity);
    }

    /**
     * @notice A strategy executor borrows a fixed amount from the Treasury Reserves
     * These stables are sent to the Gnosis wallet
     */
    function borrow(uint256 stablesAmount) external onlyStrategyExecutors {
        emit Borrow(stablesAmount);
        treasuryReservesVault.borrow(stablesAmount);

        // The stables sit here until they're applied
        // A bot will do this (needs to call from off-chain to avoid sandwhich), so will need to be added as a valid executor.
    }

    /**
     * @notice A strategy executor borrows the max amount from the Treasury Reserves
     * These stables are sent to the Gnosis wallet
     */
    function borrowMax() external onlyStrategyExecutors returns (uint256 borrowedAmount) {
        borrowedAmount = treasuryReservesVault.borrowMax();
        emit Borrow(borrowedAmount);
    }

    // Note: this isn't a view, because balancerHelpers.queryJoin() isn't.
    function addLiquidityQuote(
        uint256 stablesAmount,
        uint256 slippageBps
    ) external returns (
        uint256 templeAmount,
        uint256 expectedBptAmount,
        uint256 minBptAmount,
        AMO__IBalancerVault.JoinPoolRequest memory requestData
    ) {
        /**
            1. Get balances: PoolHelper.getTempleStableBalances()
            2. Amount of TEMPLE: stablesAmount * templeBalance / stableBalance
            3. makeJoinRequest:
                amountsIn = [templeAmount, stablesAmount]
                a/ joinRequest = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'uint256'], [1, amountsIn, 0]);
                b/ (amountsIn, bptOut) = balancerHelpers.queryJoin(poolId, ramosAddr, ramosAddr, joinRequest)
                c/ joinRequest = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'uint256'], [1, amountsIn, 0]);
                    nb: the bpt (last param) could be set to bptOut...not sure why it was done explicitly afterwards instead.
                d/ ramos.addLiquidity(joinRequest, bptOut)
        */
        (uint256 templeBalance, uint256 stableBalance) = poolHelper.getTempleStableBalances();
        templeAmount = mulDiv(stablesAmount, templeBalance, stableBalance);

        IERC20[] memory assets = new IERC20[](2);
        (assets[0], assets[1]) = (templeToken, stableToken);

        uint256[] memory amountsIn = new uint256[](2);
        (amountsIn[0], amountsIn[1]) = (templeAmount, stablesAmount);

        // joinKind = 1; //EXACT_TOKENS_IN_FOR_BPT_OUT
        bytes memory encodedUserdata = abi.encode(1, amountsIn, 0);

        requestData = AMO__IBalancerVault.JoinPoolRequest(
            assets,
            amountsIn,
            encodedUserdata,
            false // fromInternalBalance
        );

        (expectedBptAmount, amountsIn) = balancerHelpers.queryJoin(ramos.balancerPoolId(), address(ramos), address(ramos), requestData);
        minBptAmount = applySlippage(expectedBptAmount, slippageBps);

        encodedUserdata = abi.encode(1, amountsIn, minBptAmount);
        requestData = AMO__IBalancerVault.JoinPoolRequest(
            assets,
            amountsIn,
            encodedUserdata,
            false // fromInternalBalance
        );
    }

    function applySlippage(uint256 amount, uint256 slippageBps) internal pure returns (uint256) {
        return amount * (10_000 - slippageBps) / 10_000;
    }

    function removeLiquidityQuote(
        uint256 bptAmount,
        uint256 slippageBps
    ) external returns (
        uint256 expectedTempleAmount,
        uint256 expectedStablesAmount,
        uint256 minTempleAmount,
        uint256 minStablesAmount,
        AMO__IBalancerVault.ExitPoolRequest memory requestData
    ) {
        address[] memory assets = new address[](2);
        (assets[0], assets[1]) = (address(templeToken), address(stableToken));
     
        // Defaults of 0
        uint256[] memory amountsOut = new uint256[](2);

        // joinKind = 1; //EXACT_BPT_IN_FOR_TOKENS_OUT
        bytes memory encodedUserData = abi.encode(1, bptAmount);

        requestData = AMO__IBalancerVault.ExitPoolRequest(
            assets,
            amountsOut,
            encodedUserData,
            false // fromInternalBalance
        );
        (bptAmount, amountsOut) = balancerHelpers.queryExit(ramos.balancerPoolId(), address(ramos), address(ramos), requestData);

        uint256[] memory minAmountsOut = new uint256[](2);
        minAmountsOut[0] = applySlippage(amountsOut[0], slippageBps);
        minAmountsOut[1] = applySlippage(amountsOut[1], slippageBps);

        requestData = AMO__IBalancerVault.ExitPoolRequest(
            assets,
            minAmountsOut,
            encodedUserData,
            false // fromInternalBalance
        );

        return (amountsOut[0], amountsOut[1], minAmountsOut[0], minAmountsOut[1], requestData);
    }

    function applyStablesToRamos(AMO__IBalancerVault.JoinPoolRequest memory request, uint256 minBptOut) external onlyStrategyExecutors {
        // Owner needs to be updated to this contract...that sucks, might need changing.
        ramos.addLiquidity(request, minBptOut);
    }

    /**
     * @notice A strategy executor repays debt back to the Treasury Reserves.
     * They must send the stable tokens to this strategy prior to calling.
     */
    function scheduleBptWithdrawAndRepay(uint256 bptAmount) external onlyStrategyExecutors {
        bptScheduledToWithdraw = bptAmount;
        emit BptWithdrawAndRepayScheduled(bptAmount);
    }

    function withdrawAndRepay(
        AMO__IBalancerVault.ExitPoolRequest memory request
    ) external onlyStrategyExecutors returns (
        uint256 stablesAmount
    ) {
        if (bptScheduledToWithdraw == 0) revert CommonEventsAndErrors.InvalidParam(); // todo change the error type

        // This needs to be changed such that an operator can withdraw, and state the address where it goes.
        // It should also return the number of tokens it got back...
        ramos.removeLiquidity(request, bptScheduledToWithdraw);
        stablesAmount = stableToken.balanceOf(address(ramos));
        ramos.recoverToken(address(stableToken), address(this), stablesAmount);

        emit Repay(stablesAmount);
        treasuryReservesVault.repay(stablesAmount);
    }

    /**
     * @notice The latest checkpoint of each asset balance this stratgy holds, and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev The asset value may be stale at any point in time, depending onthe strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() public override view returns (AssetBalance[] memory assetBalances, uint256 debt) {

        AuraStaking.Position memory positions = auraStaking.showPositions();
        // positions.staked == number of Aura pool tokens: auraStaking.auraPoolInfo().rewards
                // 1:1 to the amount of underlying balancer BPT tokens
        // positions.earned == number of BAL reward tokens

        // It doesn't include the AURA reward tokens we get. This is determined from the number of BAL reward tokens, 
        // but then the emissions schedule is applied. See AURA.mint()

        assetBalances = new AssetBalance[](2);
        (, address auraPoolToken, ) = auraStaking.auraPoolInfo(); // The `Balancer 50TEMPLE-50DAI Aura Deposit Vault`
        assetBalances[0] = AssetBalance(auraPoolToken, positions.staked);
        assetBalances[1] = AssetBalance(AMO__IBaseRewardPool(auraPoolToken).rewardToken(), positions.earned);

        // @todo: TBD on how claimed rewards are managed.

        debt = currentDebt();
    }

    /**
     * @notice An automated shutdown is not possible for a Gnosis strategy. The
     * strategy manager (the msig signers) will need to manually liquidate.
     *
     * Once done, they can give the all clear for governance to then shutdown the strategy
     * by calling TRV.shutdown(strategy, stables recovered)
     */
    function automatedShutdown() external virtual override returns (uint256) {
        // @todo We can automate under normal circumstances - but not if the balancer pool is in recovery mode, exploit, etc.
        // In that circumstance, emergency will take over.

        // ALso we can't currently automate the conversion of reward tokens to DAI.
        revert Unimplemented();
    }

}