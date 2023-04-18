pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/DSRStrategy.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IMakerDaoDaiJoinLike } from "contracts/interfaces/external/makerDao/IMakerDaoDaiJoinLike.sol";
import { IMakerDaoPotLike } from "contracts/interfaces/external/makerDao/IMakerDaoPotLike.sol";
import { IMakerDaoVatLike } from "contracts/interfaces/external/makerDao/IMakerDaoVatLike.sol";
import { ITempleBaseStrategy } from "contracts/interfaces/v2/strategies/ITempleBaseStrategy.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/**
 * @title Dai Savings Rate (DSR) - Base Strategy
 * @notice Deposit idle DAI from the Treasury Reserve Vaults into the Maker DSR (DAI Savings Rate module)
 */
contract DsrBaseStrategy is AbstractStrategy, ITempleBaseStrategy {
    using SafeERC20 for IERC20;

    string public constant VERSION = "1.0.0";

    /**
     * @notice The MakerDAO contract used to enter/exit DSR
     */
    IMakerDaoDaiJoinLike public immutable daiJoin;

    /**
     * @notice The MakerDAO contract to query balances/rates of within DSR
     */
    IMakerDaoPotLike public immutable pot;

    /**
     * @notice MakerDAO const used in DSR share->DAI conversions
     */
    uint256 public constant RAY = 10 ** 27;

    event DaiDeposited(uint256 amount);
    event DaiWithdrawn(uint256 amount);
    error NotEnoughShares(uint256 daiAmountRequested, uint256 sharesRequested, uint256 sharesAvailable);

    constructor(
        address _initialGov,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _stableToken,
        address _internalDebtToken,
        address _daiJoin, 
        address _pot
    ) AbstractStrategy(_initialGov, _strategyName, _treasuryReservesVault, _stableToken, _internalDebtToken) {
        daiJoin = IMakerDaoDaiJoinLike(_daiJoin);
        IMakerDaoVatLike vat = IMakerDaoVatLike(daiJoin.vat());
        pot = IMakerDaoPotLike(_pot);
        vat.hope(address(daiJoin));
        vat.hope(address(pot));
        stableToken.safeApprove(address(daiJoin), type(uint256).max);
    }

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external pure returns (string memory) {
        return VERSION;
    }

    /**
     * @notice Match DAI DSR's maths.
     * @dev See DsrManager: 0x373238337Bfe1146fb49989fc222523f83081dDb
     */
    function _rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        // always rounds down
        z = x * y / RAY;
    }

    function _rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        // always rounds down
        z = x * RAY / y;
    }

    function _rdivup(uint256 x, uint256 y) internal pure returns (uint256 z) {
        // always rounds up
        z = ((x * RAY) + (y - 1)) / y;
    }
    
    function _latestDaiBalance() internal view returns (uint256) {
        // pot.chi() == DAI/share (accurate to the last checkpoint)
        // pot.pie() == number of shares this contract holds.
        return _rmul(pot.chi(), pot.pie(address(this)));
    }

    function _checkpointChi() internal returns (uint256 chi) {
        chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
    }

    function _checkpointDaiBalance() internal returns (uint256 dai, uint256 chi, uint256 shares) {
        chi = _checkpointChi();
        shares = pot.pie(address(this));
        dai = _rmul(chi, shares);
    }

    /**
     * @notice The latest checkpoint of total equity (latestAssetsValue - latestInternalDebt)
     *  Where:
     *     assets = Latest checkpoint of value of assets in this strategy
     *     debt   = The latest checkpoint of the internal Temple debt this strategy has accrued
     *              The same as `dUSD.balanceOf(strategy)`
     *     equity = assets - debt. This could be negative.
     */
    function latestEquityCheckpoint() external override view returns (int256 equity, uint256 assets, uint256 debt) {
        assets = stableToken.balanceOf(address(this)) + _latestDaiBalance();
        debt = currentDebt();
        equity = int256(assets) - int256(debt);
    }

    /**
     * @notice Calculate the latest assets and liabilities and checkpoint
     * For DAI's Savings Rate contract, we need to call a writable function to get the latest total.
     */
    function checkpointEquity() external override returns (int256 equity, uint256 assets, uint256 debt) {
        (assets,,) = _checkpointDaiBalance();
        assets += stableToken.balanceOf(address(this)); 
        debt = currentDebt();
        equity = int256(assets) - int256(debt);
        emit EquityCheckpoint(equity, assets, debt);
    }

    /**
     * @notice Periodically, the Base Strategy will pull all DAI reserves
     * from the TRV contract and apply into DSR in order to generate base yield 
     * (the basis of the dUSD base in interest rate.)
     *
     * These idle DAI will only be drawn from a balance of tokens in the TRV itself.
     * 
     * This will be likely be called from a bot. It should only do this if there's a 
     * minimum threshold to pull and deposit given gas costs to deposit into DSR.
     */
    function borrowAndDepositMax() external onlyStrategyExecutors returns (uint256 borrowedAmount) {
        // Borrow the DAI. This will also mint `dUSD` debt.
        borrowedAmount = treasuryReservesVault.borrowMax();
        _dsrDeposit(borrowedAmount);
    }

    /**
     * @notice Periodically, the Base Strategy will pull a fixed amount of idle DAI reserves
     * from the TRV contract and apply into DSR in order to generate base yield 
     * (the basis of the dUSD base in interest rate.)
     *
     * These idle DAI will only be drawn from a balance of tokens in the TRV itself.
     * 
     * This will be likely be called from a bot. It should only do this if there's a 
     * minimum threshold to pull and deposit given gas costs to deposit into DSR.
     */
    function borrowAndDeposit(uint256 amount) external onlyStrategyExecutors {
        // Borrow the DAI. This will also mint `dUSD` debt.
        treasuryReservesVault.borrow(amount);
        _dsrDeposit(amount);
    }

    function _dsrDeposit(uint256 amount) internal {
        // Ensure the latest DSR checkpoint has occurred so we join with the
        // correct shares. Use `_rdiv()` on deposits.
        uint256 shares = _rdiv(amount, _checkpointChi());

        emit DaiDeposited(amount);
        daiJoin.join(address(this), amount);
        pot.join(shares);
    }

    /**
     * @notice The TRV is able to withdraw on demand in order to fund other strategies which 
     * wish to borrow from the TRV.
     * @dev It may withdraw less than requested if there isn't enough balance in the DSR.
     */
    function trvWithdraw(uint256 requestedAmount) external returns (uint256 amountWithdrawn) {
        if (msg.sender != address(treasuryReservesVault)) revert OnlyTreasuryReserveVault(msg.sender);
        if (requestedAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();       

        // Checkpoint DSR and calculate how many DSR shares the request equates to.
        //  Use `_rdivup()` on withdrawals.
        (uint256 daiAvailable, uint256 chi, uint256 sharesAvailable) = _checkpointDaiBalance();
        uint256 sharesAmount = _rdivup(requestedAmount, chi);

        // Cap at the max balance in DSR
        if (sharesAmount > sharesAvailable) {
            requestedAmount = daiAvailable;
            sharesAmount = sharesAvailable;
        }

        _dsrWithdrawal(sharesAmount, requestedAmount);
        stableToken.safeTransfer(address(treasuryReservesVault), requestedAmount);
        return amountWithdrawn;
    }

    function _dsrWithdrawal(uint256 sharesAmount, uint256 daiAmount) internal {
        pot.exit(sharesAmount);
        daiJoin.exit(address(this), daiAmount);
        emit DaiWithdrawn(daiAmount);
    }

    /**
     * @notice The strategy executor may withdraw DAI from DSR and pay back to Treasury Reserves Vault
     */
    function withdrawAndRepay(uint256 withdrawalAmount) external onlyStrategyExecutors {
        if (withdrawalAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();       

        (uint256 daiAvailable, uint256 chi, ) = _checkpointDaiBalance();
        if (withdrawalAmount > daiAvailable) revert CommonEventsAndErrors.InsufficientBalance(address(stableToken), withdrawalAmount, daiAvailable);
        
        //  Use `_rdivup()` on withdrawals.
        uint256 sharesAmount = _rdivup(withdrawalAmount, chi);
        _dsrWithdrawal(sharesAmount, withdrawalAmount);
        treasuryReservesVault.repay(withdrawalAmount);
    }

    /**
     * @notice Withdraw all possible DAI from the DSR, and send to the Treasury Reserves Vault
     */
    function withdrawAndRepayAll() external onlyStrategyExecutors returns (uint256) {
        (uint256 daiAvailable,, uint256 sharesAvailable) = _checkpointDaiBalance();
        _dsrWithdrawal(sharesAvailable, daiAvailable);

        treasuryReservesVault.repay(daiAvailable);
        return daiAvailable;
    }

    /**
     * @notice The strategy executor can shutdown this strategy, only after Governance has 
     * marked the strategy as `isShuttingDown` in the TRV.
     *
     * @dev This first withdraws all DAI from the DSR and sends all funds to the TRV, and then 
     * applies the shutdown in the TRV.
     */
    function automatedShutdown() external onlyStrategyExecutors override {
        // Withdraw all from DSR and send everything back to the Treasury Reserves Vault.
        (uint256 daiAvailable,, uint256 sharesAvailable) = _checkpointDaiBalance();
        _dsrWithdrawal(sharesAvailable, daiAvailable);

        emit Shutdown(daiAvailable);

        // Now mark as shutdown in the TRV.
        // This will only succeed if governance has first set the strategy to `isShuttingDown`
        treasuryReservesVault.shutdown(address(this), daiAvailable);
    }

}