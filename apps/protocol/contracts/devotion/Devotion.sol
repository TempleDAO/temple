pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later


import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/v2-periphery/contracts/libraries/UniswapV2OracleLibrary.sol';
import '@uniswap/lib/contracts/libraries/FixedPoint.sol';
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../TempleERC20Token.sol";
import "../TempleStaking.sol";
import "../LockedOGTemple.sol";
import "./IFaith.sol";

/*
 * - Game masters can initiate a new round. Each round has a targetPrice.
 * - At some point the game masters ends the game via two contract interactions
 *      1/ checkpoint the price/timestamp for when we are calculating the TWAP
 *      2/ End the game, and mark it as 'won' if the TWAP > targetPrice
 * - Players earn FAITH by locking OGTemple while the game is active
 * - Once a game is won, all FAITH holders can swap faith for OGTemple.
 */
contract Devotion is Ownable {

    // contract variables
    IFaith public faith;
    IERC20 public templeToken;
    IUniswapV2Pair public pair;
    LockedOGTemple public lockedOGTemple;
    TempleStaking public templeStaking;

    // Minimum Lock Period to be able to claim faith
    uint256 public minimumLockPeriod;

    // Temple cumulative price stored during the initiation of final Hour
    uint256 public priceCumulativeLastTemple;
    uint256 public priceCumulativeLastTimestamp;

    // target price for currentDevotion round
    uint256 public targetPriceAverageTemple;

    // ACL for devotion game
    mapping(address => bool) public devotionMaster;

    // Game stats
    enum Stage { InProgress, FinalHour, Finished }
    struct RoundStats {
        Stage stage;
        bool  isWon;
    }

    // Info on game rounds (key is the round number)
    mapping(uint8 => RoundStats) public roundStatus;
    mapping(uint8 => mapping(address => bool)) public verifiedFaith;

    // Logs
    event StartDevotion(uint256 targetPriceNum, uint256 targetPriceDenom, uint8 currentRound);
    event InitiateFinalHour(uint256 templePriceCumulativeLast, uint256 blockTimeStampLast, uint8 currentRound);
    event EndDevotion(uint256 templePriceAverage, bool GameWon);
    event VerifyFaith(address account, uint256 faithAmount, uint256 lockedOgTempleAmount, uint256 lockedUntilTimeStamp);
    event LockAndVerifyFaith(address account, uint256 faithAmount, uint256 lockedOgTempleAmount, uint256 lockedUntilTimeStamp);
    event ClaimTempleRewards(address account, uint256 faithUsed, uint256 templeRewarded);

    // Current Devotion Game Round
    uint8 public currentRound;

    constructor(
      IERC20 _templeToken,
      IFaith _faith,
      IUniswapV2Pair _pair,
      LockedOGTemple _lockedOGTemple,
      TempleStaking _staking,
      uint256 _minimumLockPeriod
    ) {

      templeToken = _templeToken;
      faith = _faith;
      pair   = _pair;
      lockedOGTemple = _lockedOGTemple;
      templeStaking = _staking;
      minimumLockPeriod = _minimumLockPeriod;

      // on deployment, we want 'round 0' to be inactive (that is, we have an active game only if startDevotion is called)
      roundStatus[currentRound].stage = Stage.Finished;
    }

    /*
     * Set minimum og-temple lock period to be eligible for faith claiming
     */
    function setMinimumLockPeriod(uint256 _minimumLockPeriod) external onlyOwner {
        minimumLockPeriod = _minimumLockPeriod;
    }

    /*
     * Add a devotion Master
     */
    function addDevotionMaster(address _account) external onlyOwner {
        devotionMaster[_account] = true;
    }

    /*
     * Remove a devotion master
     */
    function removeDevotionMaster(address _account) external onlyOwner {
        devotionMaster[_account] = false;
    }

    /*
     * Start a diffent round of devotion with a traget price
     */
    function startDevotion(uint112 targetPriceNum, uint112 targetPriceDenom) external {
        require(devotionMaster[msg.sender], "Devotion: Only Game Master");

        targetPriceAverageTemple = FixedPoint.fraction(targetPriceNum, targetPriceDenom)._x;
        unchecked {
            currentRound = currentRound + 1;
        }
        delete roundStatus[currentRound];

        emit StartDevotion(targetPriceNum, targetPriceDenom, currentRound);
    }

    /*
     * Intiate Final hour for current devotion round
     * Assumes startDevotion has run before this call
     */
    function initiateDevotionFinalHour() external  {
        require(devotionMaster[msg.sender], "Devotion: Only Game Master");
        require(roundStatus[currentRound].stage == Stage.InProgress, "Devotion: can only transition from a in progress game to Final Hour");

        // Register the current cumulative price
        (uint256 templePriceCumulative, , uint256 blockTimestamp) = UniswapV2OracleLibrary.currentCumulativePrices(address(pair));
        priceCumulativeLastTemple = templePriceCumulative;
        priceCumulativeLastTimestamp = blockTimestamp;
        roundStatus[currentRound].stage = Stage.FinalHour;

        emit InitiateFinalHour(priceCumulativeLastTemple, priceCumulativeLastTimestamp, currentRound);
    }

    /*
     * End the current Round.
     * Decide wheather the current game is won or not
     * Assumes initiateDevotionFinalHour has been run before
     */
    function endDevotionRound() external {
        require(devotionMaster[msg.sender], "Devotion: Only Game Master");
        require(roundStatus[currentRound].stage == Stage.FinalHour, "Devotion: can only transition from Final Hour to end round");

        (uint256 templePriceCumulative, , uint256 blockTimestamp) = UniswapV2OracleLibrary.currentCumulativePrices(address(pair));
        uint256 timeElapsed = blockTimestamp - priceCumulativeLastTimestamp;
        uint256 templePriceAverage = (templePriceCumulative - priceCumulativeLastTemple) / timeElapsed;

        if (templePriceAverage > targetPriceAverageTemple) {
            // The game has been won
            roundStatus[currentRound].isWon = true;
        }
        roundStatus[currentRound].stage = Stage.Finished;
        emit EndDevotion(templePriceAverage,  roundStatus[currentRound].isWon);
    }

    /*
     * Used by OGTemple Holders to verify their faith
     */
    function verifyFaith() external {
        require(roundStatus[currentRound].stage < Stage.Finished, "!VERIFY: UNAVAILABLE"); // as long as game hasn't ended
        require(verifiedFaith[currentRound][msg.sender] == false, "!VERIFY: ALREADY CLAIMED");
        (uint256 lockedOGTempleAmount,  uint256 lockedUntilTimestamp) = lockedOGTemple.ogTempleLocked(msg.sender);

        require(lockedUntilTimestamp > block.timestamp + minimumLockPeriod, "!VERIFY: LOCK NOT ENOUGH");

        uint256 claimableFaith = lockedOGTempleAmount / 10**18; // Will round out
        faith.gain(msg.sender, uint112(claimableFaith));
        verifiedFaith[currentRound][msg.sender] = true;
        emit VerifyFaith(msg.sender, claimableFaith, lockedOGTempleAmount, lockedUntilTimestamp);
    }

    /*
     * Used this to autolock new  OGTemple and verify faith
     */
    function lockAndVerify(uint256 amountOGTemple) external {
        require(roundStatus[currentRound].stage < Stage.Finished, "!VERIFY: UNAVAILABLE"); // as long as game hasn't ended
        require(verifiedFaith[currentRound][msg.sender] == false, "!VERIFY: ALREADY CLAIMED");

        // If relocking new OG-Temple
        lockedOGTemple.lockFor(msg.sender, amountOGTemple, minimumLockPeriod); // If already locked for longer will use the Max
        (uint256 lockedOGTempleAmount,  uint256 newLockedUntilTimestamp) = lockedOGTemple.ogTempleLocked(msg.sender);
        uint256 claimableFaith = lockedOGTempleAmount / 10**18; // Will round out
        require(claimableFaith > 0, "NO CLAIMABLE FAITH");
        faith.gain(msg.sender, uint112(claimableFaith));
        verifiedFaith[currentRound][msg.sender] = true;
        emit LockAndVerifyFaith(msg.sender, claimableFaith, lockedOGTempleAmount, newLockedUntilTimestamp);
    }

    /*
     * Let users use their faith to claim templeRewards from prize pool
     */
    function claimTempleReward(uint112 amountFaith) public returns(uint256 amountOgTempleRewarded) {
        require(roundStatus[currentRound].isWon, "!VERIFY: UNAVAILABLE");

        uint256 faithTotalSupply = faith.totalSupply();
        uint256 templePrizePool = templeToken.balanceOf(address(this));

        uint256 claimableTempleReward = (amountFaith * templePrizePool) / faithTotalSupply;
        faith.redeem(msg.sender, uint112(amountFaith));
        SafeERC20.safeIncreaseAllowance(templeToken, address(templeStaking), claimableTempleReward);
        amountOgTempleRewarded =  templeStaking.stakeFor(msg.sender, claimableTempleReward);

        emit ClaimTempleRewards(msg.sender, amountFaith, claimableTempleReward);
    }

    /*
     * Quote how much temple reward available for a give amount of faith
     */
    function claimableTempleRewardQuote(uint256 amountFaith) external view returns(uint256) {
        uint256 faithTotalSupply = faith.totalSupply();
        uint256 templePrizePool = templeToken.balanceOf(address(this));
        return (amountFaith * templePrizePool) / faithTotalSupply;
    }

    /*
     * Get amount of claimable faith for a user
     */
    function verifyFaithQuote(address _account) external view returns(bool canClaim, uint256 claimableFaith) {
        (uint256 lockedOGTempleAmount,  uint256 lockedUntilTimestamp) = lockedOGTemple.ogTempleLocked(_account);
        uint256 lockedPeriod = lockedUntilTimestamp >  block.timestamp ? lockedUntilTimestamp - block.timestamp : 0;
        if (lockedPeriod > minimumLockPeriod) {
            canClaim = true;
            claimableFaith = lockedOGTempleAmount / 10**18;
        }
    }

    // function canClaimFaith(address account) public view returns(bool) {
    //      return roundStatus[currentRound].stage == 2 && verifiedFaith[currentRound][account] == false;
    // }

    // function canClaimTempleRewards() external view returns(bool) {
    //     return roundStatus[currentRound].isWon == true;
    // }

    // function getDevotionIsActive() external view returns(bool) {
    //     return roundStatus[currentRound].stage != 2;
    // }

    // function getIsFinalHourActive() external view returns(bool) {
    //     return roundStatus[currentRound].stage == 1;
    // }

    function withdrawBalance(IERC20 token, address _to, uint256 _amount)
        external
        onlyOwner
    {
        SafeERC20.safeTransfer(token, _to, _amount);
    }
}
