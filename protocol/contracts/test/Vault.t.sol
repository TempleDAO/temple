pragma solidity 0.8.10;

import {TempleTest} from "./utils/TempleTest.t.sol";
import {JoiningFee} from "../core/JoiningFee.sol";
import {Vault} from  "../core/Vault.sol";
import {Rational} from "../core/Rational.sol";
import {TempleERC20Token} from  "../TempleERC20Token.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract VaultTest is TempleTest {
    JoiningFee joiningFee;
    Rational rational;
    Vault vault;
    TempleERC20Token temple;

    address constant alice = address(0x1337);
    address constant bob = address(0xdeadbeef);
    address constant charlie = address(0xcafe);
    address constant debbie = address(0xc0ffee);

    uint256 constant ONE_HUNDRED_K = 100000000000000000000000;
    uint256 constant FIVE_MIN_DURATION = 60*5;

    bytes constant OUTSIDE_ENTER_WINDOW_ERR = bytes("Vault: Cannot join vault when outside of enter/exit window");
    bytes constant OUTSIDE_EXIT_WINDOW_ERR = bytes("Vault: Cannot exit vault when outside of enter/exit window");

    function setUp() public {
        // Set initial time of 100 to prevent any arithamtic over/underflows
        vm.warp(100);
        joiningFee = new JoiningFee(100000000000000000000000); // 1
        rational = Rational(1,1);
        temple = new TempleERC20Token();
        vault = new Vault(
            "Temple 5 Min Vault",
            "T5MV",
            temple,
            FIVE_MIN_DURATION,
            60,
            rational,
            joiningFee
        );

        temple.addMinter(address(this));
    }

    function testWithdrawWithMultipleUserDeposit() public {
        mintAndDepositFor(alice, ONE_HUNDRED_K);
        mintAndDepositFor(bob, ONE_HUNDRED_K);

        vm.startPrank(alice);

        vault.withdraw(ONE_HUNDRED_K);
        assertEq(temple.balanceOf(alice), ONE_HUNDRED_K);

        vm.stopPrank();

        vm.startPrank(bob);
        emit log_named_uint("Bob shareBalanceOf", vault.shareBalanceOf(bob));
        emit log_named_uint("Temple Balance", temple.balanceOf(address(vault)));
        
        vault.withdraw(ONE_HUNDRED_K);
        
        assertEq(temple.balanceOf(bob), ONE_HUNDRED_K);

        vm.stopPrank();

    }

    // Used to see amounts when multiple people depositing
    /*
    function testAmountPerShare() public {
        mintAndDepositFor(alice, ONE_HUNDRED_K);
        printStats("Alice", alice);

        mintAndDepositFor(bob, ONE_HUNDRED_K*2);
        printStats("Alice", alice);
        printStats("Bob", bob);

        mintAndDepositFor(charlie, ONE_HUNDRED_K*4);
        printStats("Alice", alice);
        printStats("Bob", bob);
        printStats("Charlie", charlie);

        mintAndDepositFor(debbie, ONE_HUNDRED_K*8);
        printStats("Alice", alice);
        printStats("Bob", bob);
        printStats("Charlie", charlie);
        printStats("Debbie", debbie);
    }*/

    function testStakingOnlyInEntryExitWindow() public {
        // mint
        temple.mint(alice, ONE_HUNDRED_K);
        
        // deposit
        vm.startPrank(alice);
        temple.increaseAllowance(address(vault), ONE_HUNDRED_K/2);
        vault.deposit(ONE_HUNDRED_K/2);
        
        assertEq(ONE_HUNDRED_K/2, vault.balanceOf(alice));
        
        // fast forward seconds
        vm.warp(160);
    
        vm.expectRevert(OUTSIDE_ENTER_WINDOW_ERR);
        vault.deposit(ONE_HUNDRED_K/2);
        vm.stopPrank();
    }

    // This shouldn't fail? 
    function testFuzzWithdrawFor(uint256 amount) public {
        // bound the fuzzing input - I doubt we'll ever hit someone depositing 366 trillion temple
        vm.assume(amount < 340282366920938463463374607431768211455);
        
        // build user
        uint256 priv = 0xBEEF;
        address sally = vm.addr(priv);

        uint256 deadline = 250;

        // mint and deposit
        temple.mint(sally, amount);
        vm.startPrank(sally);
        temple.increaseAllowance(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();

        uint256 nonce = vault.nonces(sally);
        bytes32 data = keccak256(
            abi.encodePacked(
                "\x19\x01",
                vault.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(vault.WITHDRAW_FOR_TYPEHASH(), sally, amount, deadline, nonce))
            )
        ); 

        // create signature 
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            priv,
            data
        );

        // try to withdraw for
        vault.withdrawFor(sally, amount, deadline, v, r, s);
        assertEq(temple.balanceOf(address(this)), amount);
    }

    function testFuzzDepositFor(uint256 amount) public {
        // bound the fuzzing input - I doubt we'll ever hit someone depositing 366 trillion temple
        vm.assume(amount < 340282366920938463463374607431768211455);

        // build user
        uint256 priv = 0xBEEF;
        address sally = vm.addr(priv);

        uint256 deadline = 250;

        uint256 nonce = vault.nonces(sally);
        bytes32 data = keccak256(
            abi.encodePacked(
                "\x19\x01",
                vault.DOMAIN_SEPARATOR(),
                keccak256(abi.encode(vault.DEPOSIT_FOR_TYPEHASH(), sally, amount, deadline, nonce))
            )
        ); 

         // create signature 
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            priv,
            data
        );

        temple.mint(sally, amount);
        vm.prank(sally);
        temple.increaseAllowance(address(vault), amount);
        vault.depositFor(sally, amount, amount, deadline, v, r, s);

        uint256 tokenBalance = vault.toTokenAmount(vault.shareBalanceOf(sally));
        assertEq(tokenBalance, amount);
    }

    function testFuzzDepositWithdraw(uint256 amount) public {
        // bound the fuzzing input - I doubt we'll ever hit someone depositing 366 trillion temple
        vm.assume(amount < 340282366920938463463374607431768211455);
        
        // mint
        temple.mint(alice, amount);

        // deposit
        vm.startPrank(alice);
        temple.increaseAllowance(address(vault), amount);
        vault.deposit(amount);

        vm.warp(160 + (60*4));
        vault.withdraw(amount);
        vm.stopPrank();

        assertEq(temple.balanceOf(alice), amount);
    }

    function testWithdrawOnlyInEntryExitWindow() public {
        temple.mint(alice, ONE_HUNDRED_K);

        vm.startPrank(alice);
        temple.increaseAllowance(address(vault), ONE_HUNDRED_K);
        vault.deposit(ONE_HUNDRED_K);
    
        vm.warp(160);
        
        vm.expectRevert(OUTSIDE_EXIT_WINDOW_ERR);
        vault.withdraw(ONE_HUNDRED_K);
        

        vm.warp(160 + (60*4));
        vault.withdraw(ONE_HUNDRED_K);
        vm.stopPrank();

        assertEq(temple.balanceOf(alice), ONE_HUNDRED_K);
    }

    function testInEnterExitWindow() public {
        bool inWindow = vault.inEnterExitWindow();
        assertTrue(inWindow);

        vm.warp(100+(60*3));
        inWindow = vault.inEnterExitWindow();
        assertFalse(inWindow);
    }

    function mintAndDepositFor(address addr, uint256 amount) private {
        temple.mint(addr, amount);
        vm.startPrank(addr);
        temple.increaseAllowance(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function withdrawFor(address addr, uint256 amount) private {
        vm.startPrank(addr);
        vault.withdraw(amount);
        vm.stopPrank();
    }

    function printStats(string memory name, address addr) private {
        uint256 t5mvBal = vault.balanceOf(addr);
        emit log_named_uint(string(abi.encodePacked(name, " T5MV Balance")), t5mvBal);

        (uint256 templeBal, uint256 totalShares) = vault.amountPerShare();
        emit log_named_uint("Temple Balance", templeBal);
        emit log_named_uint("Total shares", totalShares);

        uint256 sharesForAddr = vault.shareBalanceOf(addr);
        emit log_named_uint(string(abi.encodePacked(name, " Share Balance")), sharesForAddr);
        emit log_named_uint(string(abi.encodePacked(name, " Token Amount")), vault.toTokenAmount(sharesForAddr));
        emit log("******************************");
    }
}