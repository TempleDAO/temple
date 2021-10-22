pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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
contract OpeningCeremony is Ownable, Pausable {
    uint256 constant STABLEC_ALLOWANCE_PER_SANDALWOOD = 1000;

    IERC20 public stablecToken; // contract address for stable coin used in treasury
    TempleERC20Token public templeToken; // temple ERC20 contract
    SandalwoodToken public sandalwoodToken; // sandalwood burned to work out a users allowed allocation
    TempleTreasury public treasury; // temple treasury
    TreasuryManagementProxy public treasuryManagement; // temple treasury
    TempleStaking public staking; // Staking contract
    LockedOGTemple public lockedOGTemple; // contract where OG Temple is locked

    uint256 public unlockDelaySeconds; // How long after after buying can templars unlock
    uint256 public mintMultiple; // presale mint multiple
    uint256 public harvestThreshold; // At what mint level do stakers trigger a harvest

    struct Factor {
      uint256 numerator;
      uint256 denominator;
    }
    Factor public bonusFactor; // Factor applied to minted temple, to work out (effective) bonus APY

    // How much allocation has each user used.
    mapping(address => uint256) public sandalwoodBurned;

    event MintComplete(address minter, uint256 sandalwoodBurned, uint256 acceptedStablec, uint256 mintedTemple, uint256 bonusTemple, uint256 mintedOGTemple);

    constructor(
      IERC20 _stablecToken,
      TempleERC20Token _templeToken,
      SandalwoodToken _sandalwoodToken,
      TempleStaking _staking,
      LockedOGTemple _lockedOGTemple,
      TempleTreasury _treasury,
      TreasuryManagementProxy _treasuryManagement,
      uint256 _mintMultiple,
      uint256 _unlockDelaySeconds,
      uint256 _harvestThreshold,
      Factor memory _bonusFactor) {

      stablecToken = _stablecToken;
      templeToken = _templeToken;
      sandalwoodToken = _sandalwoodToken;
      staking = _staking;
      lockedOGTemple = _lockedOGTemple;
      treasury = _treasury;
      treasuryManagement = _treasuryManagement;

      mintMultiple = _mintMultiple;
      unlockDelaySeconds = _unlockDelaySeconds;
      harvestThreshold = _harvestThreshold;
      bonusFactor = _bonusFactor;
    }

    function setUnlockDelay(uint256 _unlockDelaySeconds) external onlyOwner {
      unlockDelaySeconds = _unlockDelaySeconds;
    }

    function setMintMultiple(uint256 _mintMultiple) external onlyOwner {
      mintMultiple = _mintMultiple;
    }

    function setHarvestThreshold(uint256 _harvestThreshold) external onlyOwner {
      harvestThreshold = _harvestThreshold;
    }

    function setBonusFactor(uint256 _numerator, uint256 _denominator) external onlyOwner {
      bonusFactor.numerator = _numerator;
      bonusFactor.denominator = _denominator;
    }

    /** mint temple and immediately stake, on behalf of a staker, with a bonus + lockin period */
    function mintAndStakeFor(address _staker, uint256 _amountSandalwood, uint256 _amountPaidStablec) public whenNotPaused {
      require(_amountPaidStablec == _amountSandalwood * STABLEC_ALLOWANCE_PER_SANDALWOOD, "Insufficient Sandalwood offered for requested amount");

      (uint256 _stablec, uint256 _temple) = treasury.intrinsicValueRatio();

      sandalwoodBurned[_staker] += _amountSandalwood;
      uint256 _templeMinted = _amountPaidStablec * _temple / _stablec / mintMultiple;
      
      // pull stablec from staker and immediately transfer back to treasury
      SafeERC20.safeTransferFrom(stablecToken, msg.sender, address(treasury), _amountPaidStablec);

      // burn sandalwood offered
      sandalwoodToken.burnFrom(msg.sender, _amountSandalwood);

      // mint temple
      templeToken.mint(address(this), _templeMinted);

      // Calculate extra temple required to account for bonus APY offered to questers
      uint _bonusTemple = _templeMinted * bonusFactor.numerator / bonusFactor.denominator;

      // Stake both minted and bonus temple. Locking up any OGTemple
      SafeERC20.safeIncreaseAllowance(templeToken, address(staking), _templeMinted + _bonusTemple);
      uint256 _amountOgTemple = staking.stake(_templeMinted + _bonusTemple);
      SafeERC20.safeIncreaseAllowance(staking.OG_TEMPLE(), address(lockedOGTemple), _amountOgTemple);
      lockedOGTemple.lockFor(_staker, _amountOgTemple, block.timestamp + unlockDelaySeconds);

      // Finally, run harvest if amount sacrificed is 10k or greater
      if (_amountPaidStablec > harvestThreshold) {
        treasuryManagement.harvest();
      }

      emit MintComplete(_staker, _amountSandalwood, _amountPaidStablec, _templeMinted, _bonusTemple, _amountOgTemple);
    }

    /** mint temple and immediately stake, with a bonus + lockin period */
    function mintAndStake(uint256 _amountSandalwood, uint256 _amountPaidStablec) external whenNotPaused {
      mintAndStakeFor(msg.sender, _amountSandalwood, _amountPaidStablec);
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
}
