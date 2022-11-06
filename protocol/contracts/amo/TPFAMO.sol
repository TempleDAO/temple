pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPoolHelper.sol";
import "./interfaces/IAuraBooster.sol";
import "./interfaces/ITempleERC20Token.sol";
import "./helpers/AMOCommon.sol";
import "./interfaces/IAMOAuraStaking.sol";

/**
 * @title AMO built for 50TEMPLE-50BB-A-USD balancer pool
 *
 * @dev it has a  convergent price to which it trends called the TPF (Treasury Price Floor).
 * In order to accomplish this when the price is below the TPF it will single side withdraw 
 * BPTs into TEMPLE and burn them and if the price is above the TPF it will 
 * single side deposit TEMPLE and increase its BPT position that way. Alternatively
 */
contract TPFAMO is Ownable {
    using SafeERC20 for IERC20;

    // @notice balancer pool used for rebalancing
    AMO__IBalancerVault public immutable balancerVault;
    IERC20 public immutable bptToken;
    IAuraBooster public immutable booster;
    IPoolHelper public poolHelper;
    
    // @notice AMO contract for staking into aura 
    IAMOAuraStaking public amoStaking;

    address public operator;
    IERC20 public immutable temple;
    IERC20 public immutable stable;

    uint64 internal lastRebalanceTimeSecs;
    uint64 public cooldownSecs;

    // @notice balancer 50/50 pool ID.
    bytes32 public immutable balancerPoolId;

    // @notice Temple price floor denominator
    uint256 public constant TPF_PRECISION = 10_000;

    // @notice Capped size rebalancing. To safely increase/reduce capped amounts when rebalancing
    //CappedRebalancingAmounts public cappedRebalanceAmounts;
    uint256 public maxRebalanceAmount;
    
    // @notice Used to track and control by how much successive rebalancing amounts increase/decrease
    // uint256 internal lastRebalanceUpTempleAmount;
    // uint256 internal lastRebalanceUpstableAmount;
    // uint256 internal lastRebalanceDownAmount;

    // @notice track rate of change between successive rebalancing amounts up or down
    uint256 internal rebalanceRateChangeNumerator;

    // @notice by how much TPF slips up or down after rebalancing. In basis points
    uint64 public postRebalanceSlippage;

    // @notice contract paused state
    bool public paused;

    // @notice temple index in balancer pool. to avoid recalculation or external calls
    uint64 public templeBalancerPoolIndex;


    constructor(
        address _balancerVault,
        address _temple,
        address _stable,
        address _bptToken,
        address _amoStaking,
        address _booster,
        uint64 _templeIndexInPool,
        bytes32 _balancerPoolId
    ) {
        balancerVault = AMO__IBalancerVault(_balancerVault);
        temple = IERC20(_temple);
        stable = IERC20(_stable);
        bptToken = IERC20(_bptToken);
        amoStaking = IAMOAuraStaking(_amoStaking);
        booster = IAuraBooster(_booster);
        templeBalancerPoolIndex = _templeIndexInPool;
        balancerPoolId = _balancerPoolId;
    }

    function setPoolHelper(address _poolHelper) external onlyOwner {
        poolHelper = IPoolHelper(_poolHelper);

        emit AMOCommon.SetPoolHelper(_poolHelper);
    }

    // (re)set last rebalance amounts for rebalanceUp and rebalanceDown
    // function setLastRebalanceAmounts(uint256 upTemple, uint256 upStable, uint256 down) external onlyOwner {
    //     lastRebalanceUpTempleAmount = upTemple;
    //     lastRebalanceUpstableAmount = upStable;
    //     lastRebalanceDownAmount = down; // for bpt
    // }

    function setPostRebalanceSlippage(uint64 slippage) external onlyOwner {
        if (slippage >= TPF_PRECISION || slippage == 0) {
            revert AMOCommon.InvalidBPSValue(slippage);
        }
        postRebalanceSlippage = slippage;
        emit AMOCommon.SetPostRebalanceSlippage(slippage);
    }

    function setMaxRebalanceAmount(uint256 maxAmount) external onlyOwner {
        maxRebalanceAmount = maxAmount;
        emit AMOCommon.SetMaxRebalanceAmount(maxAmount);
    }

    function setRebalanceRateChangeNumerator(uint256 _numerator) external onlyOwner {
        if (_numerator >= TPF_PRECISION || _numerator == 0) {
            revert AMOCommon.InvalidBPSValue(_numerator);
        }
        rebalanceRateChangeNumerator = _numerator;

        emit AMOCommon.SetRebalanceRateChange(_numerator);
    }

    /**
     * @notice Set operator
     * @param _operator New operator
     */
    function setOperator(address _operator) external onlyOwner {
        operator = _operator;

        emit AMOCommon.SetOperator(_operator);
    }

    function setCoolDown(uint64 _seconds) external onlyOwner {
        cooldownSecs = _seconds;

        emit AMOCommon.SetCooldown(_seconds);
    }

    // @notice pause AMO
    function togglePause() external onlyOwner {
        paused = !paused;

        emit AMOCommon.SetPauseState(paused);
    }

    /**
     * @notice Recover any token from AMO
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverToken(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert AMOCommon.InvalidAddress();
        IERC20(token).safeTransfer(to, amount);

        emit AMOCommon.RecoveredToken(token, to, amount);
    }

    /**
     * @notice Rebalance when $TEMPLE price below TPF
     * Single-side withdraw $TEMPLE tokens from balancer liquidity pool to raise price
     */
    function rebalanceUp(
        uint256 bptAmountIn,
        uint256 _minAmountOut
    ) external onlyOperatorOrOwner whenNotPaused enoughCooldown {
        _validateParams(_minAmountOut, bptAmountIn);

        // check spot price is below TPF by lower bound
        if (!poolHelper.isSpotPriceBelowTPFLowerBound()) {
            revert AMOCommon.NoRebalanceUp();
        }

        // will exit take price above tpf + upper bound
        // should rarely be the case, but a sanity check nonetheless
        if (poolHelper.willExitTakePriceAboveTPFUpperBound(_minAmountOut)) {
            revert AMOCommon.HighSlippage();
        }

        // check tolerance
        //_checkTolerance(lastRebalanceUpTempleAmount, bptAmountIn);

        // construct request
        AMO__IBalancerVault.ExitPoolRequest memory exitPoolRequest;
        if (templeBalancerPoolIndex == 0) {
            exitPoolRequest = poolHelper.createPoolExitRequest(address(temple), address(stable), bptAmountIn,
                0, _minAmountOut, templeBalancerPoolIndex);
        } else {
            exitPoolRequest = poolHelper.createPoolExitRequest(address(temple), address(stable), bptAmountIn,
                1, _minAmountOut, templeBalancerPoolIndex);
        }
        // withdraw bpt tokens
        amoStaking.withdrawAndUnwrap(bptAmountIn, false, true);

        bptToken.approve(address(balancerVault), 0);
        bptToken.approve(address(balancerVault), bptAmountIn);

        // execute call and check for sanity
        uint256 templeBalanceBefore = temple.balanceOf(address(this));
        uint256 spotPriceScaledBefore = poolHelper.getSpotPriceScaled();
        balancerVault.exitPool(balancerPoolId, address(this), address(this), exitPoolRequest);
        uint256 templeBalanceAfter = temple.balanceOf(address(this));
        if (templeBalanceAfter < templeBalanceBefore + _minAmountOut) {
            revert AMOCommon.InsufficientAmountOutPostcall(templeBalanceBefore + _minAmountOut, templeBalanceAfter);
        }
        // burn
        uint256 burnAmount;
        unchecked {
            burnAmount = templeBalanceAfter - templeBalanceBefore;
        }
        ITempleERC20Token(address(temple)).burn(burnAmount);

        // update lastRebalanceAmountUp
        //lastRebalanceUpTempleAmount = poolHelper.getMax(lastRebalanceUpTempleAmount, bptAmountIn);

        if (uint64(poolHelper.getSlippage(spotPriceScaledBefore)) > postRebalanceSlippage) {
            revert AMOCommon.HighSlippage();
        }
        lastRebalanceTimeSecs = uint64(block.timestamp);
        emit AMOCommon.RebalanceUp(bptAmountIn, burnAmount);
    }

     /**
     * @notice Rebalance when $TEMPLE price above TPF
     * //Single-side withdraw $stable tokens from balancer liquidity pool to reduce price
     * Single-side mints and deposits $TEMPLE
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

        ITempleERC20Token(address(temple)).mint(address(this), templeAmountIn);

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
        emit AMOCommon.RebalanceDown(templeAmountIn, bptIn);

        // deposit and stake BPT
        bptToken.safeIncreaseAllowance(address(amoStaking), bptIn);
        amoStaking.depositAndStake(bptIn);
    }

    // Single-side deposit stable
    function depositStable(
        uint256 amountIn,
        uint256 minBptOut
    ) external onlyOwner whenNotPaused {
        _validateParams(minBptOut, amountIn);

        // check spot price < TPF
        if (!poolHelper.isSpotPriceBelowTPF()) {
            revert AMOCommon.NoRebalanceUp();
        }

        // construct request
        AMO__IBalancerVault.JoinPoolRequest memory joinPoolRequest;
        if (templeBalancerPoolIndex == 0) {
            joinPoolRequest = poolHelper.createPoolJoinRequest(temple, stable, amountIn, 1, minBptOut);
        } else {
            joinPoolRequest = poolHelper.createPoolJoinRequest(temple, stable, amountIn, 0, minBptOut);
        }

        // approve
        stable.approve(address(balancerVault), 0);
        stable.approve(address(balancerVault), amountIn);

        // execute and sanity check
        uint256 bptAmountBefore = bptToken.balanceOf(address(this));
        balancerVault.joinPool(balancerPoolId, address(this), address(this), joinPoolRequest);
        uint256 bptAmountAfter = bptToken.balanceOf(address(this));
        uint256 bptOut;
        unchecked {
            bptOut = bptAmountAfter - bptAmountBefore;
        }
        if (bptOut < minBptOut) {
            revert AMOCommon.InsufficientAmountOutPostcall(bptAmountBefore + minBptOut, bptAmountAfter);
        }

        lastRebalanceTimeSecs = uint64(block.timestamp);

        emit AMOCommon.StableDeposited(amountIn, bptOut);

        bptToken.safeIncreaseAllowance(address(amoStaking), bptOut);
        amoStaking.depositAndStake(bptOut);
    }

    // Single-side withdraw stable
    function withdrawStable(
        uint256 bptAmountIn,
        uint256 minAmountOut
    ) external onlyOwner whenNotPaused {
        _validateParams(minAmountOut, bptAmountIn);

        // check spot price > TPF
        if (!poolHelper.isSpotPriceAboveTPF()) {
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
        amoStaking.withdrawAndUnwrap(bptAmountIn, false, true);

        // safeincrease allowance
        bptToken.approve(address(balancerVault), 0);
        bptToken.approve(address(balancerVault), bptAmountIn);

        // execute call and check for sanity
        uint256 stableBalanceBefore = stable.balanceOf(address(this));
        balancerVault.exitPool(balancerPoolId, address(this), address(this), exitPoolRequest);
        uint256 stableBalanceAfter = stable.balanceOf(address(this));
        if (stableBalanceAfter < stableBalanceBefore + minAmountOut) {
            revert AMOCommon.InsufficientAmountOutPostcall(stableBalanceBefore + minAmountOut, stableBalanceAfter);
        }

        lastRebalanceTimeSecs = uint64(block.timestamp);
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

    // assumes userData is encoded with joinKind EXACT_TOKENS_IN_FOR_BPT_OUT (1)
    // this function is executed by contract owner and should be checked if spot price is within acceptable
    // skews off TPF before executing
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

        ITempleERC20Token(address(temple)).mint(address(this), templeAmount);
        // safe allowance stable and TEMPLE
        temple.safeIncreaseAllowance(address(balancerVault), templeAmount);
        stable.approve(address(balancerVault), 0);
        stable.approve(address(balancerVault), stableAmount);

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
        bptToken.safeIncreaseAllowance(address(amoStaking), bptIn);
        amoStaking.depositAndStake(bptIn);
    }

    // allow multisig to deposit and stake bpt tokens directly
    function depositAndStakeBptTokens(uint256 amount, bool useContractBalance) external onlyOwner {
        if (!useContractBalance) {
            bptToken.safeTransferFrom(msg.sender, address(this), amount);
        }
        
        bptToken.safeIncreaseAllowance(address(amoStaking), amount);
        amoStaking.depositAndStake(amount);
    }

    // this function is executed by contract owner and should be checked if spot price is within acceptable
    // skews off TPF before executing
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

        bptToken.approve(address(balancerVault), 0);
        bptToken.approve(address(balancerVault), bptIn);

        balancerVault.exitPool(balancerPoolId, address(this), address(this), request);

        // validate amounts received
        uint256 receivedAmount;
        for (uint i=0; i<request.assets.length; i++) {
            if (request.assets[i] == address(temple)) {
                unchecked {
                    receivedAmount = temple.balanceOf(address(this)) - templeAmountBefore;
                }
                if (receivedAmount > 0) {
                    ITempleERC20Token(address(temple)).burn(receivedAmount);
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