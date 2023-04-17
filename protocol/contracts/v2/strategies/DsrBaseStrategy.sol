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

    /**
     * @notice Upon applying deposits, if the balance is less than
     * this threshold, then it won't push into DSR.
     * @dev This is because the DSR deposit is relatively expensive for gas.
     */
    uint256 public depositThreshold;

    /**
     * @notice Upon withdrawal, if a withdrawal from DSR is required,
     * it will attempt to withdraw at least this amount into the contract, to save from
     * withdrawing immediately again next time.
     * @dev This is because the DSR withdrawal is relatively expensive for gas.
     */
    uint256 public withdrawalThreshold;

    event DaiDeposited(address indexed token, uint256 amount);
    event DaiWithdrawn(address indexed token, uint256 amount);
    event ThresholdsSet(uint256 depositThreshold, uint256 withdrawalThreshold);
    error NotEnoughShares(uint256 daiAmountRequested, uint256 sharesRequested, uint256 sharesAvailable);

    constructor(
        address _initialGov,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _stableToken,
        address _internalDebtToken,
        address _daiJoin, 
        address _pot, 
        uint256 _depositThreshold, 
        uint256 _withdrawalThreshold
    ) AbstractStrategy(_initialGov, _strategyName, _treasuryReservesVault, _stableToken, _internalDebtToken) {
        daiJoin = IMakerDaoDaiJoinLike(_daiJoin);
        IMakerDaoVatLike vat = IMakerDaoVatLike(daiJoin.vat());
        pot = IMakerDaoPotLike(_pot);
        vat.hope(address(daiJoin));
        vat.hope(address(pot));
        stableToken.safeApprove(address(daiJoin), type(uint256).max);

        depositThreshold = _depositThreshold;
        withdrawalThreshold = _withdrawalThreshold;
    }

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external pure returns (string memory) {
        return VERSION;
    }

    /**
     * @notice Owner can set the threshold at which balances are actually added/removed into DSR.
     * eg If DAI balanceOf(this) is below the `_depositThreshold`, applyDeposits() will be a no-op
     */
    function setThresholds(uint256 _depositThreshold, uint256 _withdrawalThreshold) external onlyStrategyExecutors {
        depositThreshold = _depositThreshold;
        withdrawalThreshold = _withdrawalThreshold;
        emit ThresholdsSet(_depositThreshold, _withdrawalThreshold);
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
        uint256 dsrAmount = _rmul(pot.chi(), pot.pie(address(this)));
        return stableToken.balanceOf(address(this)) + dsrAmount;
    }

    function _checkpointDaiBalance() internal returns (uint256) {
        uint256 chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
        uint256 dsrAmount = _rmul(chi, pot.pie(address(this)));
        return stableToken.balanceOf(address(this)) + dsrAmount;
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
        assets = _latestDaiBalance();
        debt = internalDebtToken.balanceOf(address(this));
        equity = int256(assets) - int256(debt);
    }

    /**
     * @notice Calculate the latest assets and liabilities and checkpoint
     * For DAI's Savings Rate contract, we need to call a writable function to get the latest total.
     */
    function checkpointEquity() external override returns (int256 equity, uint256 assets, uint256 debt) {
        assets = _checkpointDaiBalance();
        debt = internalDebtToken.balanceOf(address(this));
        equity = int256(assets) - int256(debt);
        emit EquityCheckpoint(equity, assets, debt);
    }

    /**
     * @notice Periodically, the Base Strategy will pull as many idle DAI reserves
     * from the TRV contract and apply into DSR in order to generate base yield 
     * (the basis of the dUSD base in interest rate.)
     *
     * These idle DAI will only be drawn from a balance of tokens in the TRV itself.
     */
    function borrowAndDepositMax() external onlyStrategyExecutors returns (uint256) {
        uint256 amount = stableToken.balanceOf(address(treasuryReservesVault));
        return _borrowAndDeposit(amount);
    }

    /**
     * @notice The same as `borrowMax()` but for a pre-determined amount to borrow,
     * such that something upstream/off-chain can determine the amount.
     */
    function borrowAndDeposit(uint256 amount) external onlyStrategyExecutors returns (uint256) {
        return _borrowAndDeposit(amount);
    }

    function _borrowAndDeposit(uint256 amount) internal returns (uint256) {
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        // Borrow the DAI. This will also mint `dUSD` debt.
        treasuryReservesVault.borrow(amount);

        // Don't apply the deposit if there isn't enough balance yet in the account
        amount = stableToken.balanceOf(address(this));
        if (amount < depositThreshold) return amount;

        emit DaiDeposited(address(stableToken), amount);

        // Ensure the latest checkpoint has occurred
        uint256 chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
        uint256 shares = _rdiv(amount, chi);

        daiJoin.join(address(this), amount);
        pot.join(shares);

        return amount;
    }

    /**
     * @notice Withdraw an amount of DAI from the DSR, and send to the TRV
     */
    function withdraw(uint256 amount) external onlyStrategyExecutors returns (uint256) {
        // The TRV is also able to withdraw on demand in order to fund other strategies which wish to borrow from the TRV.
        if (!(msg.sender == address(treasuryReservesVault) || strategyExecutors[msg.sender])) {
            revert OnlyStrategyExecutorsOrTRV(msg.sender);
        }

        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        // First use any balance which is still sitting in this contract (not yet in the DSR)
        uint256 balance = stableToken.balanceOf(address(this));
        uint256 transferAmount = balance > amount ? amount : balance;
        uint256 withdrawAmount = amount - transferAmount;

        // Pull any remainder required from DSR
        if (withdrawAmount != 0) {
            // Ensure the latest checkpoint has occurred
            uint256 chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
            uint256 dsrSharesAvailable = pot.pie(address(this));

            // Attempt to withdraw at least the threshold.
            uint256 daiToExit = withdrawAmount < withdrawalThreshold ? withdrawalThreshold : withdrawAmount;
            uint256 sharesToExit = _rdivup(daiToExit, chi);
            
            // If not enough shares based on the threshold, then fallback to the requested amount only
            if (sharesToExit > dsrSharesAvailable) {
                daiToExit = withdrawAmount;
                sharesToExit = _rdivup(daiToExit, chi);
            }

            // If still not enough shares, then error.
            if (sharesToExit > dsrSharesAvailable) revert NotEnoughShares(withdrawAmount, sharesToExit, dsrSharesAvailable);

            pot.exit(sharesToExit);
            daiJoin.exit(address(this), daiToExit);
        }
        
        emit DaiWithdrawn(address(stableToken), amount);
        stableToken.safeTransfer(address(treasuryReservesVault), amount);
        return amount;
    }

    /**
     * @notice Withdraw all possible DAI from the DSR, and send to the Treasury Reserves Vault
     */
    function withdrawAll() external onlyStrategyExecutors returns (uint256) {
        return _withdrawAll();
    }

    function _withdrawAll() internal returns (uint256) {
        uint256 amount = stableToken.balanceOf(address(this));

        // Send any balance of DAI sitting in the contract
        if (amount != 0) {
            stableToken.safeTransfer(address(treasuryReservesVault), amount);
        }

        // And also withdraw all from the DSR
        uint256 dsrShares = pot.pie(address(this));
        if (dsrShares != 0) {
            uint256 chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
            uint256 daiToReceive = dsrShares * chi / RAY;

            pot.exit(dsrShares);
            daiJoin.exit(address(treasuryReservesVault), daiToReceive);

            amount += daiToReceive;
        }

        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        emit DaiWithdrawn(address(stableToken), amount);
        return amount;
    }

    /**
     * @notice The strategy executor can shutdown this strategy, only after Governance has 
     * marked the strategy as `isShuttingDown` in the TRV.
     *
     * @dev This first withdraws all DAI from the DSR and sends all funds to the TRV, and then 
     * applies the shutdown in the TRV.
     */
    function gracefulShutdown() external onlyStrategyExecutors override {
        // Withdraw all from DSR and send everything back to the Treasury Reserves Vault.
        uint256 stablesRecovered = _withdrawAll();
        emit Shutdown(false, stablesRecovered);

        // Now mark as shutdown in the TRV.
        // This will only succeed if governance has first set the strategy to `isShuttingDown`
        treasuryReservesVault.shutdown(address(this), stablesRecovered);
    }

}