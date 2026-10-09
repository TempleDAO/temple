pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/wishingwell/FixedPriceAuction.t.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IERC1271 } from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

import { TempleTest } from "test/forge/unit/TempleTest.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";

import { IFixedPriceAuction } from "contracts/interfaces/wishingwell/IFixedPriceAuction.sol";
import { FixedPriceAuction } from "contracts/wishingwell/FixedPriceAuction.sol";


contract FixedPriceAuctionToken is FakeERC20, ERC20Permit {
    constructor(string memory name_, string memory symbol_)
        FakeERC20(name_, symbol_, address(0), 0)
        ERC20Permit(name_)
    { }
}

contract FixedPriceAuctionRegistry {
    mapping(address => bool) public supported;
    bool public fail;

    function setSupported(address token, bool value) external {
        supported[token] = value;
    }

    function setFail(bool value) external {
        fail = value;
    }

    function isSupported(address token) external view returns (bool) {
        if (fail) { revert("Registry unavailable"); }
        return supported[token];
    }
}

contract FixedPriceAuctionCompliance {
    mapping(address => bool) public blocked;
    bool public fail;

    function setBlocked(address account, bool value) external {
        blocked[account] = value;
    }

    function setFail(bool value) external {
        fail = value;
    }

    function isBlocked(address account) external view returns (bool) {
        if (fail) { revert("Compliance unavailable"); }
        return blocked[account];
    }
}

contract FixedPriceAuctionTestBase is TempleTest {
    event AuctionSettled(
        address indexed caller,
        bool early,
        uint256 totalDeposits,
        uint256 filledDeposits,
        uint256 userFunding,
        uint256 userRefund,
        uint256 funderRefund
    );
    event ClaimFrozen(address indexed account, uint256 payout, uint256 refund);
    event ComplianceCheckDisabled();
    event DepositEndScheduled(address indexed caller, uint64 newDepositEnd, uint64 newFulfillmentEnd);
    event DepositWithdrawn(address indexed account, uint256 amount, uint256 accountDeposit, uint256 totalDeposits);
    event Deposited(address indexed account, uint256 amount, uint256 accountDeposit, uint256 totalDeposits);
    event EmergencyPaused(uint64 until);
    event EmergencyUnpaused();
    event ExcessWithdrawn(address indexed funder, uint256 amount, uint256 remainingFunding);
    event FrozenReleased(address indexed account, address indexed to, uint256 bidAmount, uint256 fillAmount);
    event ReleaseProposed(address indexed account, address indexed to, uint64 executableAt);
    event ReleaseVetoed(address indexed account);
    event UserClaimed(address indexed account, uint256 fillTokenAmount, uint256 bidTokenRefund);

    FixedPriceAuction internal auction;
    FixedPriceAuctionToken internal TEMPLE_TOKEN;
    FixedPriceAuctionToken internal USDS;
    FixedPriceAuctionToken internal TGLD;
    FixedPriceAuctionRegistry internal tokenRegistry;
    FixedPriceAuctionCompliance internal complianceCheck;
    IFixedPriceAuction.AuctionConfig internal config;

    address internal funder = makeAddr("funder");
    address internal proceedsRecipient = makeAddr("proceedsRecipient");
    address internal escrow = makeAddr("escrow");
    
    uint256 internal key = 12345;

    function setUp() public virtual {
        vm.warp(1000);
        TEMPLE_TOKEN = new FixedPriceAuctionToken("Temple Token", "TEMPLE");
        USDS = new FixedPriceAuctionToken("USDS", "USDS");
        tokenRegistry = new FixedPriceAuctionRegistry();
        complianceCheck = new FixedPriceAuctionCompliance();
        tokenRegistry.setSupported(address(TEMPLE_TOKEN), true);
        tokenRegistry.setSupported(address(USDS), true);
        config = IFixedPriceAuction.AuctionConfig({
            bidToken: address(TEMPLE_TOKEN),
            fillToken: address(USDS),
            funder: funder,
            proceedsRecipient: proceedsRecipient,
            price: 4e18,
            depositStart: uint64(block.timestamp + 1 days),
            depositDuration: 5 days,
            fulfillmentDuration: 3 days,
            noticePeriod: 1 hours,
            minDeposit: 10e18,
            maxTotalDeposits: 1000e18,
            complianceCheck: address(complianceCheck),
            frozenFundsReceiver: escrow,
            tokenRegistry: address(tokenRegistry)
        });
        auction = new FixedPriceAuction(config, executor, rescuer);
    }

    function deployAuction() internal {
        auction = new FixedPriceAuction(config, executor, rescuer);
    }

    function openDeposit() internal {
        vm.warp(auction.getTiming().depositStart);
    }

    function openFulfillment() internal {
        vm.warp(auction.getTiming().fulfillmentStart);
    }

    function finishAuction() internal {
        vm.warp(auction.getTiming().fulfillmentEnd);
    }

    function depositAs(address account, uint256 amount) internal {
        TEMPLE_TOKEN.mint(account, amount);
        vm.startPrank(account);
        TEMPLE_TOKEN.approve(address(auction), amount);
        auction.deposit(amount);
        vm.stopPrank();
    }

    function fundAuction(uint256 amount) internal {
        USDS.mint(funder, amount);
        vm.startPrank(funder);
        USDS.approve(address(auction), amount);
        auction.fund(amount);
        vm.stopPrank();
    }

    function claimAs(address account) internal {
        vm.startPrank(account);
        auction.claim();
        vm.stopPrank();
    }

    function signPermit(address owner, uint256 amount, uint256 deadline)
        internal
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 content = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                address(auction),
                amount,
                TEMPLE_TOKEN.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", TEMPLE_TOKEN.DOMAIN_SEPARATOR(), content));
        return vm.sign(key, digest);
    }

    function assertLiabilities(uint256 bid, uint256 fill) internal {
        (uint256 actualBid, uint256 actualFill) = auction.liabilities();
        assertEq(actualBid, bid);
        assertEq(actualFill, fill);
        assertGe(TEMPLE_TOKEN.balanceOf(address(auction)), actualBid);
        assertGe(USDS.balanceOf(address(auction)), actualFill);
    }
}

contract FixedPriceAuctionTestInitialization is FixedPriceAuctionTestBase {

    function test_initialization_fpa() public {
        assertEq(auction.executor(), executor);
        assertEq(auction.rescuer(), rescuer);
        assertEq(auction.bidDecimals(), 18);
        assertEq(auction.fillDecimals(), 18);
        assertEq(abi.encode(auction.getConfig()), abi.encode(config));
        assertEq(auction.complianceCheck(), address(complianceCheck));
        assertEq(auction.maxTotalDeposits(), 1000e18);
        assertEq(auction.EMERGENCY_PAUSE_DURATION(), 14 days);
        assertEq(auction.FROZEN_ACTION_DELAY(), 7 days);
        assertEq(auction.MIN_NOTICE(), 1 hours);
        assertEq(auction.MAX_DURATION(), 30 days);
        assertFalse(auction.depositsPaused());
        assertFalse(auction.emergencyPaused());
        assertFalse(auction.emergencyPauseUsed());
        assertEq(auction.emergencyPausedUntil(), 0);
        assertEq(auction.unclaimedBidders(), 0);
        assertLiabilities(0, 0);
    }
}