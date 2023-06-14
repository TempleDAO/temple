pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/amo/IRamos.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IBalancerVault } from "contracts/interfaces/external/balancer/IBalancerVault.sol";
import { IBalancerBptToken } from "contracts/interfaces/external/balancer/IBalancerBptToken.sol";
import { IBalancerPoolHelper } from "contracts/interfaces/amo/helpers/IBalancerPoolHelper.sol";
import { IAuraStaking } from "contracts/interfaces/external/aura/IAuraStaking.sol";
import { ITreasuryPriceIndexOracle } from "contracts/interfaces/v2/ITreasuryPriceIndexOracle.sol";
import { IRamosProtocolTokenVault } from "contracts/interfaces/amo/helpers/IRamosProtocolTokenVault.sol";

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
interface IRamos {
    struct MaxRebalanceAmounts {
        uint256 bpt;
        uint256 quoteToken;
        uint256 protocolToken;
    }

    event RecoveredToken(address token, address to, uint256 amount);
    event SetPostRebalanceSlippage(uint64 slippageBps);
    event SetCooldown(uint64 cooldownSecs);
    event SetPauseState(bool paused);
    event QuoteTokenDeposited(uint256 amountIn, uint256 bptOut);
    event RebalanceUp(uint256 bptAmountIn, uint256 protocolTokenAmountOut);
    event RebalanceDown(uint256 protocolTokenAmountIn, uint256 bptOut);
    event SetPoolHelper(address poolHelper);
    event SetMaxRebalanceAmounts(uint256 bptMaxAmount, uint256 quoteTokenMaxAmount, uint256 protocolTokenMaxAmount);
    event WithdrawQuoteToken(uint256 bptAmountIn, uint256 amountOut, address to);
    event LiquidityAdded(uint256 quoteTokenAdded, uint256 protocolTokenAdded, uint256 bptReceived);
    event LiquidityRemoved(uint256 quoteTokenReceived, uint256 protocolTokenReceived, uint256 bptRemoved);
    event SetRebalancePercentageBounds(uint64 belowTpi, uint64 aboveTpi);
    event SetTreasuryReservesVault(address indexed trv);
    event SetAmoStaking(address indexed amoStaking);
    event DepositAndStakeBptTokens(uint256 bptAmount);
    event TpiOracleSet(address indexed tpiOracle);
    event ProtocolTokenVaultSet(address indexed vault);

    /// @notice The Balancer vault singleton
    function balancerVault() external view returns (IBalancerVault);

    /// @notice BPT token address for this LP
    function bptToken() external view returns (IBalancerBptToken);

    /// @notice Balancer pool helper contract
    function poolHelper() external view returns (IBalancerPoolHelper);

    /// @notice AMO contract for staking into aura 
    function amoStaking() external view returns (IAuraStaking);
  
    /// @notice The Protocol token  
    function protocolToken() external view returns (IERC20);

    /// @notice The quoteToken this is paired with in the LP. It may be a stable, 
    /// or another Balancer linear token like BB-A-USD
    function quoteToken() external view returns (IERC20);

    /// @notice The time when the last rebalance occured
    function lastRebalanceTimeSecs() external view returns (uint64);

    /// @notice The minimum amount of time which must pass since `lastRebalanceTimeSecs` before another rebalance
    /// can occur
    function cooldownSecs() external view returns (uint64);

    /// @notice The balancer 50/50 pool ID.
    function balancerPoolId() external view returns (bytes32);

    /// @notice Precision for BPS calculations. 1% == 100
    // solhint-disable-next-line func-name-mixedcase
    function BPS_PRECISION() external view returns (uint256);

    /// @notice The percentage bounds (in bps) beyond which to rebalance up or down
    function rebalancePercentageBoundLow() external view returns (uint64);
    function rebalancePercentageBoundUp() external view returns (uint64);

    /// @notice Maximum amount of tokens that can be rebalanced on each run
    function maxRebalanceAmounts() external view returns (
        uint256 bpt,
        uint256 quoteToken,
        uint256 protocolToken
    );

    /// @notice A limit on how much the price can be impacted by a rebalance. 
    /// A price change over this limit will revert. Specified in bps
    function postRebalanceSlippage() external view returns (uint64);

    /// @notice protocolToken index in balancer pool. to avoid recalculation or external calls
    function protocolTokenBalancerPoolIndex() external view returns (uint64);

    /**
     * @notice The Treasury Price Index (TPI) Oracle
     */
    function tpiOracle() external view returns (ITreasuryPriceIndexOracle);

    /**
     * @notice Set the Treasury Price Index (TPI) Oracle
     */
    function setTpiOracle(address tpiOracleAddress) external;

    /**
     * @notice The vault from where to borrow and repay the Protocol Token
     */
    function protocolTokenVault() external view returns (IRamosProtocolTokenVault);

    /**
     * @notice Set the Treasury Price Index (TPI) Oracle
     */
    function setProtocolTokenVault(address vault) external;

    /**
     * @notice The Treasury Price Index - the target price of the Treasury, in `quoteTokenToken` terms.
     */
    function treasuryPriceIndex() external view returns (uint256);

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
    ) external;

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
    ) external;

    /**
     * @notice Single-side deposit `quoteToken` into balancer pool when `protocolToken` price 
     * is below Treasury Price Index.
     * @param amountIn Amount of `quoteToken` to deposit into balancer pool
     * @param minBptOut Minimum amount of BPT tokens expected to receive
     */
    function depositQuoteToken(
        uint256 amountIn,
        uint256 minBptOut
    ) external;

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
    ) external;

    /// @notice Get the quote used to add liquidity proportionally
    /// @dev Since this is not the view function, this should be called with `callStatic`
    function proportionalAddLiquidityQuote(
        uint256 quoteTokenAmount,
        uint256 slippageBps
    ) external returns (
        uint256 protocolTokenAmount,
        uint256 expectedBptAmount,
        uint256 minBptAmount,
        IBalancerVault.JoinPoolRequest memory requestData
    );

    /**
     * @notice Add liquidity with both `protocolToken` and `quoteToken` into balancer pool. 
     * TPI is expected to be within bounds of multisig set range.
     * BPT tokens are then deposited and staked in Aura.
     * @param request Request data for joining balancer pool. Assumes userdata of request is
     * encoded with EXACT_TOKENS_IN_FOR_BPT_OUT type
     */
    function addLiquidity(
        IBalancerVault.JoinPoolRequest memory request
    ) external;

    /// @notice Get the quote used to remove liquidity
    /// @dev Since this is not the view function, this should be called with `callStatic`
    function proportionalRemoveLiquidityQuote(
        uint256 bptAmount,
        uint256 slippageBps
    ) external returns (
        uint256 expectedProtocolTokenAmount,
        uint256 expectedQuoteTokenAmount,
        uint256 minProtocolTokenAmount,
        uint256 minQuoteTokenAmount,
        IBalancerVault.ExitPoolRequest memory requestData
    );
    
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
    ) external;

    /**
     * @notice Allow owner to deposit and stake bpt tokens directly
     * @param amount Amount of Bpt tokens to depositt
     * @param useContractBalance If to use bpt tokens in contract
     */
    function depositAndStakeBptTokens(
        uint256 amount,
        bool useContractBalance
    ) external;

    /**
     * @notice The total amount of `protocolToken` and `quoteToken` that Ramos holds via it's 
     * staked and unstaked BPT.
     * @dev Calculated by pulling the total balances of each token in the pool
     * and getting RAMOS proportion of the owned BPT's
     */
    function positions() external view returns (
        uint256 bptBalance, 
        uint256 protoclTokenBalance, 
        uint256 quoteTokenBalance
    );
}