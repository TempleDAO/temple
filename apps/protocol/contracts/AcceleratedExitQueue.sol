pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";
import "./TempleERC20Token.sol";
import "./ExitQueue.sol";
import "./TempleStaking.sol";


// import "hardhat/console.sol";

/**
 * An accelerated exit queue so we can speed up price discovery while maintaining
 * exit queue ordering
 */
contract AcceleratedExitQueue is Ownable, IExitQueue {
    ExitQueue public exitQueue;
    TempleStaking public staking;
    IERC20 public templeToken;

    // factor at which we will accelerate the current epoch
    uint256 public epochAccelerationFactorNumerator = 5; 

    // factor at which we will accelerate the current epoch
    uint256 public epochAccelerationFactorDenominator = 4; 

    // When do we begin acceleration. Default high number
    // implies it's disabled at launch
    uint256 public accelerationStartAtEpoch = 5000; 

    constructor(IERC20 _templeToken, ExitQueue _exitQueue, TempleStaking _staking) {
        templeToken = _templeToken;
        exitQueue = _exitQueue;
        staking = _staking;
    }

    function currentEpoch() public view returns (uint256) {
        uint currentUnacceleratedEpoch = exitQueue.currentEpoch();

        if (currentUnacceleratedEpoch < accelerationStartAtEpoch) {
            return currentUnacceleratedEpoch;
        }

        return currentUnacceleratedEpoch + 
                ((currentUnacceleratedEpoch - accelerationStartAtEpoch) * epochAccelerationFactorNumerator / epochAccelerationFactorDenominator);
    }

    function setMaxPerEpoch(uint256 _maxPerEpoch) external onlyOwner {
        exitQueue.setMaxPerEpoch(_maxPerEpoch);
    }

    function setMaxPerAddress(uint256 _maxPerAddress) external onlyOwner {
        exitQueue.setMaxPerAddress(_maxPerAddress);
    }

    function setEpochSize(uint256 _epochSize) external onlyOwner {
        exitQueue.setEpochSize(_epochSize);
    }

    function setAccelerationPolicy(uint256 numerator, uint256 denominator, uint256 startAtEpoch) external onlyOwner {
        epochAccelerationFactorNumerator = numerator;
        epochAccelerationFactorDenominator = denominator;
        accelerationStartAtEpoch = startAtEpoch; 
    }

    // leaving this out. Legacy when staking was also by block and we wanted epochs to line up
    //function setStartingBlock(uint256 _firstBlock) external onlyOwner;

    function setOwedTemple(address[] memory _users, uint256[] memory _amounts) external onlyOwner {
        exitQueue.setOwedTemple(_users, _amounts);
    }

    function migrateTempleFromEpochs(uint256[] memory epochs, uint256 length, uint256 expectedAmountTemple) internal {
        uint256 templeBalancePreMigrate = templeToken.balanceOf(address(this));
        exitQueue.migrate(msg.sender, epochs, length, this);
        require((templeToken.balanceOf(address(this)) - templeBalancePreMigrate) == expectedAmountTemple, "Balance increase should be equal to a user's bag for a given exit queue epoch");
    }

    /**
     * Restake the given epochs
     */
    function restake(uint256[] calldata epochs, uint256 length) external {
        uint256 allocation;

        for (uint256 i=0; i<length; i++) {
            allocation += exitQueue.currentEpochAllocation(msg.sender, epochs[i]);
        }
        migrateTempleFromEpochs(epochs, length, allocation);
        SafeERC20.safeIncreaseAllowance(templeToken, address(staking), allocation);
        staking.stakeFor(msg.sender, allocation);
    }

    /**
     * Withdraw processed epochs, at an accelerated rate
     */
    function withdrawEpochs(uint256[] memory epochs, uint256 length) external {
        uint256 totalAmount;
        uint256 maxExitableEpoch = currentEpoch();

        for (uint i = 0; i < length; i++) {
            require(epochs[i] < maxExitableEpoch, "Can only withdraw from processed epochs");
            totalAmount += exitQueue.currentEpochAllocation(msg.sender, epochs[i]);
        }

        migrateTempleFromEpochs(epochs, length, totalAmount);
        SafeERC20.safeTransfer(templeToken, msg.sender, totalAmount);
    }

    /**
     * Required so we can allow all active exit queue buys to be listed, and 'insta exited'
     * when bought.
     *
     * Stores any temple sent to it _temporarily_ via 'marketBuy', with the expectation it will be
     * transferred to the buyer.
     */
    function join(address _exiter, uint256 _amount) override external {
        require(msg.sender == address(exitQueue), "only exit queue");
        {
            _exiter;
        }     
        SafeERC20.safeTransferFrom(templeToken, msg.sender, address(this), _amount);
    }

    /**
     * Disable's by resetting the exit queue owner to the owner of this contract
     */
    function disableAcceleratedExitQueue() external onlyOwner {        
        exitQueue.transferOwnership(owner());
    }
}