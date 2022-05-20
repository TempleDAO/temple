pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./Vault.sol";
import "../OGTemple.sol";
import "../TempleERC20Token.sol";
import "../AcceleratedExitQueue.sol";
import "../core/Vault.sol";
import "../devotion/Faith.sol";

import "hardhat/console.sol";

contract VaultActions is Ownable{
    OGTemple ogTemple;
    TempleERC20Token temple;
    AcceleratedExitQueue acelExitQueue;
    ExitQueue exitQueue;
    TempleStaking templeStaking;
    Faith faith;

    constructor(
        OGTemple _ogTemple,
        TempleERC20Token _temple,
        AcceleratedExitQueue _acelExitQueue,
        ExitQueue _exitQueue,
        TempleStaking _templeStaking,
        Faith _faith
    ) {
        ogTemple = _ogTemple;
        temple = _temple;
        acelExitQueue = _acelExitQueue; 
        exitQueue = _exitQueue;
        templeStaking = _templeStaking;
        faith = _faith;
    }

    function allowSpendingForVault(address vault) external onlyOwner {
        temple.increaseAllowance(vault, 100000000000000000000000000000);
    }

    function depositTempleWithFaith(uint256 _amountTemple, uint112 _amountFaith, Vault vault, uint256 deadline,uint8 v, bytes32 r, bytes32 s) public {
        faith.redeem(msg.sender, _amountFaith);
        // Tl = Ta * min(1.3, (1+faith/2.5*Ta))
        uint256 amount = (_amountTemple * Math.min(13, 10*(1+(10*_amountFaith)/(25*_amountTemple))))/10;
        console.log(amount);
        SafeERC20.safeTransferFrom(temple, msg.sender, address(this), _amountTemple);
        vault.depositFor(msg.sender, amount, amount, deadline, v, r, s);
    }

    /* IGNORE - WIP
    function withdrawExitQueueAndDepositIntoVault(uint256 _amount, Vault vault, uint256 deadline,uint8 v, bytes32 r, bytes32 s) public {
        (uint256 amount, uint256 firstExitEpoch, uint256 LastExitEpoch) = exitQueue.userData(msg.sender);
        uint256 diff = LastExitEpoch - firstExitEpoch;
        uint256[] memory epochs = new uint256[](diff+1);
        for (uint256 i = 0; i < diff+1; i++) {
            epochs[i] = firstExitEpoch + i;
        } 
        
        acelExitQueue.withdrawEpochsFor(epochs, epochs.length, msg.sender, v,r,s);
        depositTempleFor(_amount, vault, deadline, v, r, s);
    }*/

    function depositTempleFor(uint256 _amount, Vault vault, uint256 deadline,uint8 v, bytes32 r, bytes32 s) public {
        SafeERC20.safeTransferFrom(temple, msg.sender, address(this), _amount);
        vault.depositFor(msg.sender, _amount, _amount, deadline, v,r,s);
    }
}