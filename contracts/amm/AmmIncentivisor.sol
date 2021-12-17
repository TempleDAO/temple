pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later


import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import "../ABDKMath64x64.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../TempleERC20Token.sol";
import "./ITempleFraxAmmRouter.sol";
import "../TempleTreasury.sol";
import "../TempleStaking.sol";
import "../IFaith.sol";


contract AmmIncentivisor is Ownable, Pausable {

    using ABDKMath64x64 for int128;

    uint256 constant SECONDS_IN_DAY = 24 * 60 * 60;
    uint256 constant PRECISION = 1e5;

    IERC20 public stablecToken; // contract address for stable coin used in treasury
    IFaith public faith;
    IERC20 public templeToken; // temple ERC20 contract
    TempleStaking public staking; // Staking contract
    ITempleFraxAMMRouter public router;
    IUniswapV2Pair public pair;

    //treasury address
    address public treasury;

    int128  public scalingFactor; // P value

    uint256 public buyTheDipMultiplier;
    uint256 public stakeAndLockMultiplier;
    uint256 public numBlocksForUnlockIncentive;
    uint256 public unlockDelaySeconds = SECONDS_IN_DAY * 7; // How long after buying the dip can people unlock

    struct LockedEntry {
       uint256 amount;
       uint256 lockedUntilTimestamp;
    }
    mapping(address => LockedEntry) public ogTempleLocked;

    event BuyTheDipComplete(address buyer, uint256 boughtTemple, uint256 faithGranted);
    event StakeAndLockComplete(address staker, uint256 boughtTemple, uint256 bonusTemple, uint256 mintedOGTemple, uint256 faithGranted);

    constructor(
      IERC20 _stablecToken,
      IFaith _faith,
      TempleERC20Token _templeToken,
      TempleStaking _staking,
      ITempleFraxAMMRouter _router,
      IUniswapV2Pair _pair,
      address _treasury
    ) {

      stablecToken = _stablecToken;
      faith = _faith;
      templeToken = _templeToken;
      staking = _staking;
      router = _router;
      pair   = _pair;
      treasury = _treasury;
    }

    function setUnlockDelay(uint256 _unlockDelaySeconds) external onlyOwner {
        unlockDelaySeconds = _unlockDelaySeconds;
    }

    function setScalingFactor(uint256 numerator, uint256 denominator) external onlyOwner {
        scalingFactor = ABDKMath64x64.divu(numerator, denominator);
    }

    function setNumBlocksForUnlockIncentive(uint256 _numBlocksForUnlockIncentive) external onlyOwner {
        numBlocksForUnlockIncentive = _numBlocksForUnlockIncentive;
    }
    
    function setBuyTheDipMultiplier(uint256 _buyTheDipMultiplier) external onlyOwner {
        buyTheDipMultiplier = _buyTheDipMultiplier;
    }

    function SetStakeAndLockMultiplier(uint256 _stakeAndLockMultiplier) external onlyOwner {
        stakeAndLockMultiplier = _stakeAndLockMultiplier;
    }

     /**
     * Buy the dip. Incentivize people to buy temple when price below threshold
     * For doing so the user is rewarded in FAITH
     */
    function buyTheDip(uint256 amountStablec, uint256 templeOutMin, uint256 deadline) public whenNotPaused {
          
          (uint reserveTemple, uint reserveFrax,) = pair.getReserves();
          (uint thresholdPriceFrax, uint thresholdPriceTemple) = router.dynamicThresholdPriceWithDecay();
        
          //TODO: figure out a way to check if price has been less that threshold for x number of blocks
          if (thresholdPriceTemple * reserveFrax < thresholdPriceFrax * reserveTemple) {
                uint256 checkPointBlock = router.checkPointBlock();
                require(block.number - checkPointBlock > numBlocksForUnlockIncentive, "AMM Incentivizor: Not Active");
                SafeERC20.safeTransferFrom(stablecToken, msg.sender, address(this), amountStablec);
                SafeERC20.safeIncreaseAllowance(stablecToken, address(router), amountStablec);
                uint256 templeOut = router.swapExactFraxForTemple(amountStablec, templeOutMin, msg.sender, deadline);
                //reward some-faith token
                uint256 faithGranted = buyTheDipMultiplier * templeOut / 1000; 
                //Reward faith
                faith.gain(msg.sender, faithGranted);
                emit BuyTheDipComplete(msg.sender, templeOut, faithGranted);
          }
    }

    /**
     * Buy the dip and lock. Incentivize people to buy temple when price below threshold
     * To do so user will need to stake and lock for a certain period of time
     */
    function buyTheDipStakeAndLock(uint256 amountStablec, uint256 templeOutMin, uint256 deadline) public whenNotPaused {
          //TODO: add once we have the appropriate logic in place

          (uint reserveTemple, uint reserveFrax,) = pair.getReserves();
          (uint thresholdPriceFrax, uint thresholdPriceTemple) = router.dynamicThresholdPriceWithDecay();
        
          //TODO: figure out a way to check if price has been less that threshold for x number of blocks
          if (thresholdPriceTemple * reserveFrax < thresholdPriceFrax * reserveTemple) {

                uint256 checkPointBlock = router.checkPointBlock();
                require(block.number - checkPointBlock > numBlocksForUnlockIncentive, "AMM Incentivizor: Not Active");
                SafeERC20.safeTransferFrom(stablecToken, msg.sender, address(this), amountStablec);
                SafeERC20.safeIncreaseAllowance(stablecToken, address(router), amountStablec);
                uint256 templeOut = router.swapExactFraxForTemple(amountStablec, templeOutMin, address(this), deadline);
                //reward some-faith token
                uint256 faithGranted = stakeAndLockMultiplier * templeOut / 1000; 
                //Reward faith
                faith.gain(msg.sender, faithGranted);

                // baseApy * (1 + (L/M)/(N/O))*P 
                // L = amount of faith you have
                // M = faith total supply
                // N = temple locked
                // O = total temple in circulating supply
                uint256 circulatingSupply = templeToken.totalSupply() - templeToken.balanceOf(treasury) - templeToken.balanceOf(address(staking)) - templeToken.balanceOf(router.pair()); //TODO: how accurate is this
                uint256 baseIncrease = (faithGranted * circulatingSupply * PRECISION) / ( faith.totalSupply() * templeOut);
                int128 epy = staking.epy();
                  
                // Subtract 1 from epy this staking contract epy is 1 + base
                // baseApy * (1 + (L/M)/(N/O))*P 
                int128 bonusEpy = epy.sub(ABDKMath64x64.fromUInt(1)).mul(scalingFactor.mul(ABDKMath64x64.fromUInt(1).add(ABDKMath64x64.div(ABDKMath64x64.fromUInt(baseIncrease), ABDKMath64x64.fromUInt(PRECISION)))));

                // Compute bonus temple from current temple plus currently locked temple
                uint256 currentOGTempleAmount = ogTempleLocked[msg.sender].amount;
                uint256 bonusTemple = calculateBonusTemple(staking.balance(currentOGTempleAmount) + templeOut, epy, bonusEpy);

                // Stake both minted and bonus temple. Locking up any OGTemple
                uint256 totalTemple = templeOut + bonusTemple;
                SafeERC20.safeIncreaseAllowance(templeToken, address(staking), totalTemple);
                uint256 amountOgTemple = staking.stake(totalTemple);
                lock(msg.sender, amountOgTemple + currentOGTempleAmount);

                emit StakeAndLockComplete(msg.sender, templeOut, bonusTemple, amountOgTemple, faithGranted);
          }
    }

    function calculateBonusTemple(uint256 totalTempleBalance,  int128 baseEpy,int128 bonusEpy) internal view returns(uint256) {
          uint256 numEpochs = unlockDelaySeconds / staking.epochSizeSeconds();
          //bonus-temple = Y * ( [ ( 1 + a + p )  / ( 1 + a )  ] ^ d - 1 ) 
          int128 bonusFactor = ABDKMath64x64.pow(ABDKMath64x64.div(ABDKMath64x64.fromUInt(1).add(bonusEpy), baseEpy), numEpochs).sub(ABDKMath64x64.fromUInt(1));
          return _overflowSafeMul1e18(ABDKMath64x64.divu(totalTempleBalance, 1e18).mul(bonusFactor));
    }

    /*
     * used by contract to lock in OgTemple
    */
    function lock(address account, uint256 _amountOgTemple) internal {
        ogTempleLocked[account] = LockedEntry({amount: _amountOgTemple, lockedUntilTimestamp: block.timestamp + unlockDelaySeconds });
    }

    function unLock() external {
        unLockFor(msg.sender);
    }

    function unLockFor(address account) public {
        LockedEntry memory lockedEntry = ogTempleLocked[account];
        require(lockedEntry.lockedUntilTimestamp < block.timestamp, "AMM Incentivizor: Too soon!");

        SafeERC20.safeTransfer(staking.OG_TEMPLE(), account, lockedEntry.amount);
        ogTempleLocked[account].amount = 0;
    }

    /**
     * Pause contract. For empergency or when underlying logic changes
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * Revert pause
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    function _overflowSafeMul1e18(int128 amountFixedPoint) internal pure returns (uint256) {
        uint256 integralDigits = amountFixedPoint.toUInt();
        uint256 fractionalDigits = amountFixedPoint.sub(ABDKMath64x64.fromUInt(integralDigits)).mul(ABDKMath64x64.fromUInt(1e18)).toUInt();
        return (integralDigits * 1e18) + fractionalDigits;
    }

    function withdrawBalance(IERC20 token, address _to, uint256 _amount)
        external
        onlyOwner
    {
        SafeERC20.safeTransfer(token, _to, _amount);
    }
}
