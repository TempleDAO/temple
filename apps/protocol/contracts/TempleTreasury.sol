pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./TempleERC20Token.sol";
import "./ITreasuryAllocation.sol";
import "./MintAllowance.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// import "hardhat/console.sol";

contract TempleTreasury is Ownable {
    // Underlying TEMPLE token
    TempleERC20Token private TEMPLE;

    // underlying stable token we are holding and valuing treasury with
    IERC20 private STABLEC;

    // Minted temple allocated to various investment contracts
    MintAllowance public MINT_ALLOWANCE;

    // Ratio of treasury value in stablec to open supply of temple.
    struct IntrinsicValueRatio {
      uint256 stablec;
      uint256 temple;
    } 
    IntrinsicValueRatio public intrinsicValueRatio;

    // Temple rewards harvested, and (yet) to be allocated to a pool
    uint256 public harvestedRewardsTemple;

    // Has treasury been seeded with STABLEC yet (essentially, has seedMint been called)
    // this will bootstrap IV
    bool public seeded = false;

    // all active pools. A pool is anything
    // that gets allocated some portion of harvest
    address[] public pools;
    mapping(address => uint96) public poolHarvestShare;
    uint96 public totalHarvestShares;

    // Current treasury STABLEC allocations
    mapping(ITreasuryAllocation => uint256) public treasuryAllocationsStablec;
    uint256 public totalAllocationStablec;

    event RewardsHarvested(uint256 _amount);
    event HarvestDistributed(address _contract, uint256 _amount);

    constructor(TempleERC20Token _TEMPLE, IERC20 _STABLEC) {
      TEMPLE = _TEMPLE;
      STABLEC = _STABLEC;
      MINT_ALLOWANCE = new MintAllowance(_TEMPLE);
    }

    function numPools() external view returns (uint256) {
      return pools.length;
    }

    /**
     * Seed treasury with STABLEC and Temple to bootstrap
     */
    function seedMint(uint256 amountStablec, uint256 amountTemple) external onlyOwner {
      require(!seeded, "Owner has already seeded treasury");
      seeded = true;

      // can this go in the constructor?
      intrinsicValueRatio.stablec = amountStablec;
      intrinsicValueRatio.temple = amountTemple;

      SafeERC20.safeTransferFrom(STABLEC, msg.sender, address(this), amountStablec);
      TEMPLE.mint(msg.sender, amountTemple);
    }

    /**
     * Harvest rewards.
     *
     * For auditing, we harvest and allocate in two steps
     */
    function harvest(uint256 distributionPercent) external onlyOwner {
      require(distributionPercent <= 100, "Scaling factor interpreted as a %, needs to be between 0 (no harvest) and 100 (max harvest)");

      uint256 reserveStablec = STABLEC.balanceOf(address(this)) + totalAllocationStablec;

      // // Burn any excess temple, that is Any temple over and beyond harvestedRewardsTemple.
      // // NOTE: If we don't do this, IV could drop...
      if (TEMPLE.balanceOf(address(this)) > harvestedRewardsTemple) {
        // NOTE: there isn't a Reentrancy issue as we control the TEMPLE ERC20 contract, and configure
        //       treasury with an address on contract creation
        TEMPLE.burn(TEMPLE.balanceOf(address(this)) - harvestedRewardsTemple);
      }

      uint256 totalSupplyTemple = TEMPLE.totalSupply() - TEMPLE.balanceOf(address(MINT_ALLOWANCE));
      uint256 impliedSupplyAtCurrentIVTemple = reserveStablec * intrinsicValueRatio.temple / intrinsicValueRatio.stablec;

      require(impliedSupplyAtCurrentIVTemple >= totalSupplyTemple, "Cannot run harvest when IV drops");

      uint256 newHarvestTemple = (impliedSupplyAtCurrentIVTemple - totalSupplyTemple) * distributionPercent / 100;
      harvestedRewardsTemple += newHarvestTemple;

      intrinsicValueRatio.stablec = reserveStablec;
      intrinsicValueRatio.temple = totalSupplyTemple + newHarvestTemple;

      TEMPLE.mint(address(this), newHarvestTemple);
      emit RewardsHarvested(newHarvestTemple);
    }

    /**
     * ResetIV
     *
     * Not expected to be used in day to day operations, as opposed to harvest which
     * will be called ~ once per epoch.
     *
     * Only to be called if we have to post a treasury loss, and restart IV growth from
     * a new baseline.
     */
    function resetIV() external onlyOwner {
      uint256 reserveStablec = STABLEC.balanceOf(address(this)) + totalAllocationStablec;
      uint256 totalSupplyTemple = TEMPLE.totalSupply() - TEMPLE.balanceOf(address(MINT_ALLOWANCE));
      intrinsicValueRatio.stablec = reserveStablec;
      intrinsicValueRatio.temple = totalSupplyTemple;
    }

    /**
     * Allocate rewards to each pool.
     */
    function distributeHarvest() external onlyOwner {
      // transfer rewards as per defined allocation
      uint256 totalAllocated = 0;
      for (uint256 i = 0; i < pools.length; i++) {
        uint256 allocatedRewards = harvestedRewardsTemple * poolHarvestShare[pools[i]] / totalHarvestShares;

        // integer rounding may cause the last allocation to exceed harvested
        // rewards. Handle gracefully
        if ((totalAllocated + allocatedRewards) > harvestedRewardsTemple) {
          allocatedRewards = harvestedRewardsTemple - totalAllocated;
        }
        totalAllocated += allocatedRewards;
        SafeERC20.safeTransfer(TEMPLE, pools[i], allocatedRewards);
        emit HarvestDistributed(pools[i], allocatedRewards);
      }
      harvestedRewardsTemple -= totalAllocated;
    }

    /**
     * Mint and Allocate treasury TEMPLE.
     */
    function mintAndAllocateTemple(address _contract, uint256 amountTemple) external onlyOwner {
      require(amountTemple > 0, "TEMPLE to mint and allocate must be > 0");

      // Mint and Allocate TEMPLE via MINT_ALLOWANCE helper
      TEMPLE.mint(address(this), amountTemple);
      SafeERC20.safeIncreaseAllowance(TEMPLE, address(MINT_ALLOWANCE), amountTemple);
      MINT_ALLOWANCE.increaseMintAllowance(_contract, amountTemple);
    }

    /**
     * Burn minted temple associated with a specific contract
     */
    function unallocateAndBurnUnusedMintedTemple(address _contract) external onlyOwner {
      MINT_ALLOWANCE.burnUnusedMintAllowance(_contract);
    }

    /**
     * Allocate treasury STABLEC.
     */
    function allocateTreasuryStablec(ITreasuryAllocation _contract, uint256 amountStablec) external onlyOwner {
      require(amountStablec > 0, "STABLEC to allocate must be > 0");

      treasuryAllocationsStablec[_contract] += amountStablec;
      totalAllocationStablec += amountStablec;
      SafeERC20.safeTransfer(STABLEC, address(_contract), amountStablec);
    }

    /**
     * Update treasury with latest mark to market for a given treasury allocation
     */
    function updateMarkToMarket(ITreasuryAllocation _contract) external onlyOwner {
      uint256 oldReval = treasuryAllocationsStablec[_contract];
      uint256 newReval = _contract.reval();
      totalAllocationStablec = totalAllocationStablec + newReval - oldReval;
      treasuryAllocationsStablec[_contract] = newReval;
    }

    /**
     * Withdraw from a contract. 
     *
     * Expects that pre-withdrawal reval() includes the unwithdrawn allowance, and post withdrawal reval()
     * drops by exactly this amount.
     */
    function withdraw(ITreasuryAllocation _contract) external onlyOwner {
      uint256 preWithdrawlReval = _contract.reval();
      uint256 pendingWithdrawal = STABLEC.allowance(address(_contract), address(this));

      // NOTE: Reentrancy considered and it's safe STABLEC is a well known unchanging contract
      SafeERC20.safeTransferFrom(STABLEC, address(_contract), address(this), pendingWithdrawal);
      uint256 postWithdrawlReval = _contract.reval();

      totalAllocationStablec = totalAllocationStablec - pendingWithdrawal;
      treasuryAllocationsStablec[_contract] -= pendingWithdrawal;

      require(postWithdrawlReval + pendingWithdrawal == preWithdrawlReval);
    }

    /**
     * Withdraw from a contract which has some treasury allocation 
     *
     * Ejects a contract out of treasury, pulling in any allowance of STABLEC
     * We only expect to use this if (for whatever reason). The booking in
     * The given TreasuryAllocation results in withdraw not working.
     * 
     * Precondition, contract given has allocated all of it's Stablec assets
     * to be transfered into treasury as an allowance.
     *
     * This will only ever reduce treasury IV.
     */
    function ejectTreasuryAllocation(ITreasuryAllocation _contract) external onlyOwner {
      uint256 pendingWithdrawal = STABLEC.allowance(address(_contract), address(this));
      totalAllocationStablec -= treasuryAllocationsStablec[_contract];
      treasuryAllocationsStablec[_contract] = 0;
      SafeERC20.safeTransferFrom(STABLEC, address(_contract), address(this), pendingWithdrawal);
    }

    /**
     * Add or update a pool, and transfer in treasury assets
     */
    function upsertPool(address _contract, uint96 _poolHarvestShare) external onlyOwner {
      require(_poolHarvestShare > 0, "Harvest share must be > 0");

      totalHarvestShares = totalHarvestShares + _poolHarvestShare - poolHarvestShare[_contract];

      // first time, add contract to array as well
      if (poolHarvestShare[_contract] == 0) { 
        pools.push(_contract);
      }

      poolHarvestShare[_contract] = _poolHarvestShare;
    }

    /**
     * Remove a given investment pool.
     */
    function removePool(uint256 idx, address _contract) external onlyOwner {
      require(idx < pools.length, "No pool at the specified index");
      require(pools[idx] == _contract, "Pool at index and passed in address don't match");

      pools[idx] = pools[pools.length-1];
      pools.pop();
      totalHarvestShares -= poolHarvestShare[_contract];
      delete poolHarvestShare[_contract];
    }
}