pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./TempleERC20Token.sol";
import "./TempleTreasury.sol";
import "./TempleStaking.sol";
import "./PresaleAllocation.sol";
import "./LockedOGTemple.sol";

/**
 * Presale campaign, which lets users to mint and stake based on current IV and a whitelist
 */
contract Presale is Ownable, Pausable {
    IERC20 public STABLEC; // STABLEC contract address
    TempleERC20Token public TEMPLE; // TEMPLE ERC20 contract
    TempleTreasury public TREASURY;
    TempleStaking public STAKING; // Staking contract
    LockedOGTemple public STAKING_LOCK; // contract where OG Temple is locked
    PresaleAllocation public PRESALE_ALLOCATION; // Allocation per address

    // Unlock timestamp. This will change during the presale period, but will always be in a 2 week range.
    uint256 public unlockTimestamp;

    // presale mint multiple
    uint256 public mintMultiple;

    // How much allocation has each user used.
    mapping(address => uint256) public allocationUsed;

    event MintComplete(address minter, uint256 acceptedStablec, uint256 mintedTemple, uint256 mintedOGTemple);

    constructor(
      IERC20 _STABLEC,
      TempleERC20Token _TEMPLE,
      TempleStaking _STAKING,
      LockedOGTemple _STAKING_LOCK,
      TempleTreasury _TREASURY,
      PresaleAllocation _PRESALE_ALLOCATION,
      uint256 _mintMultiple,
      uint256 _unlockTimestamp) {

      STABLEC = _STABLEC;
      TEMPLE = _TEMPLE;
      STAKING = _STAKING;
      STAKING_LOCK = _STAKING_LOCK;
      TREASURY = _TREASURY;
      PRESALE_ALLOCATION = _PRESALE_ALLOCATION;

      mintMultiple = _mintMultiple;
      unlockTimestamp = _unlockTimestamp;
    }

    function setUnlockTimestamp(uint256 _unlockTimestamp) external onlyOwner {
      unlockTimestamp = _unlockTimestamp;
    }

    /** mint temple and immediately stake, with a bonus + lockin period */
    function mintAndStake(uint256 _amountPaidStablec) external whenNotPaused {
      (uint256 totalAllocation, uint256 allocationEpoch) = PRESALE_ALLOCATION.allocationOf(msg.sender);

      require(_amountPaidStablec + allocationUsed[msg.sender] <= totalAllocation, "Amount requested exceed address allocation");
      require(allocationEpoch <= STAKING.currentEpoch(), "User's allocated epoch is in the future");

      (uint256 _stablec, uint256 _temple) = TREASURY.intrinsicValueRatio();

      allocationUsed[msg.sender] += _amountPaidStablec;
      uint256 _templeMinted = _amountPaidStablec * _temple / _stablec / mintMultiple;
      
      // pull stablec from staker and immediately transfer back to treasury
      SafeERC20.safeTransferFrom(STABLEC, msg.sender, address(TREASURY), _amountPaidStablec);

      // mint temple and allocate to the staking contract
      TEMPLE.mint(address(this), _templeMinted);
      SafeERC20.safeIncreaseAllowance(TEMPLE, address(STAKING), _templeMinted);

      uint256 amountOgTemple = STAKING.stake(_templeMinted);
      SafeERC20.safeIncreaseAllowance(STAKING.OG_TEMPLE(), address(STAKING_LOCK), amountOgTemple);
      STAKING_LOCK.lockFor(msg.sender, amountOgTemple, unlockTimestamp);

      emit MintComplete(msg.sender, _amountPaidStablec, _templeMinted, amountOgTemple);
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