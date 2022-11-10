pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/AMO__IPoolHelper.sol";
import "./interfaces/AMO__IAuraBooster.sol";
import "./interfaces/AMO__ITempleERC20Token.sol";
import "./helpers/AMOCommon.sol";
import "./interfaces/AMO__IAuraStaking.sol";

/**
 * @title AMO built for 50TEMPLE-50BB-A-USD balancer pool
 *
 * @dev It has a  convergent price to which it trends called the TPF (Treasury Price Floor).
 * In order to accomplish this when the price is below the TPF it will single side withdraw 
 * BPTs into TEMPLE and burn them and if the price is above the TPF it will 
 * single side deposit TEMPLE into the pool to drop the spot price.
 */
contract TpfAmo is Ownable {
    using SafeERC20 for IERC20;

    AMO__IBalancerVault public immutable balancerVault;
    // @notice BPT token address
    IERC20 public immutable bptToken;
    // @notice Aura booster
    AMO__IAuraBooster public immutable booster;
    // @notice pool helper contract
    AMO__IPoolHelper public poolHelper;
    
    // @notice AMO contract for staking into aura 
    AMO__IAuraStaking public immutable amoStaking;

    address public operator;
    IERC20 public immutable temple;
    IERC20 public immutable stable;

    // If the stable token is a BalancerPoolToken, then erc20 allowances don't need to be set
    // when spent in the Balancer Vault
    // https://github.com/balancer-labs/balancer-v2-monorepo/blob/master/pkg/pool-utils/contracts/BalancerPoolToken.sol#L60
    bool public immutable isStableABalancerPoolToken;

    // @notice lastRebalanceTimeSecs and cooldown used to control call rate 
    // for operator
    uint64 public lastRebalanceTimeSecs;
    uint64 public cooldownSecs;

    // @notice balancer 50/50 pool ID.
    bytes32 public immutable balancerPoolId;

    // @notice Temple price floor denominator
    uint256 public constant BPS_PRECISION = 10_000;

    // @notice Maximum amount of tokens that can be rebalanced
    uint256 public maxRebalanceAmount;

    // @notice by how much TPF slips up or down after rebalancing. In basis points
    uint64 public postRebalanceSlippage;

    // @notice contract paused state
    bool public paused;

    // @notice temple index in balancer pool. to avoid recalculation or external calls
    uint64 public templeBalancerPoolIndex;

    event RecoveredToken(address token, address to, uint256 amount);
    event SetOperator(address operator);
    event SetPostRebalanceSlippage(uint64 slippageBps);
    event SetCooldown(uint64 cooldownSecs);
    event SetPauseState(bool paused);
    event StableDeposited(uint256 amountIn, uint256 bptOut);
    event RebalanceUp(uint256 bptAmountIn, uint256 templeAmountOut);
    event RebalanceDown(uint256 templeAmountIn, uint256 bptIn);
    event SetPoolHelper(address poolHelper);
    event SetMaxRebalanceAmount(uint256 maxRebalanceAmount);
    event WithdrawStable(uint256 bptAmountIn, uint256 minAmountOut);

    constructor(
        address _balancerVault,
        address _temple,
        address _stable,
        bool _isStableABalancerPoolToken,
        address _bptToken,
        address _amoStaking,
        address _booster,
        uint64 _templeIndexInPool,
        bytes32 _balancerPoolId
    ) {
        balancerVault = AMO__IBalancerVault(_balancerVault);
        temple = IERC20(_temple);
        stable = IERC20(_stable);
        isStableABalancerPoolToken = _isStableABalancerPoolToken;
        bptToken = IERC20(_bptToken);
        amoStaking = AMO__IAuraStaking(_amoStaking);
        booster = AMO__IAuraBooster(_booster);
        templeBalancerPoolIndex = _templeIndexInPool;
        balancerPoolId = _balancerPoolId;
    }

    function setPoolHelper(address _poolHelper) external onlyOwner {
        poolHelper = AMO__IPoolHelper(_poolHelper);

        emit SetPoolHelper(_poolHelper);
    }

    function setPostRebalanceSlippage(uint64 slippage) external onlyOwner {
        if (slippage >= BPS_PRECISION || slippage == 0) {
            revert AMOCommon.InvalidBPSValue(slippage);
        }
        postRebalanceSlippage = slippage;
        emit SetPostRebalanceSlippage(slippage);
    }

    /**
     * @notice Set maximum amount used by operator to rebalance
     * @param maxAmount Maximum amount to set
     */
    function setMaxRebalanceAmount(uint256 maxAmount) external onlyOwner {
        maxRebalanceAmount = maxAmount;
        emit SetMaxRebalanceAmount(maxAmount);
    }

    /**
     * @notice Set operator
     * @param _operator New operator
     */
    function setOperator(address _operator) external onlyOwner {
        operator = _operator;

        emit SetOperator(_operator);
    }

    /**
     * @notice Set cooldown time to throttle operator bot
     * @param _seconds Time in seconds between operator calls
     * */
    function setCoolDown(uint64 _seconds) external onlyOwner {
        cooldownSecs = _seconds;

        emit SetCooldown(_seconds);
    }
    
    /**
     * @notice Toggle AMO pause
     * */
    function togglePause() external onlyOwner {
        paused = !paused;

        emit SetPauseState(paused);
    }

    /**
     * @notice Recover any token from AMO
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverToken(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);

        emit RecoveredToken(token, to, amount);
    }

    /**
     * @notice Rebalance when $TEMPLE spot price is below Treasury Price Floor.
     * Single-side withdraw $TEMPLE tokens from balancer liquidity pool to raise price.
     * BPT tokens are withdrawn from Aura rewards staking contract and used for balancer
     * pool exit. TEMPLE tokens returned from balancer pool are burned
     * @param bptAmountIn amount of BPT tokens going in balancer pool for exit
     * @param minAmountOut amount of TEMPLE tokens expected out of balancer pool
     */
    function rebalanceUp(
        uint256 bptAmountIn,
        uint256 minAmountOut
    ) external onlyOperatorOrOwner whenNotPaused enoughCooldown {
        _validateParams(minAmountOut, bptAmountIn);

        // check spot price is below TPF by lower bound
        if (!poolHelper.isSpotPriceBelowTPFLowerBound()) {
            revert AMOCommon.NoRebalanceUp();
        }

        // will exit take price above tpf + upper bound
        // should rarely be the case, but a sanity check nonetheless
        if (poolHelper.willExitTakePriceAboveTPFUpperBound(minAmountOut)) {
            revert AMOCommon.HighSlippage();
        }

        // construct request
        AMO__IBalancerVault.ExitPoolRequest memory exitPoolRequest;
        if (templeBalancerPoolIndex == 0) {
            exitPoolRequest = poolHelper.createPoolExitRequest(address(temple), address(stable), bptAmountIn,
                0, minAmountOut, templeBalancerPoolIndex);
        } else {
            exitPoolRequest = poolHelper.createPoolExitRequest(address(temple), address(stable), bptAmountIn,
                1, minAmountOut, templeBalancerPoolIndex);
        }
        // withdraw bpt tokens
        // NB: No need to approve a balancer pool token when used in the balancer vault.
        amoStaking.withdrawAndUnwrap(bptAmountIn, false, true);

        // execute call and check for sanity
        uint256 templeBalanceBefore = temple.balanceOf(address(this));
        uint256 spotPriceScaledBefore = poolHelper.getSpotPriceScaled();
        balancerVault.exitPool(balancerPoolId, address(this), address(this), exitPoolRequest);
        uint256 templeBalanceAfter = temple.balanceOf(address(this));
        
        // burn
        uint256 burnAmount;
        unchecked {
            burnAmount = templeBalanceAfter - templeBalanceBefore;
        }
        AMO__ITempleERC20Token(address(temple)).burn(burnAmount);

        if (uint64(poolHelper.getSlippage(spotPriceScaledBefore)) > postRebalanceSlippage) {
            revert AMOCommon.HighSlippage();
        }
        lastRebalanceTimeSecs = uint64(block.timestamp);
        emit RebalanceUp(bptAmountIn, burnAmount);
    }

     /**
     * @notice Rebalance when $TEMPLE spot price is above Treasury Price Floor
     * Mints TEMPLE tokens and single-side deposits into balancer pool
     * Returned BPT tokens are deposited and staked into Aura for rewards using the staking contract.
     * @param templeAmountIn Amount of TEMPLE tokens to deposit into balancer pool
     * @param minBptOut Minimum amount of BPT tokens expected to receive
     * 
     */
    function rebalanceDown(
        uint256 templeAmountIn,
        uint256 minBptOut
    ) external onlyOperatorOrOwner whenNotPaused enoughCooldown {
        _validateParams(minBptOut, templeAmountIn);
        
        // check spot price is above TPF
        if (!poolHelper.isSpotPriceAboveTPFUpperBound()) {
            revert AMOCommon.NoRebalanceDown();
        }

        // will join take price below tpf with lower bound
        // should rarely be the case, but a sanity check nonetheless
        if (poolHelper.willJoinTakePriceBelowTPFLowerBound(templeAmountIn)) {
            revert AMOCommon.HighSlippage();
        }

        AMO__ITempleERC20Token(address(temple)).mint(address(this), templeAmountIn);

        // create request
        AMO__IBalancerVault.JoinPoolRequest memory joinPoolRequest;
        if (templeBalancerPoolIndex == 0) {
            joinPoolRequest = poolHelper.createPoolJoinRequest(temple, stable, templeAmountIn, 0, minBptOut);
        } else {
            joinPoolRequest = poolHelper.createPoolJoinRequest(temple, stable, templeAmountIn, 1, minBptOut);
        }

        // approve
        temple.safeIncreaseAllowance(address(balancerVault), templeAmountIn);

        // execute and sanity check
        uint256 bptAmountBefore = bptToken.balanceOf(address(this));
        uint256 spotPriceScaledBefore = poolHelper.getSpotPriceScaled();
        balancerVault.joinPool(balancerPoolId, address(this), address(this), joinPoolRequest);
        uint256 bptAmountAfter = bptToken.balanceOf(address(this));
        uint256 bptIn;
        unchecked {
            bptIn = bptAmountAfter - bptAmountBefore;
        }
        if (bptIn < minBptOut) {
            revert AMOCommon.InsufficientAmountOutPostcall(bptAmountBefore + minBptOut, bptAmountAfter);
        }

        // revert if high slippage after pool join
        if (uint64(poolHelper.getSlippage(spotPriceScaledBefore)) > postRebalanceSlippage) {
            revert AMOCommon.HighSlippage();
        }
        lastRebalanceTimeSecs = uint64(block.timestamp);
        emit RebalanceDown(templeAmountIn, bptIn);

        // deposit and stake BPT
        bptToken.safeTransfer(address(amoStaking), bptIn);
        amoStaking.depositAndStake(bptIn);
    }

    /**
     * @notice Single-side deposit stable tokens into balancer pool when TEMPLE price 
     * is below Treasury Price Floor.
     * @param amountIn Amount of stable tokens to deposit into balancer pool
     * @param minBptOut Minimum amount of BPT tokens expected to receive
     */
    function depositStable(
        uint256 amountIn,
        uint256 minBptOut
    ) external onlyOwner whenNotPaused {
        _validateParams(minBptOut, amountIn);

        // check spot price < TPF
        if(!poolHelper.isSpotPriceBelowTPFLowerBound()) {
            revert AMOCommon.NoRebalanceUp();
        }

        // create request
        AMO__IBalancerVault.JoinPoolRequest memory joinPoolRequest;
        if (templeBalancerPoolIndex == 0) {
            joinPoolRequest = poolHelper.createPoolJoinRequest(temple, stable, amountIn, 1, minBptOut);
        } else {
            joinPoolRequest = poolHelper.createPoolJoinRequest(temple, stable, amountIn, 0, minBptOut);
        }

        // approve stable if not a balancer pool token
        if (!isStableABalancerPoolToken) {
            stable.safeIncreaseAllowance(address(balancerVault), amountIn);
        }
        
        // execute and sanity check
        uint256 bptAmountBefore = bptToken.balanceOf(address(this));
        uint256 spotPriceScaledBefore = poolHelper.getSpotPriceScaled();
        balancerVault.joinPool(balancerPoolId, address(this), address(this), joinPoolRequest);
        uint256 bptAmountAfter = bptToken.balanceOf(address(this));
        uint256 bptOut;
        unchecked {
            bptOut = bptAmountAfter - bptAmountBefore;
        }
        if (bptOut < minBptOut) {
            revert AMOCommon.InsufficientAmountOutPostcall(bptAmountBefore + minBptOut, bptAmountAfter);
        }

        if (uint64(poolHelper.getSlippage(spotPriceScaledBefore)) > postRebalanceSlippage) {
            revert AMOCommon.HighSlippage();
        }

        lastRebalanceTimeSecs = uint64(block.timestamp);

        emit StableDeposited(amountIn, bptOut);

        bptToken.safeTransfer(address(amoStaking), bptOut);
        amoStaking.depositAndStake(bptOut);
    }

     /**
     * @notice Single-side withdraw stable tokens from balancer pool when TEMPLE price 
     * is above Treasury Price Floor. Withdraw and unwrap BPT tokens from Aura staking.
     * BPT tokens are then sent into balancer pool for stable tokens in return.
     * @param bptAmountIn Amount of BPT tokens to deposit into balancer pool
     * @param minAmountOut Minimum amount of stable tokens expected to receive
     */
    function withdrawStable(
        uint256 bptAmountIn,
        uint256 minAmountOut
    ) external onlyOwner whenNotPaused {
        _validateParams(minAmountOut, bptAmountIn);

        // check spot price > TPF
        if (!poolHelper.isSpotPriceAboveTPFUpperBound()) {
            revert AMOCommon.NoRebalanceDown();
        }

        AMO__IBalancerVault.ExitPoolRequest memory exitPoolRequest;
        if (templeBalancerPoolIndex == 0) {
            exitPoolRequest = poolHelper.createPoolExitRequest(address(temple), address(stable), bptAmountIn,
                1, minAmountOut, templeBalancerPoolIndex == 0 ? 1 : 0);
        } else {
            exitPoolRequest = poolHelper.createPoolExitRequest(address(temple), address(stable), bptAmountIn,
                0, minAmountOut, templeBalancerPoolIndex == 0 ? 1 : 0);
        }

        // withdraw and unwrap deposit token to BPT token
        // NB: No need to approve a balancer pool token when used in the balancer vault.
        amoStaking.withdrawAndUnwrap(bptAmountIn, false, true);

        // execute call and check for sanity
        uint256 stableBalanceBefore = stable.balanceOf(address(this));
        uint256 spotPriceScaledBefore = poolHelper.getSpotPriceScaled();
        balancerVault.exitPool(balancerPoolId, address(this), address(this), exitPoolRequest);
        uint256 stableBalanceAfter = stable.balanceOf(address(this));
        if (stableBalanceAfter < stableBalanceBefore + minAmountOut) {
            revert AMOCommon.InsufficientAmountOutPostcall(stableBalanceBefore + minAmountOut, stableBalanceAfter);
        }

        // revert if high slippage after pool join
        if (uint64(poolHelper.getSlippage(spotPriceScaledBefore)) > postRebalanceSlippage) {
            revert AMOCommon.HighSlippage();
        }
        lastRebalanceTimeSecs = uint64(block.timestamp);
        emit WithdrawStable(bptAmountIn, minAmountOut);
    }

    /**
     * @notice Add liquidity with both TEMPLE and stable tokens into balancer pool. 
     * Treasury Price Floor is expected to be within bounds of multisig set range.
     * BPT tokens are then deposited and staked in Aura.
     * @param request Request data for joining balancer pool. Assumes userdata of request is
     * encoded with EXACT_TOKENS_IN_FOR_BPT_OUT type
     * @param minBptOut Minimum amount of BPT tokens expected to receive
     */
    function addLiquidity(
        AMO__IBalancerVault.JoinPoolRequest memory request,
        uint256 minBptOut
    ) external onlyOwner {
        // validate request
        if (request.assets.length != request.maxAmountsIn.length || 
            request.assets.length != 2 || 
            request.fromInternalBalance == true) {
                revert AMOCommon.InvalidBalancerVaultRequest();
        }

        uint256 templeAmount;
        uint256 stableAmount;
        if (templeBalancerPoolIndex == 0) {
            templeAmount = request.maxAmountsIn[0];
            stableAmount = request.maxAmountsIn[1];
        } else {
            templeAmount = request.maxAmountsIn[1];
            stableAmount = request.maxAmountsIn[0];
        }

        AMO__ITempleERC20Token(address(temple)).mint(address(this), templeAmount);

        // safe allowance TEMPLE
        temple.safeIncreaseAllowance(address(balancerVault), templeAmount);

        // approve stable if not a balancer pool token
        if (!isStableABalancerPoolToken) {
            stable.safeIncreaseAllowance(address(balancerVault), stableAmount);
        }

        // join pool
        uint256 bptAmountBefore = bptToken.balanceOf(address(this));
        balancerVault.joinPool(balancerPoolId, address(this), address(this), request);
        uint256 bptAmountAfter = bptToken.balanceOf(address(this));
        uint256 bptIn;
        unchecked {
            bptIn = bptAmountAfter - bptAmountBefore;
        }
        if (bptIn < minBptOut) {
            revert AMOCommon.InsufficientAmountOutPostcall(minBptOut, bptIn);
        }

        // stake BPT
        bptToken.safeTransfer(address(amoStaking), bptIn);
        amoStaking.depositAndStake(bptIn);
    }

    /**
     * @notice Remove liquidity from balancer pool receiving both TEMPLE and stable tokens from balancer pool. 
     * Treasury Price Floor is expected to be within bounds of multisig set range.
     * Withdraw and unwrap BPT tokens from Aura staking and send to balancer pool to receive both tokens.
     * @param request Request for use in balancer pool exit
     * @param bptIn Amount of BPT tokens to send into balancer pool
     */
    function removeLiquidity(
        AMO__IBalancerVault.ExitPoolRequest memory request,
        uint256 bptIn
    ) external onlyOwner {
        // validate request
        if (request.assets.length != request.minAmountsOut.length || 
            request.assets.length != 2 || 
            request.toInternalBalance == true) {
                revert AMOCommon.InvalidBalancerVaultRequest();
        }

        uint256 templeAmountBefore = temple.balanceOf(address(this));
        uint256 stableAmountBefore = stable.balanceOf(address(this));

        amoStaking.withdrawAndUnwrap(bptIn, false, true);

        // NB: No need to approve a balancer pool token when used in the balancer vault.
        balancerVault.exitPool(balancerPoolId, address(this), address(this), request);

        // validate amounts received
        uint256 receivedAmount;
        for (uint i=0; i<request.assets.length; i++) {
            if (request.assets[i] == address(temple)) {
                unchecked {
                    receivedAmount = temple.balanceOf(address(this)) - templeAmountBefore;
                }
                if (receivedAmount > 0) {
                    AMO__ITempleERC20Token(address(temple)).burn(receivedAmount);
                }
            }
            if (request.assets[i] == address(stable)) {
                unchecked {
                    receivedAmount = stable.balanceOf(address(this)) - stableAmountBefore;
                }
            }

            // revert if insufficient amount received
            if (receivedAmount < request.minAmountsOut[i]) {
                revert AMOCommon.InsufficientAmountOutPostcall(request.minAmountsOut[i], receivedAmount);
            }
        }
    }

    /**
     * @notice Allow owner to deposit and stake bpt tokens directly
     * @param amount Amount of Bpt tokens to depositt
     * @param useContractBalance If to use bpt tokens in contract
     */
    function depositAndStakeBptTokens(
        uint256 amount,
        bool useContractBalance
    ) external onlyOwner {
        if (!useContractBalance) {
            bptToken.safeTransferFrom(msg.sender, address(this), amount);
        }
        bptToken.safeTransfer(address(amoStaking), amount);
        amoStaking.depositAndStake(amount);
    }

    function _validateParams(
        uint256 minAmountOut,
        uint256 amountIn
    ) internal view {
        if (minAmountOut == 0) {
            revert AMOCommon.ZeroSwapLimit();
        }
        if (amountIn > maxRebalanceAmount) {
            revert AMOCommon.AboveCappedAmount(amountIn);
        }
    }

    modifier enoughCooldown() {
        if (lastRebalanceTimeSecs != 0 && lastRebalanceTimeSecs + cooldownSecs <= block.timestamp) {
            revert AMOCommon.NotEnoughCooldown();
        }
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) {
            revert AMOCommon.NotOperator();
        }
        _;
    }

    modifier onlyOperatorOrOwner() {
        if (msg.sender != operator && msg.sender != owner()) {
            revert AMOCommon.NotOperatorOrOwner();
        }
        _;
    }

    modifier whenNotPaused() {
        if(paused) {
            revert AMOCommon.Paused();
        }
        _;
    }
}