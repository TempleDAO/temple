pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (amo/Ramos.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

import { IRamos } from "contracts/interfaces/amo/IRamos.sol";
import { IRamosTokenVault } from "contracts/interfaces/amo/helpers/IRamosTokenVault.sol";
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
    IAuraStaking public immutable override amoStaking;

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

    /// @notice The vault from where to borrow and repay the Protocol & Quote Tokens
    IRamosTokenVault public override tokenVault;

    /// @notice The percentage bounds (in bps) beyond which to rebalance up or down
    uint64 public override rebalancePercentageBoundLow;
    uint64 public override rebalancePercentageBoundUp;

    /// @notice Maximum amount of tokens that can be rebalanced on each run
    MaxRebalanceAmounts public override maxRebalanceAmounts;

    /// @notice A limit on how much the price can be impacted by a rebalance. 
    /// A price change over this limit will revert. Specified in bps
    uint64 public override postRebalanceDelta;

    /// @notice `protocolToken` index in balancer pool. to avoid recalculation or external calls
    uint64 public immutable override protocolTokenBalancerPoolIndex;

    /// @notice The address to send proportion of rebalance as fees to
    address public override feeCollector;

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
        feeCollector = _feeCollector;

        if (_maxRebalanceFee > BPS_PRECISION) {
            revert AMOCommon.InvalidBPSValue(_maxRebalanceFee);
        }
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
     * @notice Set the acceptable amount of price impact allowed due to a rebalance
     */
    function setPostRebalanceDelta(uint64 deltaBps) external onlyElevatedAccess {
        if (deltaBps > BPS_PRECISION || deltaBps == 0) {
            revert AMOCommon.InvalidBPSValue(deltaBps);
        }
        postRebalanceDelta = deltaBps;
        emit SetPostRebalanceDelta(deltaBps);
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
     * @notice Set the token vault - where to borrow and repay the Protocol & Quote Tokens
     */
    function setTokenVault(address vault) external override onlyElevatedAccess {
        emit TokenVaultSet(vault);

        // Remove allowance from the old vault
        address previousVault = address(tokenVault);
        if (previousVault != address(0)) {
            protocolToken.approve(previousVault, 0);
            quoteToken.approve(previousVault, 0);
        }

        tokenVault = IRamosTokenVault(vault);

        // Set max allowance on the new TRV
        {
            protocolToken.forceApprove(vault, type(uint256).max);
            
            quoteToken.forceApprove(vault, type(uint256).max);
        }
    }

    /**
     * @notice Update the fee collector address - only callable by the existing feeCollector
     */
    function setFeeCollector(address _feeCollector) external {
        if (msg.sender != feeCollector) revert CommonEventsAndErrors.InvalidAccess();
        if (_feeCollector == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        feeCollector = _feeCollector;
        emit FeeCollectorSet(_feeCollector);
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
    function treasuryPriceIndex() public view override returns (uint96) {
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
     * The remainder `protocolToken` are repaid to the `tokenVault`
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
        IBalancerPoolHelper _poolHelper = poolHelper;
        amoStaking.withdrawAndUnwrap(bptAmountIn, false, address(_poolHelper));
    
        // protocolToken single side exit
        uint256 protocolTokenAmountOut = _poolHelper.exitPool(
            bptAmountIn, minProtocolTokenOut, rebalancePercentageBoundLow,
            rebalancePercentageBoundUp, postRebalanceDelta,
            protocolTokenBalancerPoolIndex, treasuryPriceIndex(), protocolToken
        );

        // Collect the fees on the output protocol token
        uint256 feeAmt = protocolTokenAmountOut * rebalanceFees.rebalanceExitFeeBps / BPS_PRECISION;
        if (feeAmt > 0) {
            protocolToken.safeTransfer(feeCollector, feeAmt);
        }

        // Repay the remaining protocol tokens withdrawn from the pool
        unchecked {
            protocolTokenAmountOut -= feeAmt;
        }
        emit RebalanceUpExit(bptAmountIn, protocolTokenAmountOut, feeAmt);
        if (protocolTokenAmountOut > 0) {
            tokenVault.repayProtocolToken(protocolTokenAmountOut);
        }
    }

    /**
     * @notice Rebalance down when `protocolToken` spot price is above TPI.
     * Single-side WITHDRAW `quoteToken` from balancer liquidity pool to lower price.
     * BPT tokens are withdrawn from Aura rewards staking contract and used for balancer
     * pool exit. 
     * Ramos rebalance fees are deducted from the amount of `quoteToken` returned from the exit
     * The remainder `quoteToken` are repaid via the token vault
     * @param bptAmountIn Amount of BPT tokens to deposit into balancer pool
     * @param minQuoteTokenAmountOut Minimum amount of `quoteToken` expected to receive
     */
    function rebalanceDownExit(
        uint256 bptAmountIn,
        uint256 minQuoteTokenAmountOut
    ) external override onlyElevatedAccess whenNotPaused enoughCooldown {
        _validateParams(minQuoteTokenAmountOut, bptAmountIn, maxRebalanceAmounts.bpt);
        lastRebalanceTimeSecs = uint64(block.timestamp);

        // Unstake and send the BPT to the poolHelper
        IBalancerPoolHelper _poolHelper = poolHelper;
        amoStaking.withdrawAndUnwrap(bptAmountIn, false, address(_poolHelper));

        // QuoteToken single side exit
        uint256 quoteTokenAmountOut = _poolHelper.exitPool(
            bptAmountIn, minQuoteTokenAmountOut, rebalancePercentageBoundLow, rebalancePercentageBoundUp,
            postRebalanceDelta, 1-protocolTokenBalancerPoolIndex, treasuryPriceIndex(), quoteToken
        );

        // Collect the fees on the output quote token
        uint256 feeAmt = quoteTokenAmountOut * rebalanceFees.rebalanceExitFeeBps / BPS_PRECISION;
        if (feeAmt > 0) {
            quoteToken.safeTransfer(feeCollector, feeAmt);
        }

        unchecked {
            quoteTokenAmountOut -= feeAmt;
        }
        emit RebalanceDownExit(bptAmountIn, quoteTokenAmountOut, feeAmt);
        if (quoteTokenAmountOut > 0) {
            tokenVault.repayQuoteToken(quoteTokenAmountOut);
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

        // Borrow the quote token
        tokenVault.borrowQuoteToken(quoteTokenAmountIn, address(this));

        // Collect the fees from the input quote token
        uint256 feeAmt = quoteTokenAmountIn * rebalanceFees.rebalanceJoinFeeBps / BPS_PRECISION;
        if (feeAmt > 0) {
            quoteToken.safeTransfer(feeCollector, feeAmt);
        }

        // Send the remaining quote tokens to the poolHelper
        uint256 joinAmountIn = quoteTokenAmountIn - feeAmt;
        IBalancerPoolHelper _poolHelper = poolHelper;
        quoteToken.safeTransfer(address(_poolHelper), joinAmountIn);

        // quoteToken single side join
        uint256 bptTokensStaked = _poolHelper.joinPool(
            joinAmountIn, minBptOut, rebalancePercentageBoundUp, rebalancePercentageBoundLow,
            treasuryPriceIndex(), postRebalanceDelta, 1-protocolTokenBalancerPoolIndex, quoteToken
        );
        emit RebalanceUpJoin(quoteTokenAmountIn, bptTokensStaked, feeAmt);

        // deposit and stake BPT
        if (bptTokensStaked > 0) {
            bptToken.safeTransfer(address(amoStaking), bptTokensStaked);
            amoStaking.depositAndStake(bptTokensStaked);
        }
    }

    /**
     * @notice Rebalance down when `protocolToken` spot price is above TPI.
     * Single-side ADD `protocolToken` into the balancer liquidity pool to lower price.
     * Returned BPT tokens are deposited and staked into Aura for rewards using the staking contract.
     * Ramos rebalance fees are deducted from the amount of `protocolToken` input
     * The remainder `protocolToken` are added into the balancer pool
     * @dev The `protocolToken` are borrowed from the `tokenVault`
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
        tokenVault.borrowProtocolToken(protocolTokenAmountIn, address(this));

        // Collect the fees from the input protocol token amount
        uint256 feeAmt = protocolTokenAmountIn * rebalanceFees.rebalanceJoinFeeBps / BPS_PRECISION;
        if (feeAmt > 0) {
            protocolToken.safeTransfer(feeCollector, feeAmt);
        }

        // Send the balance to the poolHelper
        uint256 joinAmountIn = protocolTokenAmountIn - feeAmt;
        IBalancerPoolHelper _poolHelper = poolHelper;
        protocolToken.safeTransfer(address(_poolHelper), joinAmountIn);

        // protocolToken single side join
        uint256 bptTokensStaked = _poolHelper.joinPool(
            joinAmountIn, minBptOut, rebalancePercentageBoundUp,
            rebalancePercentageBoundLow, treasuryPriceIndex(), 
            postRebalanceDelta, protocolTokenBalancerPoolIndex, protocolToken
        );
        emit RebalanceDownJoin(protocolTokenAmountIn, bptTokensStaked, feeAmt);

        // deposit and stake BPT
        if (bptTokensStaked > 0) {
            bptToken.safeTransfer(address(amoStaking), bptTokensStaked);
            amoStaking.depositAndStake(bptTokensStaked);
        }
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
    ) external override onlyElevatedAccess returns (
        uint256 quoteTokenAmount,
        uint256 protocolTokenAmount,
        uint256 bptTokensStaked
    ) {
        // validate request
        if (request.assets.length != request.maxAmountsIn.length || 
            request.assets.length != 2 || 
            request.fromInternalBalance) {
                revert AMOCommon.InvalidBalancerVaultRequest();
        }

        (protocolTokenAmount, quoteTokenAmount) = protocolTokenBalancerPoolIndex == 0
            ? (request.maxAmountsIn[0], request.maxAmountsIn[1])
            : (request.maxAmountsIn[1], request.maxAmountsIn[0]);

        IRamosTokenVault _tokenVault = tokenVault;
        _tokenVault.borrowProtocolToken(protocolTokenAmount, address(this));
        _tokenVault.borrowQuoteToken(quoteTokenAmount, address(this));

        // safe allowance quoteToken and protocolToken
        {
            protocolToken.safeIncreaseAllowance(address(balancerVault), protocolTokenAmount);
            uint256 quoteTokenAllowance = quoteToken.allowance(address(this), address(balancerVault));
            if (quoteTokenAllowance < quoteTokenAmount) {
                quoteToken.approve(address(balancerVault), 0);
                quoteToken.safeIncreaseAllowance(address(balancerVault), quoteTokenAmount);
            }
        }

        // join pool
        {
            uint256 bptAmountBefore = bptToken.balanceOf(address(this));
            balancerVault.joinPool(balancerPoolId, address(this), address(this), request);
            uint256 bptAmountAfter = bptToken.balanceOf(address(this));
            unchecked {
                bptTokensStaked = bptAmountAfter - bptAmountBefore;
            }
        }

        emit LiquidityAdded(quoteTokenAmount, protocolTokenAmount, bptTokensStaked);

        // stake BPT
        if (bptTokensStaked > 0) {
            bptToken.safeTransfer(address(amoStaking), bptTokensStaked);
            amoStaking.depositAndStake(bptTokensStaked);
        }
    }

    /**
     * @notice Remove liquidity from balancer pool receiving both `protocolToken` and `quoteToken` from balancer pool. 
     * TPI is expected to be within bounds of multisig set range.
     * Withdraw and unwrap BPT tokens from Aura staking and send to balancer pool to receive both tokens.
     * @param request Request for use in balancer pool exit
     * @param bptIn Amount of BPT tokens to send into balancer pool
     */
    function removeLiquidity(
        IBalancerVault.ExitPoolRequest memory request,
        uint256 bptIn
    ) external override onlyElevatedAccess returns (
        uint256 quoteTokenAmount, 
        uint256 protocolTokenAmount
    ) {
        // validate request
        if (
            request.assets.length != request.minAmountsOut.length || 
            request.assets.length != 2 || 
            request.toInternalBalance
        ) {
            revert AMOCommon.InvalidBalancerVaultRequest();
        }

        uint256 protocolTokenAmountBefore = protocolToken.balanceOf(address(this));
        uint256 quoteTokenAmountBefore = quoteToken.balanceOf(address(this));

        amoStaking.withdrawAndUnwrap(bptIn, false, address(this));
        balancerVault.exitPool(balancerPoolId, address(this), address(this), request);

        unchecked {
            protocolTokenAmount = protocolToken.balanceOf(address(this)) - protocolTokenAmountBefore;
            quoteTokenAmount = quoteToken.balanceOf(address(this)) - quoteTokenAmountBefore;
        }

        IRamosTokenVault _tokenVault = tokenVault;
        if (protocolTokenAmount > 0) {
            _tokenVault.repayProtocolToken(protocolTokenAmount);
        }

        if (quoteTokenAmount > 0) {
            _tokenVault.repayQuoteToken(quoteTokenAmount);
        }

        emit LiquidityRemoved(quoteTokenAmount, protocolTokenAmount, bptIn);
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
        // https://docs.balancer.fi/concepts/advanced/valuing-bpt/valuing-bpt.html#on-chain
        uint256 bptTotalSupply = bptToken.getActualSupply();
        if (bptTotalSupply > 0) {
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
        if (lastRebalanceTimeSecs + cooldownSecs > block.timestamp) {
            revert AMOCommon.NotEnoughCooldown();
        }
        _;
    }
}