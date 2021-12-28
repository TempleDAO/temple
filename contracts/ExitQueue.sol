pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./TempleERC20Token.sol";


// import "hardhat/console.sol";

// Assumption, any new unstake queue will have the same interface
interface IExitQueue {
    function join(address _exiter, uint256 _amount) external;
}

/**
 * How all exit of TEMPLE rewards are managed.
 */
contract ExitQueue is Ownable {
    struct User {
        // Total currently in queue
        uint256 Amount;

        // First epoch for which the user is in the unstake queue
        uint256 FirstExitEpoch;

        // Last epoch for which the user has a pending unstake
        uint256 LastExitEpoch;

        // All epochs where the user has an exit allocation
        mapping(uint256 => uint256) Exits;
    }

    // total queued to be exited in a given epoch
    mapping(uint256 => uint256) public totalPerEpoch;

    // temple owed by users from buying above $30k
    mapping(address => uint256) public owedTemple;

    // The first unwithdrawn epoch for the user
    mapping(address => User) public userData;

    TempleERC20Token immutable public TEMPLE; // The token being staked, for which TEMPLE rewards are generated

    // Limit of how much temple can exit per epoch
    uint256 public maxPerEpoch;

    // Limit of how much temple can exit per address per epoch
    uint256 public maxPerAddress;

    // epoch size, in blocks
    uint256 public epochSize; 

    // the block we use to work out what epoch we are in
    uint256 public firstBlock;

    // The next free block on which a user can commence their unstake
    uint256 public nextUnallocatedEpoch;

    event JoinQueue(address exiter, uint256 amount);    
    event Withdrawal(address exiter, uint256 amount);    

    constructor(
        TempleERC20Token _TEMPLE,
        uint256 _maxPerEpoch,
        uint256 _maxPerAddress,
        uint256 _epochSize) {

        TEMPLE = _TEMPLE;

        maxPerEpoch = _maxPerEpoch;
        maxPerAddress = _maxPerAddress;
        epochSize = _epochSize;
        firstBlock = block.number;
        nextUnallocatedEpoch = 0;
    }

    function setMaxPerEpoch(uint256 _maxPerEpoch) external onlyOwner {
        maxPerEpoch = _maxPerEpoch;
    }

    function setMaxPerAddress(uint256 _maxPerAddress) external onlyOwner {
        maxPerAddress = _maxPerAddress;
    }

    function setEpochSize(uint256 _epochSize) external onlyOwner {
        epochSize = _epochSize;
    }

    function setStartingBlock(uint256 _firstBlock) external onlyOwner {
        require(_firstBlock < firstBlock, "Can only move start block back, not forward");
        firstBlock = _firstBlock;
    }

    function setOwedTemple(address[] memory _users, uint256[] memory _amounts) external onlyOwner {
        uint256 size = _users.length;
        require(_amounts.length == size, "not of equal sizes");
        for (uint256 i=0; i<size; i++) {
            owedTemple[_users[i]] = _amounts[i];
        }
    }

    function currentEpoch() public view returns (uint256) {
        return (block.number - firstBlock) / epochSize;
    }

    function currentEpochAllocation(address _exiter, uint256 _epoch) external view returns (uint256) {
        return userData[_exiter].Exits[_epoch];
    }

    function join(address _exiter, uint256 _amount) external {        
        require(_amount > 0, "Amount must be > 0");

        uint256 owedAmount = owedTemple[_exiter];
        require(_amount > owedAmount, "owing more than withdraw amount");

        // burn owed temple and update amount
        if (owedAmount > 0) {
            TEMPLE.burnFrom(msg.sender, owedAmount);
            _amount = _amount - owedAmount;
            owedTemple[_exiter] = 0;
        }

        if (nextUnallocatedEpoch < currentEpoch()) {
            nextUnallocatedEpoch = currentEpoch() + 1;
        }

        User storage user = userData[_exiter];

        uint256 unallocatedAmount = _amount;
        uint256 _nextUnallocatedEpoch = nextUnallocatedEpoch;
        uint256 nextAvailableEpochForUser = _nextUnallocatedEpoch;
        if (user.LastExitEpoch > nextAvailableEpochForUser) {
            nextAvailableEpochForUser = user.LastExitEpoch;
        }

        while (unallocatedAmount > 0) {
            // work out allocation for the next available epoch
            uint256 allocationForEpoch = unallocatedAmount;
            if (user.Exits[nextAvailableEpochForUser] + allocationForEpoch > maxPerAddress) {
                allocationForEpoch = maxPerAddress - user.Exits[nextAvailableEpochForUser];
            }
            if (totalPerEpoch[nextAvailableEpochForUser] + allocationForEpoch > maxPerEpoch) {
                allocationForEpoch = maxPerEpoch - totalPerEpoch[nextAvailableEpochForUser];
            }

            // Bookkeeping
            if (allocationForEpoch > 0) {
                if (user.Amount == 0) {
                    user.FirstExitEpoch = nextAvailableEpochForUser;
                }
                user.Amount += allocationForEpoch;
                user.Exits[nextAvailableEpochForUser] += allocationForEpoch;
                totalPerEpoch[nextAvailableEpochForUser] += allocationForEpoch;
                user.LastExitEpoch = nextAvailableEpochForUser;

                if (totalPerEpoch[nextAvailableEpochForUser] >= maxPerEpoch) {
                    _nextUnallocatedEpoch = nextAvailableEpochForUser;
                }

                unallocatedAmount -= allocationForEpoch;
            }

            nextAvailableEpochForUser += 1;
        }

        // update outside of main loop, so we spend gas once
        nextUnallocatedEpoch = _nextUnallocatedEpoch;

        SafeERC20.safeTransferFrom(TEMPLE, msg.sender, address(this), _amount);
        emit JoinQueue(_exiter, _amount);
    }

    /**
     * Withdraw internal per epoch
     */
    function withdrawInternal(uint256 epoch, address sender, bool isMigration) internal returns (uint256 amount) {
        require(epoch < currentEpoch() || isMigration, "Can only withdraw from past epochs");

        User storage user = userData[sender];
        amount = user.Exits[epoch];
        delete user.Exits[epoch];
        totalPerEpoch[epoch] -= amount;
        user.Amount -= amount;
        if (user.Amount == 0) {
            delete userData[sender];
        }
    }

    /**
     * Withdraw processed allowance from multiple epochs
     */
    function withdrawEpochs(uint256[] calldata epochs, uint256 length) external {
        uint256 totalAmount;
        for (uint i = 0; i < length; i++) {
            if (userData[msg.sender].Amount > 0) {
                uint256 amount = withdrawInternal(epochs[i], msg.sender, false);
                totalAmount += amount;
            } 
        }
        SafeERC20.safeTransfer(TEMPLE, msg.sender, totalAmount);
        emit Withdrawal(msg.sender, totalAmount);
    }

    /**
     * Owner only, migrate users between exit queue implementations
     */
    function migrate(address exiter, uint256[] calldata epochs, uint256 length, IExitQueue newExitQueue) external onlyOwner {
        uint256 totalAmount;
        for (uint i = 0; i < length; i++) {
            if (userData[exiter].Amount > 0) {
                uint256 amount = withdrawInternal(epochs[i], exiter, true);
                totalAmount += amount;
            } 
        }
        SafeERC20.safeIncreaseAllowance(TEMPLE, address(newExitQueue), totalAmount);
        newExitQueue.join(exiter, totalAmount);
    }
}