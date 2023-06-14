pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (amo/Ramos.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

import { IRamos } from "contracts/interfaces/amo/IRamos.sol";
import { IRamosProtocolTokenVault } from "contracts/interfaces/amo/helpers/IRamosProtocolTokenVault.sol";
import { ITreasuryPriceIndexOracle } from "contracts/interfaces/v2/ITreasuryPriceIndexOracle.sol";
import { IBalancerPoolHelper } from "contracts/interfaces/amo/helpers/IBalancerPoolHelper.sol";
import { IBalancerVault } from "contracts/interfaces/external/balancer/IBalancerVault.sol";
import { IAuraStaking } from "contracts/interfaces/external/aura/IAuraStaking.sol";
import { IBalancerBptToken } from "contracts/interfaces/external/balancer/IBalancerBptToken.sol";

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
        address _tpiOracle
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor) {
        balancerVault = IBalancerVault(_balancerVault);
        protocolToken = IERC20(_protocolToken);
        quoteToken = IERC20(_quoteToken);
        bptToken = IBalancerBptToken(_bptToken);
        amoStaking = IAuraStaking(_amoStaking);
        protocolTokenBalancerPoolIndex = _protocolTokenIndexInPool;
        balancerPoolId = _balancerPoolId;
        tpiOracle = ITreasuryPriceIndexOracle(_tpiOracle);
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
     * @notice Rebalance when `protocolToken` spot price is below TPI.
     * Single-side withdraw `protocolToken` from balancer liquidity pool to raise price.
     * BPT tokens are withdrawn from Aura rewards staking contract and used for balancer
     * pool exit. `protocolToken` returned from balancer pool are burned
     * @param bptAmountIn amount of BPT tokens going in balancer pool for exit
     * @param minAmountOut amount of `protocolToken` expected out of balancer pool
     */
    function rebalanceUp(
        uint256 bptAmountIn,
        uint256 minAmountOut
    ) external override onlyElevatedAccess whenNotPaused enoughCooldown {
        _validateParams(minAmountOut, bptAmountIn, maxRebalanceAmounts.bpt);

        amoStaking.withdrawAndUnwrap(bptAmountIn, false, address(poolHelper));
    
        uint256 burnAmount = poolHelper.exitPool(
            bptAmountIn, minAmountOut, rebalancePercentageBoundLow,
            rebalancePercentageBoundUp, postRebalanceSlippage,
            protocolTokenBalancerPoolIndex, treasuryPriceIndex(), protocolToken
        );

        protocolTokenVault.repayProtocolToken(burnAmount);

        lastRebalanceTimeSecs = uint64(block.timestamp);
        emit RebalanceUp(bptAmountIn, burnAmount);
    }

    /**
     * @notice Rebalance when `protocolToken` spot price is above TPI
     * Mints `protocolToken` and single-side deposits into balancer pool
     * Returned BPT tokens are deposited and staked into Aura for rewards using the staking contract.
     * @param protocolTokenAmountIn Amount of `protocolToken` tokens to deposit into balancer pool
     * @param minBptOut Minimum amount of BPT tokens expected to receive
     */
    function rebalanceDown(
        uint256 protocolTokenAmountIn,
        uint256 minBptOut
    ) external override onlyElevatedAccess whenNotPaused enoughCooldown {
        _validateParams(minBptOut, protocolTokenAmountIn, maxRebalanceAmounts.protocolToken);

        protocolTokenVault.borrowProtocolToken(protocolTokenAmountIn, address(poolHelper));

        uint256 bptIn = poolHelper.joinPool(
            protocolTokenAmountIn, minBptOut, rebalancePercentageBoundUp,
            rebalancePercentageBoundLow, treasuryPriceIndex(), 
            postRebalanceSlippage, protocolTokenBalancerPoolIndex, protocolToken
        );

        lastRebalanceTimeSecs = uint64(block.timestamp);
        emit RebalanceDown(protocolTokenAmountIn, bptIn);

        // deposit and stake BPT
        bptToken.safeTransfer(address(amoStaking), bptIn);
        amoStaking.depositAndStake(bptIn);
    }

    /**
     * @notice Single-side deposit quoteToken tokens into balancer pool when `protocolToken` price 
     * is below Treasury Price Index.
     * @param amountIn Amount of `quoteToken` to deposit into balancer pool
     * @param minBptOut Minimum amount of BPT tokens expected to receive
     */
    function depositQuoteToken(
        uint256 amountIn,
        uint256 minBptOut
    ) external override onlyElevatedAccess whenNotPaused {
        _validateParams(minBptOut, amountIn, maxRebalanceAmounts.quoteToken);

        quoteToken.safeTransfer(address(poolHelper), amountIn);
        // quoteToken join
        uint256 joinTokenIndex = protocolTokenBalancerPoolIndex == 0 ? 1 : 0;
        uint256 bptOut = poolHelper.joinPool(
            amountIn, minBptOut, rebalancePercentageBoundUp, rebalancePercentageBoundLow,
            treasuryPriceIndex(), postRebalanceSlippage, joinTokenIndex, quoteToken
        );

        lastRebalanceTimeSecs = uint64(block.timestamp);

        emit QuoteTokenDeposited(amountIn, bptOut);

        bptToken.safeTransfer(address(amoStaking), bptOut);
        amoStaking.depositAndStake(bptOut);
    }

    /**
     * @notice Single-side withdraw `quoteToken` from balancer pool when `protocolToken` price 
     * is above TPI. Withdraw and unwrap BPT tokens from Aura staking.
     * BPT tokens are then sent into balancer pool for `quoteToken` in return.
     * @param bptAmountIn Amount of BPT tokens to deposit into balancer pool
     * @param minAmountOut Minimum amount of `quoteToken` expected to receive
     * @param to Address to which the `quoteToken` withdrawn are transferred
     */
    function withdrawQuoteToken(
        uint256 bptAmountIn,
        uint256 minAmountOut,
        address to
    ) external override onlyElevatedAccess whenNotPaused {
        _validateParams(minAmountOut, bptAmountIn, maxRebalanceAmounts.bpt);

        amoStaking.withdrawAndUnwrap(bptAmountIn, false, address(poolHelper));

        uint256 quoteTokenIndex = protocolTokenBalancerPoolIndex == 0 ? 1 : 0;
        uint256 amountOut = poolHelper.exitPool(
            bptAmountIn, minAmountOut, rebalancePercentageBoundLow, rebalancePercentageBoundUp,
            postRebalanceSlippage, quoteTokenIndex, treasuryPriceIndex(), quoteToken
        );

        lastRebalanceTimeSecs = uint64(block.timestamp);

        uint256 quoteTokenBalance = quoteToken.balanceOf(address(this));
        if (quoteTokenBalance != 0) quoteToken.safeTransfer(to, quoteTokenBalance);

        emit WithdrawQuoteToken(bptAmountIn, amountOut, to);
    }

    /// @notice Get the quote used to add liquidity proportionally
    /// @dev Since this is not the view function, this should be called with `callStatic`
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

    /// @notice Get the quote used to remove liquidity
    /// @dev Since this is not the view function, this should be called with `callStatic`
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
            protocolTokenBalance = mulDiv(totalProtocolTokenInLp, bptBalance, bptTotalSupply);
            quoteTokenBalance = mulDiv(totalQuoteTokenInLp, bptBalance, bptTotalSupply);
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