// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { TempleTest } from "../../TempleTest.sol";

import { TempleLineOfCredit, ITempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { LinearInterestRateModel} from "contracts/v2/interestRate/LinearInterestRateModel.sol";
import { TreasuryReservesVault } from "contracts/v2/TreasuryReservesVault.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";

import { UD60x18, ud } from "@prb/math/src/UD60x18.sol";

contract TempleLineOfCreditTestBase is TempleTest {
    TempleLineOfCredit public tlc;
    FakeERC20 templeToken;
    // ITempleLineOfCredit.TokenPriceType templePrice;

    FakeERC20 daiToken;
    LinearInterestRateModel daiInterestRateModel;
    uint256 daiMaxLtvRatio = 8500; // 85%

    uint256 templePrice = 9700;

    FakeERC20 oudToken;
    LinearInterestRateModel oudInterestRateModel;
    uint256 oudMaxLtvRatio = 9000; // 90%

    TreasuryReservesVault public trv;
    TempleDebtToken public dUSD;
    uint256 public constant defaultBaseInterest = 0.01e18;

    // @todo move to sub tests.
    uint256 public constant trvStartingBalance = 1_000_000e18;
    uint256 public constant borrowCeiling = 100_000e18; //1_000_000e18;

    uint256 public constant PRICE_PRECISION = 10_000;

    event InterestRateUpdate(address indexed token, uint256 newInterestRate);

    function setUp() public {
        // Default starts at 0 which can hide some issues
        vm.warp(1_000_000);

        daiToken = new FakeERC20("DAI Token", "DAI", executor, 500_000e18);
        vm.label(address(daiToken), "DAI");
        templeToken = new FakeERC20("TempleToken", "Temple", executor, 500_000e18);
        vm.label(address(templeToken), "TEMPLE");
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, defaultBaseInterest);
        vm.label(address(dUSD), "dUSD");

        trv = new TreasuryReservesVault(rescuer, executor, address(daiToken), address(dUSD), templePrice);
        
        // uint256 _baseInterestRate, uint256 _maxInterestRate, uint _kinkUtilization, uint _kinkInterestRateBps) {
        daiInterestRateModel = new LinearInterestRateModel(
            5e18 / 100,  // 5% interest rate (rate% at 0% UR)
            20e18 / 100, // 20% percent interest rate (rate% at 100% UR)
            90e18 / 100, // 90% utilization (UR for when the kink starts)
            10e18 / 100  // 10% percent interest rate (rate% at kink% UR)
        );

        oudToken = new FakeERC20("OUD Token", "OUD", executor, 500_000e18);
        vm.label(address(oudToken), "OUD");
        oudInterestRateModel = new LinearInterestRateModel(
            5e18 / 100,   // 5% interest rate (rate% at 0% UR)
            5e18 / 100,   // 5% percent interest rate (rate% at 100% UR)
            100e18 / 100, // 100% utilization (UR for when the kink starts)
            5e18 / 100    // 5% percent interest rate (rate% at kink% UR)
        ); // Set up a flat interest rate model for OUD

        tlc = new TempleLineOfCredit(
            rescuer, 
            executor, 
            address(templeToken),
            address(daiToken),
            defaultDaiConfig(),
            address(oudToken),
            defaultOudConfig(),
            address(trv)
        );

        vm.startPrank(executor);
        dUSD.addMinter(address(trv));
        trv.addNewStrategy(address(tlc), borrowCeiling, 0);
        vm.stopPrank();
        deal(address(daiToken), address(trv), trvStartingBalance, true);
    }

    function defaultDaiConfig() internal view returns (ITempleLineOfCredit.ReserveTokenConfig memory) {
        return ITlcDataTypes.ReserveTokenConfig({
            tokenPriceType: ITlcDataTypes.TokenPriceType.STABLE,  // 1 USD
            maxLtvRatio: daiMaxLtvRatio,
            interestRateModelType: ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE,
            interestRateModel: daiInterestRateModel
        });
    }

    function defaultOudConfig() internal view returns (ITempleLineOfCredit.ReserveTokenConfig memory) {
        return ITlcDataTypes.ReserveTokenConfig({
            tokenPriceType: ITlcDataTypes.TokenPriceType.TPI, // #OUD * TPI
            maxLtvRatio: oudMaxLtvRatio,
            interestRateModelType: ITlcDataTypes.InterestRateModelType.FLAT,
            interestRateModel: oudInterestRateModel
        });
    }

    function getDefaultConfig(IERC20 token) internal view returns (ITempleLineOfCredit.ReserveTokenConfig memory) {
        return (address(token) == address(daiToken)) ? defaultDaiConfig() : defaultOudConfig();
    }

    function checkReserveTokenConfig(
        ITempleLineOfCredit.ReserveTokenConfig memory actual,
        ITempleLineOfCredit.ReserveTokenConfig memory expected
    ) internal {
        assertEq(uint256(actual.tokenPriceType), uint256(expected.tokenPriceType));
        assertEq(actual.maxLtvRatio, expected.maxLtvRatio);
        assertEq(uint256(actual.interestRateModelType), uint256(expected.interestRateModelType));
        assertEq(address(actual.interestRateModel), address(expected.interestRateModel));
    }

    function checkDaiTotals(
        ITempleLineOfCredit.ReserveTokenTotals memory actual,
        ITempleLineOfCredit.ReserveTokenTotals memory expected
    ) internal {
        // assertEq(actual.collateral, expected.collateral);
        assertEq(actual.debt, expected.debt);
        assertEq(actual.shares, expected.shares);
        assertApproxEqAbs(actual.interestRate, expected.interestRate, 1);
        assertEq(actual.lastUpdatedAt, expected.lastUpdatedAt);
    }

    function checkAfterBorrow(
        address user,
        IERC20 token,
        uint256 borrowedAmount,
        uint256 expectedInterestRate
    ) internal {
        assertEq(token.balanceOf(user), borrowedAmount);
        assertEq(tlc.userDebtShares(user, token), borrowedAmount);

        ITempleLineOfCredit.ReserveToken memory rt = tlc.getReserveToken(address(token));
        checkReserveTokenConfig(rt.config, getDefaultConfig(token));

        uint256 expectedUpdateAt = expectedInterestRate == 0 ? 0 : block.timestamp;

        checkDaiTotals(rt.totals, ITlcDataTypes.ReserveTokenTotals({
            debt: borrowedAmount,
            shares: borrowedAmount,
            interestRate: expectedInterestRate,
            lastUpdatedAt: expectedUpdateAt
        }));
    }

    function postCollateral(address user, uint256 collateralAmount) internal {
        // _initDeposit(reserveAmount);
        deal(address(templeToken), user, collateralAmount);
        vm.startPrank(user);
        templeToken.approve(address(tlc), collateralAmount);
        tlc.postCollateral(collateralAmount);
        vm.stopPrank();
    }

    function borrow(
        address _account, 
        uint256 collateralAmount, 
        uint256 daiBorrowAmount, 
        uint256 oudBorrowAmount
    ) internal {
        if (collateralAmount != 0) {
            postCollateral(_account, collateralAmount);
        }
        vm.startPrank(_account);
        tlc.borrow(daiBorrowAmount, oudBorrowAmount);
        vm.stopPrank();
    }

    function approxInterest(uint256 principal, uint256 rate, uint256 age) internal pure returns (uint256) {
        // Approxmiate as P * (1 + r/365 days)^(age)
        return ud(principal).mul(
            ud(1e18 + (rate/365 days)).powu(age)
        ).unwrap();
    }
}

contract TempleLineOfCreditTestAdmin is TempleLineOfCreditTestBase {
    function testInitalization() public {
        assertEq(address(tlc.templeToken()), address(templeToken));
        // assertEq(uint256(tlc.templePriceType()), uint256(ITempleLineOfCredit.TokenPriceType.TPI));

        {
            ITempleLineOfCredit.ReserveToken memory daiRt = tlc.getReserveToken(address(daiToken));
            checkReserveTokenConfig(daiRt.config, defaultDaiConfig());
            checkDaiTotals(daiRt.totals, ITlcDataTypes.ReserveTokenTotals({
                debt: 0,
                shares: 0,
                interestRate: 0,
                lastUpdatedAt: 0
            }));
        }

        {
            ITempleLineOfCredit.ReserveToken memory oudRt = tlc.getReserveToken(address(oudToken));
            checkReserveTokenConfig(oudRt.config, defaultOudConfig());
            checkDaiTotals(oudRt.totals, ITlcDataTypes.ReserveTokenTotals({
                debt: 0,
                shares: 0,
                interestRate: 0,
                lastUpdatedAt: 0
            }));
        }

        assertEq(address(tlc.treasuryReservesVault()), address(trv));
    }

    function testSetReserveTokenConfig() public {
        // By default, the interest rate is 0
        ITempleLineOfCredit.ReserveToken memory rt = tlc.getReserveToken(address(daiToken));
        assertEq(address(rt.config.interestRateModel), address(daiInterestRateModel));
        assertEq(rt.totals.interestRate, 0);
        assertEq(rt.totals.lastUpdatedAt, 0);

        tlc.refreshInterestRates(address(daiToken));
        rt = tlc.getReserveToken(address(daiToken));
        assertEq(address(rt.config.interestRateModel), address(daiInterestRateModel));
        assertEq(rt.totals.interestRate, 5e18 / 100);
        assertEq(rt.totals.lastUpdatedAt, block.timestamp);

        vm.warp(block.timestamp + 100);

        // 10% flat
        LinearInterestRateModel updatedInterestRateModel = new LinearInterestRateModel(
            10e18 / 100,
            10e18 / 100,
            100e18 / 100,
            10e18 / 100
        );

        vm.prank(executor);
        ITlcDataTypes.ReserveTokenConfig memory newConfig = ITlcDataTypes.ReserveTokenConfig({
            tokenPriceType: ITlcDataTypes.TokenPriceType.STABLE,
            maxLtvRatio: daiMaxLtvRatio,
            interestRateModelType: ITlcDataTypes.InterestRateModelType.TRV_UTILIZATION_RATE,
            interestRateModel: updatedInterestRateModel
        });
        tlc.setReserveTokenConfig(address(daiToken), newConfig);

        rt = tlc.getReserveToken(address(daiToken));
        assertEq(address(rt.config.interestRateModel), address(updatedInterestRateModel));
        assertEq(rt.totals.interestRate, 10e18 / 100);
        assertEq(rt.totals.lastUpdatedAt, block.timestamp);
    }

    function test_setMaxLtvRatio() internal {
        // @todo
    }

}

contract TempleLineOfCreditTestAccess is TempleLineOfCreditTestBase {

    function testSetInterestRateFailsNotOperator() public {
        expectElevatedAccess();
        tlc.setReserveTokenConfig(address(daiToken), defaultDaiConfig());
    }

    function testSetInterestRateFailsUnsupported() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidToken.selector, alice));

        vm.prank(executor);
        tlc.setReserveTokenConfig(alice, defaultDaiConfig());
    }
}

// function testDepositDaiReserveFailNotOperator() public {
//     expectElevatedAccess();
//     tlc.depositDaiReserve(alice, 0);
// }

// function testDepositDaiReserveFailInvalidAmount() public {
//     vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
//     vm.prank(executor);
//     tlc.depositDaiReserve(alice, 0);
// }

// function testDepositDaiReserveSuccess() public {
//     // tlc.addOperator(admin);
//     vm.startPrank(executor);
//     uint256 depositAmount = 10000;
//     deal(address(daiToken), executor, depositAmount);
//     daiToken.approve(address(tlc), depositAmount);


//     vm.expectEmit(true, true, true, true, address(tlc));
//     emit DepositReserve(address(daiToken), depositAmount);

//     tlc.depositDaiReserve(executor, depositAmount);
//     vm.stopPrank();


//     (uint256 totalReserve,,,) = tlc.daiTokenData();
//     assertEq(totalReserve, depositAmount);
//     assertEq(daiToken.balanceOf(executor), 0);
// }

contract TempleLineOfCreditTestCollateral is TempleLineOfCreditTestBase {
    event PostCollateral(address indexed account, uint256 collateralAmount);

    function testPostCollateralZeroBalanceRevert() external {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAmount.selector, address(templeToken), 0));
        vm.prank(alice);
        uint256 collateralAmount = 0;
        tlc.postCollateral(collateralAmount);
    }

    function testPostCollateralPasses() external {
        uint256 collateralAmount = 200_000e18;
        deal(address(templeToken), alice, collateralAmount);
        vm.startPrank(alice);
        templeToken.approve(address(tlc), collateralAmount);

        // assert emit 
        vm.expectEmit(true, true, true, true, address(tlc));
        emit PostCollateral(alice, collateralAmount);

        tlc.postCollateral(collateralAmount);
        assertEq(templeToken.balanceOf(address(tlc)), collateralAmount);
        assertEq(tlc.userCollateralPosted(alice), collateralAmount);


        // Post collateral again
        uint256 newCollateralAmount = 100_000e18;
        deal(address(templeToken), alice, newCollateralAmount);
        templeToken.approve(address(tlc), newCollateralAmount);

        // assert emit 
        vm.expectEmit(true, true, true, true, address(tlc));
        emit PostCollateral(alice, newCollateralAmount);

        tlc.postCollateral(newCollateralAmount);
        assertEq(templeToken.balanceOf(address(tlc)), collateralAmount + newCollateralAmount);
        assertEq(tlc.userCollateralPosted(alice), collateralAmount + newCollateralAmount);

        vm.stopPrank();
    }

    function testBorrowCapacityCorrect() external {
        uint256 collateralAmount = 100_000e18;
        postCollateral(alice, collateralAmount);
        uint256 expectedMaxBorrowCapacity = collateralAmount * 9_700/10_000 * 85/100;
        assertEq(tlc.maxBorrowCapacity(address(daiToken), alice), expectedMaxBorrowCapacity);

        expectedMaxBorrowCapacity = collateralAmount * 90/100;
        assertEq(tlc.maxBorrowCapacity(address(oudToken), alice), expectedMaxBorrowCapacity);
    }
}

contract TempleLineOfCreditTestBorrow is TempleLineOfCreditTestBase {
    event Borrow(address indexed account, address indexed token, uint256 amount);

    function testBorrowInsufficientCollateral() external {
        uint256 collateralAmount = 100_000e18;
        postCollateral(alice, collateralAmount);
        uint256 maxBorrowCapacity = tlc.maxBorrowCapacity(address(daiToken), alice);
        uint256 borrowAmount = maxBorrowCapacity + 1;
        vm.expectRevert(abi.encodeWithSelector(ITempleLineOfCredit.InsufficentCollateral.selector, maxBorrowCapacity, borrowAmount));

        vm.startPrank(alice);
        tlc.borrow(borrowAmount, 0);
        vm.stopPrank();
    }

    function testBorrowDaiOnlySuccess() external {
        // For DAI, borrowing 90k / 100k available, so it's right at the kink - 10% interest rate
        uint256 borrowAmount = 90_000e18;

        uint256 collateralAmount = 200_000e18;
        postCollateral(alice, collateralAmount);

        uint256 maxDaiBorrow = tlc.maxBorrowCapacity(address(daiToken), alice);
        assertEq(maxDaiBorrow, collateralAmount * templePrice/10_000 * daiMaxLtvRatio/10_000);

        vm.prank(alice);
        tlc.borrow(borrowAmount, 0);

        checkAfterBorrow(alice, daiToken, borrowAmount, 0.1e18);
        checkAfterBorrow(alice, oudToken, 0, 0);

        // Max borrow remains unchanged.
        assertEq(tlc.maxBorrowCapacity(address(daiToken), alice), maxDaiBorrow);

        (uint256 daiBorrowed, uint256 oudBorrowed) = tlc.userTotalDebt(alice);
        assertEq(daiBorrowed, borrowAmount);
        assertEq(oudBorrowed, 0);

        // vm.stopPrank();

        // _postCollateral(unauthorizedUser, collateralAmount);
        // vm.prank(unauthorizedUser);
        // tlc.borrow(1e18, 0);

        // uint256 maxBorrowCapacity = tlc.maxBorrowCapacity(address(daiToken), alice);
        // uint256 borrowAmount = maxBorrowCapacity + 1;
        // vm.expectRevert(abi.encodeWithSelector(ITempleLineOfCredit.InsufficentCollateral.selector, maxBorrowCapacity, borrowAmount));

        // vm.startPrank(alice);
        // tlc.borrow(borrowAmount, 0);
        // vm.stopPrank();
    }


    function testBorrowOudOnlySuccess() external {
        // For OUD, it's a flat rate of 5% interest rate
        uint256 borrowAmount = 10_000e18;

        uint256 collateralAmount = 100_000e18;
        postCollateral(alice, collateralAmount);
        uint256 maxOudBorrow = tlc.maxBorrowCapacity(address(oudToken), alice);
        assertEq(maxOudBorrow, collateralAmount * oudMaxLtvRatio/10_000);

        vm.prank(alice);
        tlc.borrow(0, borrowAmount);

        checkAfterBorrow(alice, daiToken, 0, 0);
        checkAfterBorrow(alice, oudToken, borrowAmount, 0.05e18);

        // Max borrow remains unchanged.
        assertEq(tlc.maxBorrowCapacity(address(oudToken), alice), maxOudBorrow);

        (uint256 daiBorrowed, uint256 oudBorrowed) = tlc.userTotalDebt(alice);
        assertEq(daiBorrowed, 0);
        assertEq(oudBorrowed, borrowAmount);
    }

    function testBorrowDaiAndOudSucess() external {
        postCollateral(alice, 100_000e18);

        uint256 borrowDaiAmount;
        uint256 borrowOudAmount;
        uint256 aliceDaiBalancePrior;
        uint256 aliceOudBalancePrior;

        borrowDaiAmount = tlc.maxBorrowCapacity(address(daiToken), alice);
        borrowOudAmount = tlc.maxBorrowCapacity(address(oudToken), alice); 

        aliceDaiBalancePrior = daiToken.balanceOf(alice);
        aliceOudBalancePrior = oudToken.balanceOf(alice);

        // uint256 totalDaiBorrowPrior;
        // uint256 totalDaiSharesPrior;
        uint256 userSharesDaiPrior;
        // uint256 totalOudBorrowPrior;
        // uint256 totalOudSharesPrior;
        uint256 userSharesOudPrior;

        ITempleLineOfCredit.ReserveToken memory daiRtBefore = tlc.getReserveToken(address(daiToken));

        // (,totalDaiBorrowPrior, totalDaiSharesPrior,) = tlc.daiTokenData();
        userSharesDaiPrior = tlc.userDebtShares(alice, daiToken);

        // (,totalOudBorrowPrior, totalOudSharesPrior, ) = tlc.oudTokenData();
        ITempleLineOfCredit.ReserveToken memory oudRtBefore = tlc.getReserveToken(address(oudToken));
        userSharesOudPrior = tlc.userDebtShares(alice, oudToken);

        vm.startPrank(alice);
        // assert emit 
        vm.expectEmit(address(tlc)); //true, true, true, true, address(tlc));
        emit Borrow(alice, address(daiToken), borrowDaiAmount / 2);

        vm.expectEmit(address(tlc)); //true, true, true, true, address(tlc));
        emit Borrow(alice, address(oudToken), borrowOudAmount / 2);
        
        tlc.borrow(borrowDaiAmount/2 , borrowOudAmount/2);

        assertEq(daiToken.balanceOf(alice), aliceDaiBalancePrior + (borrowDaiAmount / 2));
        assertEq(oudToken.balanceOf(alice), aliceOudBalancePrior + (borrowOudAmount / 2));

        // Assert DAI variables
        {
            ITempleLineOfCredit.ReserveToken memory daiRtAfter = tlc.getReserveToken(address(daiToken));

            // (,totalBorrowExpected, totalSharesExpected,) = tlc.daiTokenData();
            uint256 newSharesExpected = borrowDaiAmount / 2; // First time borrowing
            assertEq(daiRtBefore.totals.debt + borrowDaiAmount / 2, daiRtAfter.totals.debt);
            assertEq(daiRtBefore.totals.shares + newSharesExpected, daiRtAfter.totals.shares);
            assertEq(userSharesDaiPrior + newSharesExpected, newSharesExpected);
        }
        
        // Assert OUD variables
        {
            ITempleLineOfCredit.ReserveToken memory oudRtAfter = tlc.getReserveToken(address(oudToken));

            // (,totalBorrowExpected, totalSharesExpected, ) = tlc.oudTokenData();
            uint256 newSharesExpected = borrowOudAmount / 2; // First time borrowing
            assertEq(oudRtAfter.totals.debt, oudRtBefore.totals.debt + borrowOudAmount / 2);
            assertEq(oudRtAfter.totals.shares, oudRtBefore.totals.shares + newSharesExpected);
            assertEq(newSharesExpected, userSharesOudPrior + newSharesExpected);
        }

        // (,totalDaiBorrowPrior, totalDaiSharesPrior,) = tlc.daiTokenData();
        daiRtBefore = tlc.getReserveToken(address(daiToken));
        userSharesDaiPrior = tlc.userDebtShares(alice, daiToken);
            
        oudRtBefore = tlc.getReserveToken(address(oudToken));
        // (,totalOudBorrowPrior, totalOudSharesPrior,) = tlc.oudTokenData();
        userSharesOudPrior = tlc.userDebtShares(alice, oudToken);

        (uint256 debt, uint256 available, uint256 ceiling) = tlc.trvBorrowPosition();
        assertEq(debt, borrowDaiAmount/2);
        assertEq(available, borrowCeiling-borrowDaiAmount/2);  
        assertEq(ceiling, borrowCeiling);

        console.log("!!!!!!!!!!!!!!!!!!!!!");

        // @todo add these asserts in the first borrow too.

        // Assert emits
        vm.expectEmit(address(tlc));
        emit InterestRateUpdate(address(daiToken), daiInterestRateModel.getBorrowRate(borrowDaiAmount, borrowCeiling));

        // doesn't get emitted as the rate doesn't change
        // vm.expectEmit(address(tlc));
        // emit InterestRateUpdate(address(oudToken), oudInterestRateModel.getBorrowRate(0, 0));

        tlc.borrow(borrowDaiAmount / 2, borrowOudAmount / 2);
        vm.stopPrank();

        assertEq(daiToken.balanceOf(alice), aliceDaiBalancePrior + 2 * (borrowDaiAmount / 2));
        assertEq(oudToken.balanceOf(alice), aliceOudBalancePrior + 2 * (borrowOudAmount / 2));

        // Assert DAI variables
        {
            ITempleLineOfCredit.ReserveToken memory daiRtAfter2 = tlc.getReserveToken(address(daiToken));

            // (,totalBorrowExpected, totalSharesExpected,) = tlc.daiTokenData();
        
            uint256 newSharesExpected = (borrowDaiAmount / 2) * daiRtBefore.totals.shares / daiRtBefore.totals.debt; 
            assertEq(daiRtAfter2.totals.debt, daiRtBefore.totals.debt + (borrowDaiAmount / 2));
            assertEq(daiRtAfter2.totals.shares, daiRtBefore.totals.shares + newSharesExpected);
            assertEq(tlc.userDebtShares(alice, daiToken), userSharesDaiPrior + newSharesExpected);
        }

        // Assert OUD variables
        {
            ITempleLineOfCredit.ReserveToken memory oudRtAfter2 = tlc.getReserveToken(address(oudToken));

            // (,totalBorrowExpected, totalSharesExpected,) = tlc.oudTokenData();
            uint256 newSharesExpected = (borrowOudAmount / 2) * oudRtBefore.totals.shares / oudRtBefore.totals.debt; 
            assertEq(oudRtAfter2.totals.debt, oudRtBefore.totals.debt + (borrowOudAmount / 2));
            assertEq(oudRtAfter2.totals.shares, oudRtBefore.totals.shares + newSharesExpected);
            assertEq(tlc.userDebtShares(alice, oudToken), userSharesOudPrior + newSharesExpected);
        }
    }

    function testBorrowAlreadyBorrowedFailInsufficientCollateral() external {
        uint256 borrowDaiAmountFirst = 30_000e18;
        uint256 borrowOudAmountFirst = 20_000e18;
        
        console.log("Max Borrow Capacity 1:", tlc.maxBorrowCapacity(address(daiToken), alice));
        borrow(alice, 100_000e18, borrowDaiAmountFirst, borrowOudAmountFirst);

        uint256 borrowDaiAmountSecond = tlc.maxBorrowCapacity(address(daiToken), alice) - borrowDaiAmountFirst + 1;
        uint256 borrowOudAmountSecond = 10_000e18;

        console.log("Max Borrow Capacity 2:", tlc.maxBorrowCapacity(address(daiToken), alice));
        console.log("Borrowing:", borrowDaiAmountSecond, borrowOudAmountSecond);

        vm.expectRevert(abi.encodeWithSelector(ITempleLineOfCredit.InsufficentCollateral.selector, borrowDaiAmountSecond - 1,  borrowDaiAmountSecond)); 
        borrow(alice, 0, borrowDaiAmountSecond, borrowOudAmountSecond);
    }
}

contract TempleLineOfCreditTestInterestAccrual is TempleLineOfCreditTestBase {

    function testBorrowAccruesInterestRate() external {
        // For DAI, borrowing 90k / 100k available, so it's right at the kink - 10% interest rate
        uint256 borrowDaiAmount = 90_000e18;
        uint256 expectedDaiRate = 0.1e18;

        // Flat interest rate of 5%
        uint256 borrowOudAmount = 20_000e18;
        uint256 expectedOudRate = 0.05e18;
        
        borrow(alice, 200_000e18, borrowDaiAmount, borrowOudAmount);

        (uint256 totalDaiDebt, uint256 totalOudDebt) = tlc.userTotalDebt(alice);
        assertEq(totalDaiDebt, borrowDaiAmount);
        assertEq(totalOudDebt, borrowOudAmount);
        
        // console.log("ts:", block.timestamp);
        uint256 age = 365 days;
        vm.warp(block.timestamp + age); // 1 year continuously compunding
        (totalDaiDebt, totalOudDebt) = tlc.userTotalDebt(alice);
        // console.log("ts:", block.timestamp);

        // TLC from TRV:
        //   started with 100k limit
        //   borrowed 90k
        //   1% interest on 90k = 90,904.52
        //   remaining allowance to borrow = 100k - 90,094 = 9,096
        // denominator = 100k

        // (uint256 existingDebt, uint256 availableToBorrow) = trv.trvBorrowPosition(address(tlc));
        // console.log("TRV BALANCES:", existingDebt, availableToBorrow);
        // console.log("DAI BORROW RATE:", tlc.getBorrowRate(address(daiToken)));

        // 10% continuously compounding ~ 10.52 apr
        // uint256 precision = 1_000_000_000;
        // uint256 compoundedRate = 105_170_918; // ~10% continuously compounded for 1yr. `1 * e^(0.1)`
        // approxInterest(borrowDaiAmountFirst, 0.1e18, age);

        // UR = 0%, so 
        assertApproxEqRel(totalDaiDebt, approxInterest(borrowDaiAmount, expectedDaiRate, age), 1e9);

        // 5% continuously compounding ~ 5.13 apr
        assertApproxEqRel(totalOudDebt, approxInterest(borrowOudAmount, expectedOudRate, age), 1e9);
    }
}

// @todo The debt ceiling might be higher than the amount of $$ the TRV actually has on hand.
// add a test to ensure that the denominator on the UR is using the max available, not the ceiling.

contract TempleLineOfCreditTestRepay is TempleLineOfCreditTestBase {
    event Repay(address indexed account, address indexed token, uint256 repayAmount);

    function testRepayExceedBorrowedAmountFails() external {

        // uint256 reserveAmount = 100_000e18;
        uint256 borrowDaiAmountFirst = 50_000e18;
        uint256 borrowOudAmountFirst = 20_000e18;
        
        borrow(alice, 200_000e18, borrowDaiAmountFirst, borrowOudAmountFirst);

        vm.expectRevert(abi.encodeWithSelector(ITempleLineOfCredit.ExceededBorrowedAmount.selector, borrowDaiAmountFirst, borrowDaiAmountFirst + 1)); 
        vm.startPrank(alice);
        tlc.repay(borrowDaiAmountFirst + 1, 0);
        vm.stopPrank();
    }


    function testRepaySuccess() external {
        uint256 borrowDaiAmountFirst = 50_000e18; // 50% UR, ... // At kink approximately 10% interest rate
        uint256 borrowOudAmountFirst = 20_000e18; // Flat interest rate of 5%
        
        borrow(alice, 200_000e18, borrowDaiAmountFirst, borrowOudAmountFirst);

        uint256 age = 365 days;
        vm.warp(block.timestamp + age); // 1 year continuously compunding

        vm.startPrank(alice);
        // (uint256 totalDaiDebtPrior, uint256 totalOudDebtPrior) = tlc.userTotalDebt(alice);

        uint256 repayDaiAmount = borrowDaiAmountFirst; // pay of initial borrowed amount 
        uint256 repayOudAmount = borrowOudAmountFirst; // pay of initial borrowed amount 
        daiToken.approve(address(tlc), repayDaiAmount);

        // Double check TRV's debt as a strategy to TLC
        {
            (uint256 trvDebt, uint256 trvAvailable, uint256 ceiling) = tlc.trvBorrowPosition();
            assertApproxEqRel(trvDebt, approxInterest(borrowDaiAmountFirst, 0.01e18, age), 1e9);
            assertEq(trvAvailable, borrowCeiling-trvDebt);
            assertEq(ceiling, borrowCeiling);
        }

        (
            uint256 daiUtilizationRatio, 
            uint256 daiBorrowRate, 
            uint256 daiTotalDebt,
            uint256 oudBorrowRate,
            uint256 oudTotalDebt
        ) = tlc.totalDebtInfo();
        assertEq(daiUtilizationRatio, 0.5e18); // 50%
        assertEq(daiBorrowRate, 77777777777777777); // 7.77 %
        assertApproxEqRel(daiTotalDebt, approxInterest(borrowDaiAmountFirst, daiBorrowRate, age), 1e9);
        assertEq(oudBorrowRate, 0.05e18);  // 5 % flat
        assertApproxEqRel(oudTotalDebt, approxInterest(borrowOudAmountFirst, oudBorrowRate, age), 1e9);

        (uint256 userDaiDebt1, uint256 userOudDebt1) = tlc.userTotalDebt(alice);

        // assert emit    
        vm.expectEmit(address(tlc));
        emit Repay(alice, address(daiToken), repayDaiAmount);

        vm.expectEmit(address(tlc));
        // console.log("expected _updateRate:", daiTotalDebt, repayDaiAmount, borrowCeiling);
        emit InterestRateUpdate(address(daiToken), daiInterestRateModel.getBorrowRate(daiTotalDebt-repayDaiAmount, borrowCeiling));
        console.log("!!!!");

        // No InterestRateUpdate for OUD as the rate didn't change

        vm.expectEmit(address(tlc));
        emit Repay(alice, address(oudToken), repayOudAmount);

        tlc.repay(repayDaiAmount, repayOudAmount);

        (uint256 userDaiDebt2, uint256 userOudDebt2) = tlc.userTotalDebt(alice);

        assertEq(userDaiDebt2, userDaiDebt1 - borrowDaiAmountFirst); // Remaining amount is interest accumulated
        assertEq(userOudDebt2, userOudDebt1 - borrowOudAmountFirst);
        // vm.stopPrank();
    }

    function testRepayAllSuccess() external {

        // uint256 reserveAmount = 100_000e18;
        uint256 borrowDaiAmountFirst = 50_000e18; // At kink approximately 10% interest rate
        uint256 borrowOudAmountFirst = 20_000e18; // Flat interest rate of 5%
        
        borrow(alice, 200_000e18, borrowDaiAmountFirst, borrowOudAmountFirst);
        vm.warp(block.timestamp + 365 days); // 1 year continuously compunding

        vm.startPrank(alice);

        (uint256 repayDaiAmount, uint256 repayOudAmount) = tlc.userTotalDebt(alice); // Repay all debt

        deal(address(daiToken), alice, repayDaiAmount); // Give to pay of interest payment
        deal(address(oudToken), alice, repayOudAmount);
        daiToken.approve(address(tlc), repayDaiAmount);

        // assert emit 
        vm.expectEmit(true, true, true, true, address(tlc));
        emit Repay(alice, address(daiToken), repayDaiAmount);

        vm.expectEmit(true, true, true, true, address(tlc));
        emit Repay(alice, address(oudToken), repayOudAmount);

        tlc.repay(repayDaiAmount, repayOudAmount);

        (uint256 totalDaiDebt, uint256 totalOudDebt) = tlc.userTotalDebt(alice);

        assertEq(totalDaiDebt, 0);
        assertEq(totalOudDebt, 0);
        vm.stopPrank();
    }

}
