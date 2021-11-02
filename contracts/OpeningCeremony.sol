pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./TempleERC20Token.sol";
import "./SandalwoodToken.sol";
import "./TempleTreasury.sol";
import "./TreasuryManagementProxy.sol";
import "./TempleStaking.sol";
import "./PresaleAllocation.sol";
import "./LockedOGTemple.sol";

/**
 * Mint and Stake for those who have quested in the Opening Ceremony
 */
contract OpeningCeremony is Ownable, Pausable, AccessControl {
    bytes32 public constant CAN_ADD_VERIFIED_USER = keccak256("CAN_ADD_VERIFIED_USER");
    uint256 constant SECONDS_IN_DAY = 24 * 60 * 60;

    IERC20 public stablecToken; // contract address for stable coin used in treasury
    TempleERC20Token public templeToken; // temple ERC20 contract
    TempleTreasury public treasury; // temple treasury
    TreasuryManagementProxy public treasuryManagement; // temple treasury
    TempleStaking public staking; // Staking contract
    LockedOGTemple public lockedOGTemple; // contract where OG Temple is locked

    uint256 public unlockDelaySeconds = SECONDS_IN_DAY * 7 * 6; // How long after after buying can templars unlock
    uint256 public mintMultiple = 6; // presale mint multiple
    uint256 public harvestThresholdStablec; // At what mint level do stakers trigger a harvest
    uint256 public inviteThresholdStablec; // How much does a verified user have to spend before they can invite others
    uint256 public maxInvitesPerVerifiedUser; // How many guests can each verified user invite

    // how much to multiple a verified users day 1 mint limit to work out
    // their total at a given point in time. So for a user who quests 
    // on day 1 => 3 day limit will be DAY_ONE_LIMIT * 4 / 1
    // on day 2 => 3 day limit will be DAY_ONE_LIMIT * 4 / 2
    uint256 public globalDoublingIndex = 1; 
    uint256 public lastUpdatedTimestamp; // when was the limitFactor last updated

    struct Limit {
      uint256 guestMax;
      uint256 verifiedMax;
      uint256 verifiedDayOne;
    }

    Limit public limitStablec = Limit({guestMax: 10000 * 1e18,  verifiedMax: 480000 * 1e18, verifiedDayOne: 30000 * 1e18});
    Limit public limitTemple = Limit({guestMax: 10000 * 1e18,  verifiedMax: 480000 * 1e18, verifiedDayOne: 30000 * 1e18});

    struct Factor {
      uint256 numerator;
      uint256 denominator;
    }
    Factor public verifiedBonusFactor; // Factor applied to verified user, to boost APY
    Factor public guestBonusFactor;    // Factor applied to temple guests, to boost APY

    struct User {
      bool isVerified;
      bool isGuest;
      uint8 numInvited;

      uint256 doublingIndexAtVerification;
      uint256 totalSacrificedStablec;
      uint256 totalSacrificedTemple;
    }

    mapping(address => User) public users;

    event MintComplete(address minter, uint256 acceptedStablec, uint256 mintedTemple, uint256 bonusTemple, uint256 mintedOGTemple);
    event StakeComplete(address staker, uint256 acceptedTemple, uint256 bonusTemple, uint256 mintedOGTemple);
    event VerifiedUserAdded(address user);

    constructor(
      IERC20 _stablecToken,
      TempleERC20Token _templeToken,
      TempleStaking _staking,
      LockedOGTemple _lockedOGTemple,
      TempleTreasury _treasury,
      TreasuryManagementProxy _treasuryManagement,
      uint256 _harvestThresholdStablec,
      uint256 _inviteThresholdStablec,
      uint256 _maxInvitesPerVerifiedUser,
      Factor memory _verifiedBonusFactor,
      Factor memory _guestBonusFactor
    ) {

      stablecToken = _stablecToken;
      templeToken = _templeToken;
      staking = _staking;
      lockedOGTemple = _lockedOGTemple;
      treasury = _treasury;
      treasuryManagement = _treasuryManagement;

      harvestThresholdStablec = _harvestThresholdStablec;
      inviteThresholdStablec = _inviteThresholdStablec;
      maxInvitesPerVerifiedUser = _maxInvitesPerVerifiedUser;
      verifiedBonusFactor = _verifiedBonusFactor;
      guestBonusFactor = _guestBonusFactor;

      lastUpdatedTimestamp = block.timestamp;

      _setupRole(DEFAULT_ADMIN_ROLE, owner());
    }

    function setUnlockDelay(uint256 _unlockDelaySeconds) external onlyOwner {
      unlockDelaySeconds = _unlockDelaySeconds;
    }

    function setMintMultiple(uint256 _mintMultiple) external onlyOwner {
      mintMultiple = _mintMultiple;
    }

    function setHarvestThreshold(uint256 _harvestThresholdStablec) external onlyOwner {
      harvestThresholdStablec = _harvestThresholdStablec;
    }

    function setInviteThreshold(uint256 _inviteThresholdStablec) external onlyOwner {
      inviteThresholdStablec = _inviteThresholdStablec;
    }

    function setMaxInvitesPerVerifiedUser(uint256 _maxInvitesPerVerifiedUser) external onlyOwner {
      maxInvitesPerVerifiedUser = _maxInvitesPerVerifiedUser;
    }

    function setVerifiedBonusFactor(uint256 _numerator, uint256 _denominator) external onlyOwner {
      verifiedBonusFactor.numerator = _numerator;
      verifiedBonusFactor.denominator = _denominator;
    }

    function setGuestBonusFactor(uint256 _numerator, uint256 _denominator) external onlyOwner {
      guestBonusFactor.numerator = _numerator;
      guestBonusFactor.denominator = _denominator;
    }


    function setLimitStablec(uint256 guestMax, uint256 verifiedMax, uint256 verifiedDayOne) external onlyOwner {
      limitStablec.guestMax = guestMax;
      limitStablec.verifiedMax = verifiedMax;
      limitStablec.verifiedDayOne = verifiedDayOne;
    }

    function setLimitTemple(uint256 guestMax, uint256 verifiedMax) external onlyOwner {
      limitTemple.guestMax = guestMax;
      limitTemple.verifiedMax = verifiedMax;
      // unused limitTemple.verifiedDayOne
    }

    function addVerifier(address account) external onlyOwner {
      grantRole(CAN_ADD_VERIFIED_USER, account);
    }

    function removeVerifier(address account) external onlyOwner {
      revokeRole(CAN_ADD_VERIFIED_USER, account);
    }

    function addVerifiedUser(address userAddress) external {
      require(hasRole(CAN_ADD_VERIFIED_USER, msg.sender), "Caller cannot add verified user");
      require(!users[userAddress].isVerified, "Address already verified");
      users[userAddress].isVerified = true;
      users[userAddress].doublingIndexAtVerification = globalDoublingIndex;

      emit VerifiedUserAdded(userAddress);
    }

    function addGuestUser(address userAddress) external {
      require(users[msg.sender].isVerified, "only verified users can invite guests");
      require(users[msg.sender].totalSacrificedStablec >= inviteThresholdStablec, 
        "Need to sacrifice more frax before you can invite others");
      require(users[msg.sender].numInvited < maxInvitesPerVerifiedUser,
        "Exceed maximum number of invites");

      users[userAddress].isGuest = true;
      users[msg.sender].numInvited += 1;
    }

    /** mint temple and immediately stake, on behalf of a staker, with a bonus + lockin period */
    function mintAndStakeFor(address _staker, uint256 _amountPaidStablec) public whenNotPaused {
      User storage userInfo = users[_staker];

      // update max limit. This happens before checks, to ensure maxSacrificable
      // is correctly calculated.
      if ((block.timestamp - lastUpdatedTimestamp) > SECONDS_IN_DAY) {
        globalDoublingIndex *= 2;
        lastUpdatedTimestamp += SECONDS_IN_DAY;
      }

      Factor storage bonusFactor;
      if (userInfo.isVerified) {
        require(
          userInfo.totalSacrificedStablec + _amountPaidStablec <= maxSacrificableStablec(userInfo.doublingIndexAtVerification),
          "Exceeded max mint limit");
        bonusFactor = verifiedBonusFactor;
      } else if (userInfo.isGuest) {
        require(userInfo.totalSacrificedStablec + _amountPaidStablec <= limitStablec.guestMax, "Exceeded max mint limit");
        bonusFactor = guestBonusFactor;
      } else {
        revert("Only verified templars and their guests can partake in the opening ceremony");
      }

      (uint256 _stablec, uint256 _temple) = treasury.intrinsicValueRatio();
      uint256 _boughtTemple = _amountPaidStablec * _temple / _stablec / mintMultiple;
      
      // Calculate extra temple required to account for bonus APY
      uint256 _bonusTemple = _boughtTemple * bonusFactor.numerator / bonusFactor.denominator;
      uint256 _totalTemple = _boughtTemple + _bonusTemple;

      userInfo.totalSacrificedStablec += _amountPaidStablec;

      // pull stablec from staker and immediately transfer back to treasury
      SafeERC20.safeTransferFrom(stablecToken, msg.sender, address(treasury), _amountPaidStablec);

      // mint temple
      templeToken.mint(address(this), _totalTemple);

      // Stake both minted and bonus temple. Locking up any OGTemple
      SafeERC20.safeIncreaseAllowance(templeToken, address(staking), _totalTemple);
      uint256 _amountOgTemple = staking.stake(_totalTemple);
      SafeERC20.safeIncreaseAllowance(staking.OG_TEMPLE(), address(lockedOGTemple), _amountOgTemple);
      lockedOGTemple.lockFor(_staker, _amountOgTemple, block.timestamp + unlockDelaySeconds);

      // Finally, run harvest if amount sacrificed is 10k or greater
      if (_amountPaidStablec >= harvestThresholdStablec) {
        treasuryManagement.harvest();
      }

      emit MintComplete(_staker, _amountPaidStablec, _boughtTemple, _bonusTemple, _amountOgTemple);
    }

    /** mint temple and immediately stake, with a bonus + lockin period */
    function mintAndStake(uint256 _amountPaidStablec) external whenNotPaused {
      mintAndStakeFor(msg.sender, _amountPaidStablec);
    }

    /** Stake temple, consuming sandalwood to get bonus APY **/
    function stakeFor(address _staker, uint256 _amountTemple) public whenNotPaused {
      User storage userInfo = users[_staker];

      Factor storage bonusFactor;
      if (userInfo.isVerified) {
        require(userInfo.totalSacrificedTemple + _amountTemple <= limitTemple.verifiedMax, "exceeded max limit");
        bonusFactor = verifiedBonusFactor;
      } else if (userInfo.isGuest) {
        require(userInfo.totalSacrificedTemple + _amountTemple <= limitTemple.guestMax, "exceeded max limit");
        bonusFactor = guestBonusFactor;
      } else {
        revert("Only verified templars and their guests can partake in the opening ceremony");
      }

      // Calculate extra temple required to account for bonus APY
      uint256 _bonusTemple = _amountTemple * bonusFactor.numerator / bonusFactor.denominator;
      uint256 _totalTemple = _amountTemple + _bonusTemple;

      userInfo.totalSacrificedTemple += _amountTemple;

      // pull temple from caller (to be staked)
      SafeERC20.safeTransferFrom(templeToken, msg.sender, address(this), _amountTemple);

      // mint bonus APY temple
      templeToken.mint(address(this), _bonusTemple);

      // Stake both minted and bonus temple. Locking up any OGTemple
      SafeERC20.safeIncreaseAllowance(templeToken, address(staking), _totalTemple);
      uint256 _amountOgTemple = staking.stake(_totalTemple);
      SafeERC20.safeIncreaseAllowance(staking.OG_TEMPLE(), address(lockedOGTemple), _amountOgTemple);
      lockedOGTemple.lockFor(_staker, _amountOgTemple, block.timestamp + unlockDelaySeconds);

      emit StakeComplete(_staker, _amountTemple, _bonusTemple, _amountOgTemple);
    }

    /** Stake temple, consuming sandalwood to get bonus APY **/
    function stake(uint256 _amountTemple) external whenNotPaused {
      stakeFor(msg.sender, _amountTemple);
    }

    /**
     * Pause contract. Either emergency or at the end of presale
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

    function maxSacrificableStablec(uint256 doublingIndexAtVerification) public view returns(uint256 maxLimit) {
      maxLimit = limitStablec.verifiedDayOne * globalDoublingIndex / doublingIndexAtVerification;
      if (maxLimit > limitStablec.verifiedMax) {
        maxLimit = limitStablec.verifiedMax;
      }
    }
}
