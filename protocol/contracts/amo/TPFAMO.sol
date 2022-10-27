pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./helpers/PoolHelper.sol";
import "./interfaces/IBaseRewardPool.sol";
import "./interfaces/IAuraBooster.sol";
import "./interfaces/ITempleERC20Token.sol";
import "./helpers/AMOErrors.sol";
import "./interfaces/IAMOAuraStaking.sol";


/**
 * @title AMO built on top of balancer pool
 *
 * @dev it has a  convergent price to which it trends called the TPF (Treasury Price Floor).
 * In order to accomplish this when the price is below the TPF it will single side withdraw 
 * BPTs into TEMPLE and burn them and if the price is above the TPF it will 
 * single side deposit TEMPLE and increase its BPT position that way. Alternatively
 */
contract TPFAMO is PoolHelper, Ownable {
    using SafeERC20 for IERC20;

    // @notice balancer pool used for rebalancing
    IBalancerVault public immutable balancerVault;
    IERC20 public immutable bptToken;
    IAuraBooster public booster;

    // @notice AMO contract for staking into aura 
    IAMOAuraStaking public amoStaking;

    address public operator;
    address public immutable treasury;
    IERC20 public immutable temple;
    IERC20 public immutable stable;

    // TODO: get params (view function) grouped
    uint64 internal lastRebalanceTimeSecs;
    uint64 internal cooldownSecs;

    // @notice Capped size rebalancing. To safely increase/reduce capped amounts when rebalancing
    CappedRebalancingAmounts public cappedRebalanceAmounts;
    
    // @notice Used to track and control by how much successive rebalancing amounts increase/decrease
    uint256 internal lastRebalanceUpTempleAmount;
    uint256 internal lastRebalanceUpstableAmount;
    uint256 internal lastRebalanceDownAmount;

    // @notice track rate of change between successive rebalancing amounts up or down
    uint256 internal rebalanceRateChangeNumerator;

    // @notice by how much TPF slips up or down after rebalancing. In basis points
    uint64 internal postRebalanceTPFSlippageUp;
    uint64 internal postRebalanceTPFSlippageDown;

    // @notice contract paused state
    bool public paused;

    struct CappedRebalancingAmounts {
        uint128 temple;
        uint128 bpt;
        uint128 stable;
    }

    event RecoveredToken(address, address, uint256);
    event SetOperator(address);
    event SetPostRebalanceSlippage(uint64, uint64);
    event SetCooldown(uint64);
    event SetBalancerPoolId(bytes32);
    event SetAuraBooster(address);
    event SetTemplePriceFloorRatio(uint128, uint128);
    event SetRebalanceRateChange(uint256);
    event SetPauseState(bool);

    constructor(
        address _balancerVault,
        address _temple,
        address _stable,
        address _treasury,
        address _bptToken,
        address _amoStaking,
        address _booster,
        uint256 _rebalanceRateChangeNumerator
    ) {
        balancerVault = IBalancerVault(_balancerVault);
        temple = IERC20(_temple);
        stable = IERC20(_stable);
        treasury = _treasury;
        bptToken = IERC20(_bptToken);
        amoStaking = IAMOAuraStaking(_amoStaking);
        if (_rebalanceRateChangeNumerator >= TPF_PRECISION || _rebalanceRateChangeNumerator == 0) {
            revert AMOErrors.InvalidBPSValue(_rebalanceRateChangeNumerator);
        }
        booster = IAuraBooster(_booster);
        rebalanceRateChangeNumerator = _rebalanceRateChangeNumerator;
    }

    function setBalancerPoolId(bytes32 _poolId) external onlyOwner {
        balancerPoolId = _poolId;

        emit SetBalancerPoolId(_poolId);
    }

    function setTempleIndexInBalancerPool() external {
        (address[] memory tokens,,) = balancerVault.getPoolTokens(balancerPoolId);
        for (uint i=0; i<tokens.length; i++) {
            if (tokens[i] == address(temple)) {
                templeBalancerPoolIndex = uint64(i);
                break;
            }
        }
    }

    // (re)set last rebalance amounts for rebalanceUp and rebalanceDown
    function setLastRebalanceAmounts(uint256 upTemple, uint256 upStable, uint256 down) external onlyOwner {
        lastRebalanceUpTempleAmount = upTemple;
        lastRebalanceUpstableAmount = upStable;
        lastRebalanceDownAmount = down; // for bpt
    }

    function setPostRebalanceSlippage(uint64 upSlippage, uint64 downSlippage) external onlyOwner {
        // max 5%
        if (upSlippage >= 500 || downSlippage >= 500) {
            revert AMOErrors.InvalidBPSValue(upSlippage);
        }
        if (postRebalanceTPFSlippageUp != upSlippage) {
            postRebalanceTPFSlippageUp = upSlippage;
        }
        if (postRebalanceTPFSlippageDown != downSlippage) {
            postRebalanceTPFSlippageDown = downSlippage;
        }

        emit SetPostRebalanceSlippage(upSlippage, downSlippage);
    }

     /**
     * @notice Set capped amount when rebalancing
     * @param _capped New capped amounts
     */
    function setCappedRebalanceAmounts(CappedRebalancingAmounts calldata _capped) external onlyOwner {
        cappedRebalanceAmounts.temple = _capped.temple;
        cappedRebalanceAmounts.bpt = _capped.bpt;
        cappedRebalanceAmounts.stable = _capped.stable;
    }

    function setRebalanceRateChangeNumerator(uint256 _numerator) external onlyOwner {
        if (_numerator >= TPF_PRECISION || _numerator == 0) {
            revert AMOErrors.InvalidBPSValue(_numerator);
        }
        rebalanceRateChangeNumerator = _numerator;

        emit SetRebalanceRateChange(_numerator);
    }

    function setTemplePriceFloorRatio(uint128 _numerator) external onlyOwner {
        templePriceFloorRatio.numerator = _numerator;
        templePriceFloorRatio.denominator = uint128(TPF_PRECISION);

        emit SetTemplePriceFloorRatio(_numerator, uint128(TPF_PRECISION));
    }

    /**
     * @notice Set operator
     * @param _operator New operator
     */
    function setOperator(address _operator) external onlyOwner {
        operator = _operator;

        emit SetOperator(_operator);
    }

    function setCoolDown(uint64 _seconds) external onlyOwner {
        cooldownSecs = _seconds;

        emit SetCooldown(_seconds);
    }

    /// has a shutdown system. so if that happens
    function setAuraBooster(IAuraBooster _booster) external onlyOwner {
        booster = _booster;

        emit SetAuraBooster(address(_booster));
    }

    // @notice pause AMO
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
        if (to == address(0)) revert AMOErrors.InvalidAddress();
        IERC20(token).safeTransfer(to, amount);

        emit RecoveredToken(token, to, amount);
    }

    /**
     * @notice Rebalance when $TEMPLE price below TPF
     * Single-side withdraw $TEMPLE tokens from balancer liquidity pool to raise price
     */
    function rebalanceUp(
        uint256 bptAmountIn,
        uint256 _minAmountOut
    ) external onlyOperatorOrOwner enoughCooldown whenNotPaused {
        _validateParams(_minAmountOut, bptAmountIn, cappedRebalanceAmounts.bpt);
        
        uint256 bptTokenAmount = bptToken.balanceOf(address(this));
        if (bptAmountIn > bptTokenAmount) {
            revert AMOErrors.InsufficientBPTAmount(bptAmountIn);
        }

        // check spot price is below TPF
        (, uint256[] memory balances,) = balancerVault.getPoolTokens(balancerPoolId);
        if (!isSpotPriceBelowTPF(balances)) {
            revert AMOErrors.NoRebalanceUp();
        }

        // check tolerance
        if (lastRebalanceUpTempleAmount != 0 && bptAmountIn > lastRebalanceUpTempleAmount) {
            uint256 maxRebalanceChange = lastRebalanceUpTempleAmount * rebalanceRateChangeNumerator / TPF_PRECISION;
            
            uint256 diff;
            unchecked {
                diff = bptAmountIn - lastRebalanceUpTempleAmount;
            }
            if (diff > maxRebalanceChange) {
                revert AMOErrors.RebalanceAmountTolerance(bptAmountIn, diff);
            }
        }

        // TODO: (|TPF - OP|/TPF) * A = B

        // construct request
        IBalancerVault.ExitPoolRequest memory exitPoolRequest;
        if (templeBalancerPoolIndex == 0) {
            exitPoolRequest = _createPoolExitRequest(bptAmountIn, 0, _minAmountOut);
        } else {
            exitPoolRequest = _createPoolExitRequest(bptAmountIn, 1, _minAmountOut);
        }

        // safeincrease allowance
        bptToken.safeIncreaseAllowance(address(balancerVault), bptAmountIn);

        // execute call and check for sanity
        uint256 templeBalanceBefore = temple.balanceOf(address(this));
        balancerVault.exitPool(balancerPoolId, address(this), address(this), exitPoolRequest);
        uint256 templeBalanceAfter = temple.balanceOf(address(this));
        if (templeBalanceAfter < templeBalanceBefore + _minAmountOut) {
            revert AMOErrors.InsufficientAmountOutPostcall(templeBalanceBefore + _minAmountOut, templeBalanceAfter);
        }
        // burn
        uint256 burnAmount;
        unchecked {
            burnAmount = templeBalanceAfter - templeBalanceBefore;
        }
        ITempleERC20Token(address(temple)).burn(burnAmount);

        // update lastRebalanceAmountUp
        lastRebalanceUpTempleAmount = _getMax(lastRebalanceUpTempleAmount, bptAmountIn);

        // revert if rebalance took price significantly above TPF
        (, balances, ) = balancerVault.getPoolTokens(balancerPoolId);
        if (isSpotPriceAboveTPF(balances, postRebalanceTPFSlippageUp)) {
            revert AMOErrors.HighSlippage();
        }
        lastRebalanceTimeSecs = uint64(block.timestamp);
    }

     /**
     * @notice Rebalance when $TEMPLE price above TPF
     * //Single-side withdraw $stable tokens from balancer liquidity pool to reduce price
     * Single-side mints and deposits $TEMPLE
     * and add to the Treasury.
     */
    function rebalanceDown(
        uint256 templeAmountIn,
        uint256 minBptOut,
        bool useContractTemple
    ) external onlyOperatorOrOwner enoughCooldown whenNotPaused {
        _validateParams(minBptOut, templeAmountIn, cappedRebalanceAmounts.temple);
        
        if (!useContractTemple) {
            ITempleERC20Token(address(temple)).mint(address(this), templeAmountIn);
        }

        // check spot price is above TPF
        (, uint256[] memory balances,) = balancerVault.getPoolTokens(balancerPoolId);
        if (!isSpotPriceAboveTPF(balances)) {
            revert AMOErrors.NoRebalanceDown();
        }
        
        // check tolerance
        if (lastRebalanceDownAmount != 0 && templeAmountIn > lastRebalanceDownAmount) {
            uint256 maxRebalanceChange = lastRebalanceDownAmount * rebalanceRateChangeNumerator / TPF_PRECISION;
            
            uint256 diff;
            unchecked {
                diff = templeAmountIn - lastRebalanceDownAmount;
            }
            if (diff > maxRebalanceChange) {
                revert AMOErrors.RebalanceAmountTolerance(templeAmountIn, diff);
            }
        }

        // TODO: (|TPF - OP|/TPF) * A = B

        // construct request
        IBalancerVault.JoinPoolRequest memory joinPoolRequest;
        if (templeBalancerPoolIndex == 0) {
            joinPoolRequest = _createPoolJoinRequest(templeAmountIn, 0, minBptOut);
        } else {
            joinPoolRequest = _createPoolJoinRequest(templeAmountIn, 1, minBptOut);
        }

        // approve
        temple.safeIncreaseAllowance(address(balancerVault), templeAmountIn);

        // execute and sanity check
        uint256 bptAmountBefore = bptToken.balanceOf(address(this));
        balancerVault.joinPool(balancerPoolId, address(this), address(this), joinPoolRequest);
        uint256 bptAmountAfter = bptToken.balanceOf(address(this));
        if (bptAmountAfter < bptAmountBefore + minBptOut) {
            revert AMOErrors.InsufficientAmountOutPostcall(bptAmountBefore + minBptOut, bptAmountAfter);
        }

        // update rebalanceDown amount
        // use max of current amount and last updated
        lastRebalanceDownAmount = _getMax(lastRebalanceDownAmount, templeAmountIn);

        // revert if rebalance took price significantly above TPF
        (, balances, ) = balancerVault.getPoolTokens(balancerPoolId);
        if (isSpotPriceAboveTPF(balances, postRebalanceTPFSlippageUp)) {
            revert AMOErrors.HighSlippage();
        }

        lastRebalanceTimeSecs = uint64(block.timestamp);
    }

    // Single-side deposit stable
    function depositStable(
        uint256 amountIn,
        uint256 minBptOut
    ) external onlyOwner whenNotPaused {
        _validateParams(minBptOut, amountIn, cappedRebalanceAmounts.stable);

        // check spot price < TPF
        (, uint256[] memory balances,) = balancerVault.getPoolTokens(balancerPoolId);
        if (!isSpotPriceBelowTPF(balances)) {
            revert AMOErrors.NoRebalanceUp();
        }

        _checkTolerance(lastRebalanceUpstableAmount, amountIn);

        // construct request
        IBalancerVault.JoinPoolRequest memory joinPoolRequest;
        if (templeBalancerPoolIndex == 0) {
            joinPoolRequest = _createPoolJoinRequest(amountIn, 1, minBptOut);
        } else {
            joinPoolRequest = _createPoolJoinRequest(amountIn, 0, minBptOut);
        }

        // approve
        stable.safeIncreaseAllowance(address(balancerVault), amountIn);

        // execute and sanity check
        uint256 stableAmountBefore = stable.balanceOf(address(this));
        balancerVault.joinPool(balancerPoolId, address(this), address(this), joinPoolRequest);
        uint256 stableAmountAfter = stable.balanceOf(address(this));
        if (stableAmountAfter < stableAmountBefore + minBptOut) {
            revert AMOErrors.InsufficientAmountOutPostcall(stableAmountBefore + minBptOut, stableAmountAfter);
        }

        // update last rebalanceUp amount
        // using max of current amount and last updated
        lastRebalanceUpstableAmount = _getMax(lastRebalanceUpstableAmount, amountIn);
        lastRebalanceTimeSecs = uint64(block.timestamp);
    }

    // Single-side withdraw stable
    function withdrawstable(
        uint256 bptAmountIn,
        uint256 minAmountOut
    ) external onlyOwner whenNotPaused {
        _validateParams(minAmountOut, bptAmountIn, cappedRebalanceAmounts.bpt);

        // check spot price > TPF
        (, uint256[] memory balances,) = balancerVault.getPoolTokens(balancerPoolId);
        if (!isSpotPriceAboveTPF(balances)) {
            revert AMOErrors.NoRebalanceDown();
        }

        _checkTolerance(lastRebalanceDownAmount, bptAmountIn);

        IBalancerVault.ExitPoolRequest memory exitPoolRequest;
        if (templeBalancerPoolIndex == 0) {
            exitPoolRequest = _createPoolExitRequest(bptAmountIn, 1, minAmountOut);
        } else {
            exitPoolRequest = _createPoolExitRequest(bptAmountIn, 0, minAmountOut);
        }

        // safeincrease allowance
        bptToken.safeIncreaseAllowance(address(balancerVault), bptAmountIn);

        // execute call and check for sanity
        uint256 stableBalanceBefore = temple.balanceOf(address(this));
        balancerVault.exitPool(balancerPoolId, address(this), address(this), exitPoolRequest);
        uint256 stableBalanceAfter = temple.balanceOf(address(this));
        if (stableBalanceAfter < stableBalanceBefore + minAmountOut) {
            revert AMOErrors.InsufficientAmountOutPostcall(stableBalanceBefore + minAmountOut, stableBalanceAfter);
        }

        lastRebalanceDownAmount = _getMax(lastRebalanceDownAmount, bptAmountIn);
        lastRebalanceTimeSecs = uint64(block.timestamp);
    }
    
    // deposit BPT and stake using Aura Booster
    function depositAndStake(uint256 amount) external onlyOwner {
        bptToken.safeIncreaseAllowance(address(amoStaking), amount);
        amoStaking.depositAndStake(amount);
    }

    function depositAllAndStake() external onlyOwner {
        uint256 bptBalance = bptToken.balanceOf(address(this));
        if (bptBalance > 0) {
            bptToken.safeIncreaseAllowance(address(amoStaking), bptBalance);
            amoStaking.depositAndStake(bptBalance);
        }
    }

    function withdrawAll(bool claim, bool receiveToken) external onlyOwner {
       amoStaking.withdrawAll(claim, receiveToken);
    }

    function withdraw(uint256 amount, bool claim, bool receiveToken) external onlyOwner {
        amoStaking.withdraw(amount, claim, receiveToken);
    }

    function withdrawAndUnwrap(uint256 amount, bool claim, bool receiveToken) external onlyOwner {
        amoStaking.withdrawAndUnwrap(amount, claim, receiveToken);
    }

    function withdrawAllAndUnwrap(bool claim, bool receiveToken) external onlyOwner {
        amoStaking.withdrawAllAndUnwrap(claim, receiveToken);
    }

    function getReward(bool claimExtras) external {
        amoStaking.getReward(claimExtras);
    }


    // todo: deposit TEMPLE or stable token using depositSingle from RewardPoolDepositWrapper 0xB188b1CB84Fb0bA13cb9ee1292769F903A9feC59


    function _createPoolJoinRequest(
        uint256 amountIn,
        uint256 tokenIndex,
        uint256 minTokenOut
    ) internal view returns (IBalancerVault.JoinPoolRequest memory request) {
        IERC20[] memory assets = new IERC20[](2);
        uint256[] memory maxAmountsIn = new uint256[](2);
        if (templeBalancerPoolIndex == 0) {
            assets[0] = temple;
            assets[1] = stable;
            maxAmountsIn[0] = tokenIndex == 0 ? amountIn: 0;
            maxAmountsIn[1] = tokenIndex == 0 ? 0 : amountIn;
        } else {
            assets[0] = stable;
            assets[1] = temple;
            maxAmountsIn[0] = tokenIndex == 1 ? 0 : amountIn;
            maxAmountsIn[1] = tokenIndex == 1 ? amountIn : 0;
        }
        //uint256 joinKind = 1; //EXACT_TOKENS_IN_FOR_BPT_OUT
        bytes memory encodedUserdata = abi.encode(uint256(1), maxAmountsIn, minTokenOut);
        request.assets = assets;
        request.maxAmountsIn = maxAmountsIn;
        request.userData = encodedUserdata;
        request.fromInternalBalance = false;
    }

    function _createPoolExitRequest(
        uint256 bptAmountIn,
        uint256 tokenIndex,
        uint256 minAmountOut
    ) internal view returns (IBalancerVault.ExitPoolRequest memory request) {
        address[] memory assets = new address[](2);
        uint256[] memory minAmountsOut = new uint256[](2);
        if (templeBalancerPoolIndex == 0) {
            assets[0] = address(temple);
            assets[1] = address(stable);
            minAmountsOut[0] = tokenIndex == 0 ? minAmountOut: 0;
            minAmountsOut[1] = tokenIndex == 0 ? 0: minAmountOut;
        } else {
            assets[0] = address(stable);
            assets[1] = address(temple);
            minAmountsOut[0] = tokenIndex == 1 ? 0 : minAmountOut;
            minAmountsOut[1] = tokenIndex == 1 ? minAmountOut: 0;
        }
        // EXACT_BPT_IN_FOR_ONE_TOKEN_OUT index is 0 for exitKind
        uint256 exitTokenIndex = uint256(templeBalancerPoolIndex);
        bytes memory encodedUserdata = abi.encode(uint256(0), bptAmountIn, exitTokenIndex);
        request.assets = assets;
        request.minAmountsOut = minAmountsOut;
        request.userData = encodedUserdata;
        request.toInternalBalance = false;
    }

    function _validateParams(
        uint256 minAmountOut,
        uint256 amountIn,
        uint256 cappedAmount
    ) internal pure {
        if (minAmountOut == 0) {
            revert AMOErrors.ZeroSwapLimit();
        }
        if (amountIn > cappedAmount) {
            revert AMOErrors.AboveCappedAmount(amountIn);
        }
    }

    function _checkTolerance(
        uint256 rebalanceAmount,
        uint256 amountIn
    ) internal view {
        // if (rebalanceAmount != 0 && amountIn > rebalanceAmount) {
        //     uint256 maxRebalanceChange = rebalanceAmount * rebalanceRateChangeNumerator / TPF_PRECISION;
            
        //     uint256 diff;
        //     unchecked {
        //         diff = amountIn - rebalanceAmount;
        //     }
        //     if (diff > maxRebalanceChange) {
        //         revert RebalanceAmountTolerance(amountIn, diff);
        //     }
        // }
        uint256 rate = rebalanceRateChangeNumerator;
        assembly {
            if and(iszero(iszero(rebalanceAmount)), gt(amountIn, rebalanceAmount)) {
                if gt(sub(amountIn, rebalanceAmount), div(mul(rebalanceAmount, rate), TPF_PRECISION)) { revert(0, 0) }
            }
        }
    }

    // assumes userData is encoded with joinKind EXACT_TOKENS_IN_FOR_BPT_OUT (1)
    // this function is executed by contract owner and should be checked if spot price is within acceptable
    // skews off TPF before executing
    function addLiquidity(
        IBalancerVault.JoinPoolRequest memory request,
        uint256 minBptOut,
        bool useContractTempleBalance
    ) external onlyOwner {
        // validate request
        if (request.assets.length != request.maxAmountsIn.length || 
            request.assets.length != 2 || 
            request.fromInternalBalance == true) {
                revert AMOErrors.InvalidBalancerVaultRequest();
        }
        // expect price to be close to TPF
        // revert if price is above or below TPF by given slippage
        
        // (, uint256[] memory balances, ) = balancerVault.getPoolTokens(balancerPoolId);
        // if (isSpotPriceAboveTPF(balances, postRebalanceTPFSlippageUp) ||
        //     isSpotPriceBelowTPF(balances, postRebalanceTPFSlippageDown)
        // ) {
        //     revert AMOErrors.HighSlippage();
        // }

        uint256 templeAmount;
        uint256 stableAmount;
        if (templeBalancerPoolIndex == 0) {
            templeAmount = request.maxAmountsIn[0];
            stableAmount = request.maxAmountsIn[1];
        } else {
            templeAmount = request.maxAmountsIn[1];
            stableAmount = request.maxAmountsIn[0];
        }

        if (!useContractTempleBalance) {
            ITempleERC20Token(address(temple)).mint(address(this), templeAmount);
        }

        // safe allowance stable and TEMPLE
        temple.safeIncreaseAllowance(address(balancerVault), templeAmount);
        stable.safeIncreaseAllowance(address(balancerVault), stableAmount);

        // join pool
        uint256 bptAmountBefore = bptToken.balanceOf(address(this));
        balancerVault.joinPool(balancerPoolId, address(this), address(this), request);
        uint256 bptAmountAfter = bptToken.balanceOf(address(this));
        uint256 diff;
        unchecked {
            diff = bptAmountAfter - bptAmountBefore;
        }
        if (diff < minBptOut) {
            revert AMOErrors.InsufficientAmountOutPostcall(minBptOut, diff);
        }
    }

    function removeLiquidity(
        IBalancerVault.ExitPoolRequest memory request,
        uint256 bptIn
    ) external onlyOwner {
        // validate request
        if (request.assets.length != request.minAmountsOut.length || 
            request.assets.length != 2 || 
            request.toInternalBalance == true) {
                revert AMOErrors.InvalidBalancerVaultRequest();
        }
        // expect price to be close to TPF
        // revert if price is above or below TPF by given slippage
        (, uint256[] memory balances, ) = balancerVault.getPoolTokens(balancerPoolId);
        if (isSpotPriceAboveTPF(balances, postRebalanceTPFSlippageUp) ||
            isSpotPriceBelowTPF(balances, postRebalanceTPFSlippageDown)
        ) {
            revert AMOErrors.HighSlippage();
        }

        uint256 templeAmountBefore = temple.balanceOf(address(this));
        uint256 stableAmountBefore = stable.balanceOf(address(this));

        uint256 bptAmount = bptToken.balanceOf(address(this));
        if (bptAmount < bptIn) {
            revert AMOErrors.InsufficientBPTAmount(bptIn);
        }

        bptToken.safeIncreaseAllowance(address(balancerVault), bptIn);
        balancerVault.exitPool(balancerPoolId, address(this), address(this), request);

        // validate amounts received
        uint256 receivedAmount;
        for (uint i=0; i<request.assets.length; i++) {
            if (request.assets[i] == address(temple)) {
                unchecked {
                    receivedAmount = temple.balanceOf(address(this)) - templeAmountBefore;
                }
            }
            if (request.assets[i] == address(stable)) {
                unchecked {
                    receivedAmount = stable.balanceOf(address(this)) - stableAmountBefore;
                }
            }

            // revert if insufficient amount received
            if (receivedAmount < request.minAmountsOut[i]) {
                revert AMOErrors.InsufficientAmountOutPostcall(request.minAmountsOut[i], receivedAmount);
            }
        }
    }

    // function isSpotPriceAboveTPF() external view returns (bool) {
    //     (, uint256[] memory balances, ) = balancerVault.getPoolTokens(balancerPoolId);
    //     return isSpotPriceAboveTPF(balances);
    // }

    // function isSpotPriceBelowTPF() external view returns (bool) {
    //     (, uint256[] memory balances, ) = balancerVault.getPoolTokens(balancerPoolId);
    //     return isSpotPriceBelowTPF(balances);
    // }

    modifier enoughCooldown() {
        if (lastRebalanceTimeSecs != 0 && lastRebalanceTimeSecs + cooldownSecs <= block.timestamp) {
            revert AMOErrors.NotEnoughCooldown();
        }
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) {
            revert AMOErrors.NotOperator();
        }
        _;
    }

    modifier onlyOperatorOrOwner() {
        if (msg.sender != operator && msg.sender != owner()) {
            revert AMOErrors.NotOperatorOrOwner();
        }
        _;
    }

    modifier whenNotPaused() {
        if(paused) {
            revert AMOErrors.Paused();
        }
        _;
    }
}