pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (amo/Ramos.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";

import { IRamos } from "contracts/interfaces/amo/IRamos.sol";
import { IRamosProtocolTokenVault } from "contracts/interfaces/amo/helpers/IRamosProtocolTokenVault.sol";
import { ITreasuryPriceIndexOracle } from "contracts/interfaces/v2/ITreasuryPriceIndexOracle.sol";
import { IBalancerPoolHelper } from "contracts/interfaces/amo/helpers/IBalancerPoolHelper.sol";
import { IBalancerVault } from "contracts/interfaces/external/balancer/IBalancerVault.sol";
import { IAuraStaking } from "contracts/interfaces/amo/IAuraStaking.sol";
import { IBalancerBptToken } from "contracts/interfaces/external/balancer/IBalancerBptToken.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { AMOCommon } from "contracts/amo/helpers/AMOCommon.sol";

/* solhint-disable not-rely-on-time */

/**
 * @title AMO built for a 50/50 balancer pool
 *
 * @notice RAMOS rebalances the pool to trend towards the Treasury Price Index (TPI).
 * In order to accomplish this:
 *   1. When the price is BELOW the TPI it will either:
 *      - Single side withdraw `protocolToken`
 *      - Single side add `quoteToken`
 *   2. When the price is ABOVE the TPI it will either:
 *      - Single side add `protocolToken`
 *      - Single side withdraw `quoteToken`
 * Any idle BPTs (Balancer LP tokens) are deposited into Aura to earn yield.
 * `protocolToken` can be sourced/disposed of by either having direct mint & burn rights or by
 * pulling and sending tokens to an address.
 */
contract Ramos is IRamos, TempleElevatedAccess, Pausable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IBalancerBptToken;

    /// @notice The Balancer vault singleton
    IBalancerVault public immutable override balancerVault;

    /// @notice BPT token address for this LP
    IBalancerBptToken public immutable override bptToken;

    /// @notice Balancer pool helper contract
    IBalancerPoolHelper public override poolHelper;
    
    /// @notice AMO contract for staking into aura 
    IAuraStaking public override amoStaking;

    /// @notice The Protocol token
    IERC20 public immutable override protocolToken;

    /// @notice The Quoted token this is paired with in the LP. It may be a stable, 
    /// or another Balancer linear token like BB-A-USD
    IERC20 public immutable override quoteToken;

    /// @notice The time when the last rebalance occured
    uint64 public override lastRebalanceTimeSecs;

    /// @notice The minimum amount of time which must pass since `lastRebalanceTimeSecs` before another rebalance
    /// can occur
    uint64 public override cooldownSecs;

    /// @notice The balancer 50/50 pool ID.
    bytes32 public immutable override balancerPoolId;

    /// @notice Precision for BPS calculations. 1% == 100
    uint256 public constant override BPS_PRECISION = 10_000;

    /// @notice The Treasury Price Index (TPI) Oracle
    ITreasuryPriceIndexOracle public override tpiOracle;

    /// @notice The vault from where to borrow and repay the Protocol Token
    IRamosProtocolTokenVault public override protocolTokenVault;

    /// @notice The percentage bounds (in bps) beyond which to rebalance up or down
    uint64 public override rebalancePercentageBoundLow;
    uint64 public override rebalancePercentageBoundUp;

    /// @notice Maximum amount of tokens that can be rebalanced on each run
    MaxRebalanceAmounts public override maxRebalanceAmounts;

    /// @notice A limit on how much the price can be impacted by a rebalance. 
    /// A price change over this limit will revert. Specified in bps
    uint64 public override postRebalanceSlippage;

    /// @notice `protocolToken` index in balancer pool. to avoid recalculation or external calls
    uint64 public immutable override protocolTokenBalancerPoolIndex;

    /// @notice The address to send proportion of rebalance as fees to
    address public immutable override feeCollector;

    // @notice The maximum rebalance fee which can be set
    uint256 public override immutable maxRebalanceFee;

    /// @notice The fees (in basis points) taken on a rebalance
    RebalanceFees public override rebalanceFees;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        address _balancerVault,
        address _protocolToken,
        address _quoteToken,
        address _bptToken,
        address _amoStaking,
        uint64 _protocolTokenIndexInPool,
        bytes32 _balancerPoolId,
        address _tpiOracle,
        address _feeCollector,
        uint256 _maxRebalanceFee
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor) {
        balancerVault = IBalancerVault(_balancerVault);
        protocolToken = IERC20(_protocolToken);
        quoteToken = IERC20(_quoteToken);
        bptToken = IBalancerBptToken(_bptToken);
        amoStaking = IAuraStaking(_amoStaking);
        protocolTokenBalancerPoolIndex = _protocolTokenIndexInPool;
        balancerPoolId = _balancerPoolId;
        tpiOracle = ITreasuryPriceIndexOracle(_tpiOracle);
        feeCollector = _feeCollector;
        maxRebalanceFee = _maxRebalanceFee;
    }

    /**
     * @notice Set the pool helper contract
     */
    function setPoolHelper(address _poolHelper) external onlyElevatedAccess {
        poolHelper = IBalancerPoolHelper(_poolHelper);

        emit SetPoolHelper(_poolHelper);
    }

    /**
     * @notice Set the AMO staking contract, used to automatically stake BPT positions in Aura
     */
    function setAmoStaking(address _amoStaking) external onlyElevatedAccess {
        amoStaking = IAuraStaking(_amoStaking);

        emit SetAmoStaking(_amoStaking);
    }

    /**
     * @notice Set the acceptable amount of price impact allowed due to a rebalance
     */
    function setPostRebalanceSlippage(uint64 slippage) external onlyElevatedAccess {
        if (slippage > BPS_PRECISION || slippage == 0) {
            revert AMOCommon.InvalidBPSValue(slippage);
        }
        postRebalanceSlippage = slippage;
        emit SetPostRebalanceSlippage(slippage);
    }

    /**
     * @notice Set maximum amount used by bot to rebalance
     * @param bptMaxAmount Maximum bpt amount per rebalance
     * @param quoteTokenMaxAmount Maximum `quoteToken` amount per rebalance
     * @param protocolTokenMaxAmount Maximum protocolToken amount per rebalance
     */
    function setMaxRebalanceAmounts(uint256 bptMaxAmount, uint256 quoteTokenMaxAmount, uint256 protocolTokenMaxAmount) external onlyElevatedAccess {
        if (bptMaxAmount == 0 || quoteTokenMaxAmount == 0 || protocolTokenMaxAmount == 0) {
            revert AMOCommon.InvalidMaxAmounts(bptMaxAmount, quoteTokenMaxAmount, protocolTokenMaxAmount);
        }
        maxRebalanceAmounts.bpt = bptMaxAmount;
        maxRebalanceAmounts.quoteToken = quoteTokenMaxAmount;
        maxRebalanceAmounts.protocolToken = protocolTokenMaxAmount;
        emit SetMaxRebalanceAmounts(bptMaxAmount, quoteTokenMaxAmount, protocolTokenMaxAmount);
    }

    /// @notice Set maximum percentage bounds (in bps) beyond which to rebalance up or down
    function setRebalancePercentageBounds(uint64 belowTpi, uint64 aboveTpi) external onlyElevatedAccess {
        if (belowTpi > BPS_PRECISION || aboveTpi > BPS_PRECISION) {
            revert AMOCommon.InvalidBPSValue(belowTpi);
        }
        rebalancePercentageBoundLow = belowTpi;
        rebalancePercentageBoundUp = aboveTpi;

        emit SetRebalancePercentageBounds(belowTpi, aboveTpi);
    }

    /**
     * @notice Set the Treasury Price Index (TPI) Oracle
     */
    function setTpiOracle(address newTpiOracle) external override onlyElevatedAccess {
        emit TpiOracleSet(newTpiOracle);
        tpiOracle = ITreasuryPriceIndexOracle(newTpiOracle);
    }

    /**
     * @notice Set the Treasury Price Index (TPI) Oracle
     */
    function setProtocolTokenVault(address vault) external override onlyElevatedAccess {
        emit ProtocolTokenVaultSet(vault);

        // Remove allowance from the old vault
        address previousVault = address(protocolTokenVault);
        if (previousVault != address(0)) {
            protocolToken.safeApprove(previousVault, 0);
        }

        protocolTokenVault = IRamosProtocolTokenVault(vault);

        // Set max allowance on the new TRV
        {
            protocolToken.safeApprove(vault, 0);
            protocolToken.safeIncreaseAllowance(vault, type(uint256).max);
        }
    }

    /**
     * @notice Set the rebalance fees, in basis points
     * @param rebalanceJoinFeeBps The fee for when a `rebalanceUpJoin` or `rebalanceDownJoin` is performed
     * @param rebalanceExitFeeBps The fee for when a `rebalanceUpExit` or `rebalanceDownExit` is performed
     */
    function setRebalanceFees(uint256 rebalanceJoinFeeBps, uint256 rebalanceExitFeeBps) external override {
        if (msg.sender != feeCollector) revert CommonEventsAndErrors.InvalidAccess();
        if (rebalanceJoinFeeBps > maxRebalanceFee) revert CommonEventsAndErrors.InvalidParam();
        if (rebalanceExitFeeBps > maxRebalanceFee) revert CommonEventsAndErrors.InvalidParam();

        emit RebalanceFeesSet(rebalanceJoinFeeBps, rebalanceExitFeeBps);

        // Downcast is safe since it can't be set greater than the max.
        rebalanceFees = RebalanceFees(uint128(rebalanceJoinFeeBps), uint128(rebalanceExitFeeBps));
    }

    /**
     * @notice The Treasury Price Index - the target price of the Treasury, in `quoteToken` terms.
     */
    function treasuryPriceIndex() public view override returns (uint256) {
        return tpiOracle.treasuryPriceIndex();
    }

    /**
     * @notice Set cooldown time to throttle rebalances
     * @param _seconds Time in seconds between calls
     */
    function setCoolDown(uint64 _seconds) external onlyElevatedAccess {
        cooldownSecs = _seconds;

        emit SetCooldown(_seconds);
    }
    
    /**
     * @notice Pause AMO
     * */
    function pause() external onlyElevatedAccess {
        _pause();
    }

    /**
     * @notice Unpause AMO
     * */
    function unpause() external onlyElevatedAccess {
        _unpause();
    }

    /**
     * @notice Recover any token from AMO
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverToken(address token, address to, uint256 amount) external onlyElevatedAccess {
        IERC20(token).safeTransfer(to, amount);

        emit RecoveredToken(token, to, amount);
    }

    /**
     * @notice Rebalance up when `protocolToken` spot price is below TPI.
     * Single-side WITHDRAW `protocolToken` from balancer liquidity pool to raise price.
     * BPT tokens are withdrawn from Aura rewards staking contract and used for balancer
     * pool exit. 
     * Ramos rebalance fees are deducted from the amount of `protocolToken` returned from the balancer pool
     * The remainder `protocolToken` are repaid to the `protocolTokenVault`
     * @param bptAmountIn amount of BPT tokens going in balancer pool for exit
     * @param minProtocolTokenOut amount of `protocolToken` expected out of balancer pool
     */
    function rebalanceUpExit(
        uint256 bptAmountIn,
        uint256 minProtocolTokenOut
    ) external override onlyElevatedAccess whenNotPaused enoughCooldown {
        _validateParams(minProtocolTokenOut, bptAmountIn, maxRebalanceAmounts.bpt);
        lastRebalanceTimeSecs = uint64(block.timestamp);

        // Unstake and send the BPT to the poolHelper
        amoStaking.withdrawAndUnwrap(bptAmountIn, false, address(poolHelper));
    
        // protocolToken single side exit
        uint256 protocolTokenAmountOut = poolHelper.exitPool(
            bptAmountIn, minProtocolTokenOut, rebalancePercentageBoundLow,
            rebalancePercentageBoundUp, postRebalanceSlippage,
            protocolTokenBalancerPoolIndex, treasuryPriceIndex(), protocolToken
        );
        emit RebalanceUpExit(bptAmountIn, protocolTokenAmountOut);

        // Collect the fees on the output protocol token
        uint256 feeAmt = protocolTokenAmountOut * rebalanceFees.rebalanceExitFeeBps / BPS_PRECISION;
        if (feeAmt != 0) {
            protocolToken.safeTransfer(feeCollector, feeAmt);
        }

        // Repay the remaining protocol tokens withdrawn from the pool
        protocolTokenVault.repayProtocolToken(protocolTokenAmountOut-feeAmt);
    }

    /**
     * @notice Rebalance down when `protocolToken` spot price is above TPI.
     * Single-side WITHDRAW `quoteToken` from balancer liquidity pool to lower price.
     * BPT tokens are withdrawn from Aura rewards staking contract and used for balancer
     * pool exit. 
     * Ramos rebalance fees are deducted from the amount of `quoteToken` returned from the exit
     * The remainder `quoteToken` are repaid to the recipient
     * @param bptAmountIn Amount of BPT tokens to deposit into balancer pool
     * @param minQuoteTokenAmountOut Minimum amount of `quoteToken` expected to receive
     * @param recipient Address to which the `quoteToken` withdrawn are transferred
     */
    function rebalanceDownExit(
        uint256 bptAmountIn,
        uint256 minQuoteTokenAmountOut,
        address recipient
    ) external override onlyElevatedAccess whenNotPaused enoughCooldown {
        _validateParams(minQuoteTokenAmountOut, bptAmountIn, maxRebalanceAmounts.bpt);
        lastRebalanceTimeSecs = uint64(block.timestamp);

        // Unstake and send the BPT to the poolHelper
        amoStaking.withdrawAndUnwrap(bptAmountIn, false, address(poolHelper));

        // QuoteToken single side exit
        uint256 quoteTokenAmountOut = poolHelper.exitPool(
            bptAmountIn, minQuoteTokenAmountOut, rebalancePercentageBoundLow, rebalancePercentageBoundUp,
            postRebalanceSlippage, 1-protocolTokenBalancerPoolIndex, treasuryPriceIndex(), quoteToken
        );
        emit RebalanceDownExit(bptAmountIn, quoteTokenAmountOut, recipient);

        // Collect the fees on the output quote token
        uint256 feeAmt = quoteTokenAmountOut * rebalanceFees.rebalanceExitFeeBps / BPS_PRECISION;
        if (feeAmt != 0) {
            quoteToken.safeTransfer(feeCollector, feeAmt);
        }

        if (recipient != address(this) && recipient != address(0)) {
            uint256 quoteTokenBalance = quoteToken.balanceOf(address(this));
            quoteToken.safeTransfer(recipient, quoteTokenBalance);
        }
    }

    /**
     * @notice Rebalance up when `protocolToken` spot price is below TPI.
     * Single-side ADD `quoteToken` into the balancer liquidity pool to raise price.
     * Returned BPT tokens are deposited and staked into Aura for rewards using the staking contract.
     * Ramos rebalance fees are deducted from the amount of `quoteToken` input
     * The remainder `quoteToken` are added into the balancer pool
     * @dev The `quoteToken` amount must be deposited into this contract first
     * @param quoteTokenAmountIn Amount of `quoteToken` to deposit into balancer pool
     * @param minBptOut Minimum amount of BPT tokens expected to receive
     */
    function rebalanceUpJoin(
        uint256 quoteTokenAmountIn,
        uint256 minBptOut
    ) external override onlyElevatedAccess whenNotPaused enoughCooldown {
        _validateParams(minBptOut, quoteTokenAmountIn, maxRebalanceAmounts.quoteToken);
        lastRebalanceTimeSecs = uint64(block.timestamp);

        // Collect the fees from the input quote token
        uint256 feeAmt = quoteTokenAmountIn * rebalanceFees.rebalanceJoinFeeBps / BPS_PRECISION;
        if (feeAmt != 0) {
            quoteToken.safeTransfer(feeCollector, feeAmt);
        }

        // Send the remaining quote tokens to the poolHelper
        uint256 joinAmountIn = quoteTokenAmountIn - feeAmt;
        quoteToken.safeTransfer(address(poolHelper), joinAmountIn);

        // quoteToken single side join
        uint256 bptOut = poolHelper.joinPool(
            joinAmountIn, minBptOut, rebalancePercentageBoundUp, rebalancePercentageBoundLow,
            treasuryPriceIndex(), postRebalanceSlippage, 1-protocolTokenBalancerPoolIndex, quoteToken
        );
        emit RebalanceUpJoin(quoteTokenAmountIn, bptOut);

        // deposit and stake BPT
        bptToken.safeTransfer(address(amoStaking), bptOut);
        amoStaking.depositAndStake(bptOut);
    }

    /**
     * @notice Rebalance down when `protocolToken` spot price is above TPI.
     * Single-side ADD `protocolToken` into the balancer liquidity pool to lower price.
     * Returned BPT tokens are deposited and staked into Aura for rewards using the staking contract.
     * Ramos rebalance fees are deducted from the amount of `protocolToken` input
     * The remainder `protocolToken` are added into the balancer pool
     * @dev The `protocolToken` are borrowed from the `protocolTokenVault`
     * @param protocolTokenAmountIn Amount of `protocolToken` tokens to deposit into balancer pool
     * @param minBptOut Minimum amount of BPT tokens expected to receive
     */
    function rebalanceDownJoin(
        uint256 protocolTokenAmountIn,
        uint256 minBptOut
    ) external override onlyElevatedAccess whenNotPaused enoughCooldown {
        _validateParams(minBptOut, protocolTokenAmountIn, maxRebalanceAmounts.protocolToken);
        lastRebalanceTimeSecs = uint64(block.timestamp);

        // Borrow the protocol token
        protocolTokenVault.borrowProtocolToken(protocolTokenAmountIn, address(this));

        // Collect the fees from the input protocol token amount
        uint256 feeAmt = protocolTokenAmountIn * rebalanceFees.rebalanceJoinFeeBps / BPS_PRECISION;
        if (feeAmt != 0) {
            protocolToken.safeTransfer(feeCollector, feeAmt);
        }

        // Send the balance to the poolHelper
        uint256 joinAmountIn = protocolTokenAmountIn - feeAmt;
        protocolToken.safeTransfer(address(poolHelper), joinAmountIn);

        // protocolToken single side join
        uint256 bptOut = poolHelper.joinPool(
            joinAmountIn, minBptOut, rebalancePercentageBoundUp,
            rebalancePercentageBoundLow, treasuryPriceIndex(), 
            postRebalanceSlippage, protocolTokenBalancerPoolIndex, protocolToken
        );
        emit RebalanceDownJoin(protocolTokenAmountIn, bptOut);

        // deposit and stake BPT
        bptToken.safeTransfer(address(amoStaking), bptOut);
        amoStaking.depositAndStake(bptOut);
    }

    /**
     * @notice Get the quote used to add liquidity proportionally
     * @dev Since this is not the view function, this should be called with `callStatic`
     */
    function proportionalAddLiquidityQuote(
        uint256 quoteTokenAmount,
        uint256 slippageBps
    ) external override returns (
        uint256 protocolTokenAmount,
        uint256 expectedBptAmount,
        uint256 minBptAmount,
        IBalancerVault.JoinPoolRequest memory requestData
    ) {
        return poolHelper.proportionalAddLiquidityQuote(quoteTokenAmount, slippageBps);
    }

    /**
     * @notice Add liquidity with both `protocolToken` and `quoteToken` into balancer pool. 
     * TPI is expected to be within bounds of multisig set range.
     * BPT tokens are then deposited and staked in Aura.
     * @param request Request data for joining balancer pool. Assumes userdata of request is
     * encoded with EXACT_TOKENS_IN_FOR_BPT_OUT type
     */
    function addLiquidity(
        IBalancerVault.JoinPoolRequest memory request
    ) external override onlyElevatedAccess {
        // validate request
        if (request.assets.length != request.maxAmountsIn.length || 
            request.assets.length != 2 || 
            request.fromInternalBalance == true) {
                revert AMOCommon.InvalidBalancerVaultRequest();
        }

        (uint256 protocolTokenAmount, uint256 quoteTokenAmount) = protocolTokenBalancerPoolIndex == 0
            ? (request.maxAmountsIn[0], request.maxAmountsIn[1])
            : (request.maxAmountsIn[1], request.maxAmountsIn[0]);
        protocolTokenVault.borrowProtocolToken(protocolTokenAmount, address(this));

        // safe allowance quoteToken and protocolToken
        {
            protocolToken.safeIncreaseAllowance(address(balancerVault), protocolTokenAmount);
            uint256 quoteTokenAllowance = quoteToken.allowance(address(this), address(balancerVault));
            if (quoteTokenAllowance < quoteTokenAmount) {
                quoteToken.safeApprove(address(balancerVault), 0);
                quoteToken.safeIncreaseAllowance(address(balancerVault), quoteTokenAmount);
            }
        }

        // join pool
        uint256 bptIn;
        {
            uint256 bptAmountBefore = bptToken.balanceOf(address(this));
            balancerVault.joinPool(balancerPoolId, address(this), address(this), request);
            uint256 bptAmountAfter = bptToken.balanceOf(address(this));
            unchecked {
                bptIn = bptAmountAfter - bptAmountBefore;
            }
        }

        // stake BPT
        bptToken.safeTransfer(address(amoStaking), bptIn);
        amoStaking.depositAndStake(bptIn);

        emit LiquidityAdded(quoteTokenAmount, protocolTokenAmount, bptIn);
    }

    /**
     * @notice Get the quote used to remove liquidity
     * @dev Since this is not the view function, this should be called with `callStatic`
     */
    function proportionalRemoveLiquidityQuote(
        uint256 bptAmount,
        uint256 slippageBps
    ) external override returns (
        uint256 expectedProtocolTokenAmount,
        uint256 expectedQuoteTokenAmount,
        uint256 minProtocolTokenAmount,
        uint256 minQuoteTokenAmount,
        IBalancerVault.ExitPoolRequest memory requestData
    ) {
        return poolHelper.proportionalRemoveLiquidityQuote(bptAmount, slippageBps);
    }

    /**
     * @notice Remove liquidity from balancer pool receiving both `protocolToken` and `quoteToken` from balancer pool. 
     * TPI is expected to be within bounds of multisig set range.
     * Withdraw and unwrap BPT tokens from Aura staking and send to balancer pool to receive both tokens.
     * @param request Request for use in balancer pool exit
     * @param bptIn Amount of BPT tokens to send into balancer pool
     * @param to Address to which the `quoteToken` received from balancer pool are transferred
     */
    function removeLiquidity(
        IBalancerVault.ExitPoolRequest memory request,
        uint256 bptIn,
        address to
    ) external override onlyElevatedAccess {
        // validate request
        if (request.assets.length != request.minAmountsOut.length || 
            request.assets.length != 2 || 
            request.toInternalBalance == true) {
                revert AMOCommon.InvalidBalancerVaultRequest();
        }

        uint256 protocolTokenAmountBefore = protocolToken.balanceOf(address(this));
        uint256 quoteTokenAmountBefore = quoteToken.balanceOf(address(this));

        amoStaking.withdrawAndUnwrap(bptIn, false, address(this));

        balancerVault.exitPool(balancerPoolId, address(this), address(this), request);
        // validate amounts received
        uint256 protocolTokenReceivedAmount;
        uint256 quoteTokenReceivedAmount;
        for (uint i=0; i<request.assets.length; ++i) {
            if (request.assets[i] == address(protocolToken)) {
                unchecked {
                    protocolTokenReceivedAmount = protocolToken.balanceOf(address(this)) - protocolTokenAmountBefore;
                }
                if (protocolTokenReceivedAmount != 0) {
                    protocolTokenVault.repayProtocolToken(protocolTokenReceivedAmount);
                }
            } else if (request.assets[i] == address(quoteToken)) {
                unchecked {
                    quoteTokenReceivedAmount = quoteToken.balanceOf(address(this)) - quoteTokenAmountBefore;
                }
                if (quoteTokenReceivedAmount != 0) {
                    quoteToken.safeTransfer(to, quoteTokenReceivedAmount);
                }
            }
        }

        emit LiquidityRemoved(quoteTokenReceivedAmount, protocolTokenReceivedAmount, bptIn);
    }

    /**
     * @notice Allow owner to deposit and stake bpt tokens directly
     * @param amount Amount of Bpt tokens to depositt
     * @param useContractBalance If to use bpt tokens in contract
     */
    function depositAndStakeBptTokens(
        uint256 amount,
        bool useContractBalance
    ) external override onlyElevatedAccess {
        if (!useContractBalance) {
            bptToken.safeTransferFrom(msg.sender, address(this), amount);
        }
        bptToken.safeTransfer(address(amoStaking), amount);
        amoStaking.depositAndStake(amount);
        emit DepositAndStakeBptTokens(amount);
    }

    /**
     * @notice The total amount of `protocolToken` and `quoteToken` that Ramos holds via it's 
     * staked and unstaked BPT.
     * @dev Calculated by pulling the total balances of each token in the pool
     * and getting RAMOS proportion of the owned BPT's
     */
    function positions() external override view returns (
        uint256 bptBalance, 
        uint256 protocolTokenBalance, 
        uint256 quoteTokenBalance
    ) {
        // Use `bpt.getActualSupply()` instead of `bpt.totalSupply()`
        // https://docs.balancer.fi/reference/lp-tokens/underlying.html#overview
        // https://docs.balancer.fi/concepts/advanced/valuing-bpt.html#on-chain
        uint256 bptTotalSupply = bptToken.getActualSupply();
        if (bptTotalSupply != 0) {
            bptBalance = amoStaking.totalBalance();
            (uint256 totalProtocolTokenInLp, uint256 totalQuoteTokenInLp) = poolHelper.getPairBalances();
            protocolTokenBalance = totalProtocolTokenInLp * bptBalance /bptTotalSupply;
            quoteTokenBalance = totalQuoteTokenInLp * bptBalance /bptTotalSupply;
        }
    }

    function _validateParams(
        uint256 minAmountOut,
        uint256 amountIn,
        uint256 maxRebalanceAmount
    ) internal pure {
        if (minAmountOut == 0) {
            revert AMOCommon.ZeroSwapLimit();
        }
        if (amountIn > maxRebalanceAmount) {
            revert AMOCommon.AboveCappedAmount(amountIn);
        }
    }

    modifier enoughCooldown() {
        if (lastRebalanceTimeSecs != 0 && lastRebalanceTimeSecs + cooldownSecs > block.timestamp) {
            revert AMOCommon.NotEnoughCooldown();
        }
        _;
    }
}