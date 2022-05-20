pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./Vault.sol";
import "../ABDKMathQuad.sol";
import {IExitQueue} from "../ExitQueue.sol";
import "../OGTemple.sol";
import "../TempleERC20Token.sol";
import "../TempleStaking.sol";
import "../core/Vault.sol";
import "../devotion/Faith.sol";

import "hardhat/console.sol";

/**
    @notice A proxy contract for interacting with Temple Vaults. 
 */
contract VaultActions is Ownable, IExitQueue{
    using ABDKMathQuad for bytes16;
    OGTemple ogTemple;
    TempleERC20Token temple;
    TempleStaking templeStaking;
    Faith faith;

    constructor(
        OGTemple _ogTemple,
        TempleERC20Token _temple,
        TempleStaking _templeStaking,
        Faith _faith
    ) {
        ogTemple = _ogTemple;
        temple = _temple;
        templeStaking = _templeStaking;
        faith = _faith;
    }

    bytes16 private MAX_MULT = 0x3fff4ccccccccccccccccccccccccccc; // 1.3
    bytes16 private TA_MULT = 0x40004000000000000000000000000000; // 2.5

    function join(address _exiter, uint256 _amount) override external {
        require(msg.sender == address(templeStaking), "only staking contract");
        {
            _exiter;
        }     
        SafeERC20.safeTransferFrom(temple, msg.sender, address(this), _amount);
    }

    function getFaithMultiplier(uint256 _amountFaith, uint256 _amountTemple) view public returns (uint256) {
        // Tl = Ta * min(1.3, (1+faith/2.5*Ta))
        bytes16 amountFaith = ABDKMathQuad.fromUInt(_amountFaith);
        bytes16 amountTemple = ABDKMathQuad.fromUInt(_amountTemple);
        bytes16 t = ABDKMathQuad.fromUInt(1).add(amountFaith.div(TA_MULT.mul(amountTemple)));
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
        SafeERC20.safeTransferFrom(temple, msg.sender, address(this), _amountTemple);
        SafeERC20.safeIncreaseAllowance(temple, address(vault), amount);
        vault.depositFor(msg.sender, amount, amount, deadline, v, r, s);
    }
    
    function unstakeAndDepositIntoVault(uint256 _amount, Vault vault, uint256 deadline,uint8 v, bytes32 r, bytes32 s) public {
        SafeERC20.safeIncreaseAllowance(ogTemple, address(templeStaking), _amount);
        SafeERC20.safeTransferFrom(ogTemple, msg.sender, address(this), _amount);
        uint256 expectedTemple = templeStaking.balance(_amount);
        
        templeStaking.unstake(_amount);
        SafeERC20.safeIncreaseAllowance(temple, address(vault), expectedTemple);
        vault.depositFor(msg.sender, expectedTemple, expectedTemple, deadline, v, r, s);
    }

    function depositTempleFor(uint256 _amount, Vault vault, uint256 deadline,uint8 v, bytes32 r, bytes32 s) public {
        SafeERC20.safeIncreaseAllowance(temple, address(vault), _amount);
        SafeERC20.safeTransferFrom(temple, msg.sender, address(this), _amount);
        vault.depositFor(msg.sender, _amount, _amount, deadline, v,r,s);
    }

    //todo add escape hatch for ERC20 in this contract
}