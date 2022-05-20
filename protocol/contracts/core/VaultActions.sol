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
import "../ABDKMathQuad.sol";

import "hardhat/console.sol";

contract VaultActions is Ownable{
    using ABDKMathQuad for bytes16;
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

    bytes16 MAX_MULT = ABDKMathQuad.div(ABDKMathQuad.fromUInt(13),ABDKMathQuad.fromUInt(10));
    bytes16 CURVE_MULT = ABDKMathQuad.div(ABDKMathQuad.fromUInt(5),ABDKMathQuad.fromUInt(2));

    function getFaithMultiplier(uint256 _amountFaith, uint256 _amountTemple) view public returns (uint256) {
        // Tl = Ta * min(1.3, (1+faith/2.5*Ta))
        bytes16 amountFaith = ABDKMathQuad.fromUInt(_amountFaith);
        bytes16 amountTemple = ABDKMathQuad.fromUInt(_amountTemple);
        bytes16 t = ABDKMathQuad.fromUInt(1).add(amountFaith.div(CURVE_MULT.mul(amountTemple)));
        bytes16 mult = MAX_MULT < t ? MAX_MULT : t;

        return ABDKMathQuad.toUInt(amountTemple.mul(mult));
    }

    function allowSpendingForVault(address vault) external onlyOwner {
        temple.increaseAllowance(vault, 100000000000000000000000000000);
    }

    function depositTempleWithFaith(uint256 _amountTemple, uint112 _amountFaith, Vault vault, uint256 deadline,uint8 v, bytes32 r, bytes32 s) public {
        faith.redeem(msg.sender, _amountFaith);
        // Tl = Ta * min(1.3, (1+faith/2.5*Ta))
        uint256 amount = getFaithMultiplier(_amountFaith, _amountTemple);
        console.log(amount);
        SafeERC20.safeTransferFrom(temple, msg.sender, address(this), _amountTemple);
        vault.depositFor(msg.sender, amount, amount, deadline, v, r, s);
    }

    
    function withdrawExitQueueAndDepositIntoVault(uint256 _amount, Vault vault, uint256 deadline,uint8 v, bytes32 r, bytes32 s) public {
        (uint256 amount, uint256 firstExitEpoch, uint256 LastExitEpoch) = exitQueue.userData(msg.sender);
        uint256 diff = LastExitEpoch - firstExitEpoch;
        uint256[] memory epochs = new uint256[](diff+1);
        for (uint256 i = 0; i < diff+1; i++) {
            epochs[i] = firstExitEpoch + i;
        } 
        
        acelExitQueue.withdrawEpochsFor(epochs, epochs.length, msg.sender, v,r,s);
        depositTempleFor(_amount, vault, deadline, v, r, s);
    }

    function depositTempleFor(uint256 _amount, Vault vault, uint256 deadline,uint8 v, bytes32 r, bytes32 s) public {
        SafeERC20.safeTransferFrom(temple, msg.sender, address(this), _amount);
        vault.depositFor(msg.sender, _amount, _amount, deadline, v,r,s);
    }
}