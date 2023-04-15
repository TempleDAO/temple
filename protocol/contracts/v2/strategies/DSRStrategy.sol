pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Origami (v2/DSRStrategy.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IMakerDaoDaiJoinLike } from "contracts/interfaces/external/makerDao/IMakerDaoDaiJoinLike.sol";
import { IMakerDaoPotLike } from "contracts/interfaces/external/makerDao/IMakerDaoPotLike.sol";
import { IMakerDaoVatLike } from "contracts/interfaces/external/makerDao/IMakerDaoVatLike.sol";
import { StrategyBase } from "contracts/v2/strategies/StrategyBase.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/// @title Deposit idle DAI into the Maker DSR (DAI Savings Rate module)
contract DSRStrategy is StrategyBase {
    using SafeERC20 for IERC20;

    string public constant VERSION = "1.0.0";

    /// @notice The MakerDAO contract used to enter/exit DSR
    IMakerDaoDaiJoinLike public immutable daiJoin;

    /// @notice The MakerDAO contract to query balances/rates of within DSR
    IMakerDaoPotLike public immutable pot;

    /// @notice MakerDAO const used in DSR share->DAI conversions
    uint256 public constant RAY = 10 ** 27;

    /// @notice Upon applying deposits, if the balance is less than
    /// this threshold, then it won't push into DSR.
    /// @dev This is because the DSR deposit is relatively expensive for gas.
    uint256 public depositThreshold;

    /// @notice Upon withdrawal, if a withdrawal from DSR is required,
    /// it will attempt to withdraw at least this amount into the contract, to save from
    /// withdrawing immediately again next time.
    /// @dev This is because the DSR withdrawal is relatively expensive for gas.
    uint256 public withdrawalThreshold;

    event DaiDeposited(address indexed token, uint256 amount);
    event DaiWithdrawn(address indexed token, uint256 amount, address indexed receiver);
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
    ) StrategyBase(_initialGov, _strategyName, _treasuryReservesVault, _stableToken, _internalDebtToken) {
        daiJoin = IMakerDaoDaiJoinLike(_daiJoin);
        IMakerDaoVatLike vat = IMakerDaoVatLike(daiJoin.vat());
        pot = IMakerDaoPotLike(_pot);
        vat.hope(address(daiJoin));
        vat.hope(address(pot));
        stableToken.safeApprove(address(daiJoin), type(uint256).max);

        depositThreshold = _depositThreshold;
        withdrawalThreshold = _withdrawalThreshold;
    }

    /// The version of this particular strategy
    function strategyVersion() external pure returns (string memory) {
        return VERSION;
    }

    /// @notice Owner can set the threshold at which balances are actually added/removed into DSR.
    /// eg If DAI balanceOf(this) is below the `_depositThreshold`, applyDeposits() will be a no-op
    function setThresholds(uint256 _depositThreshold, uint256 _withdrawalThreshold) external onlyStrategyExecutors {
        depositThreshold = _depositThreshold;
        withdrawalThreshold = _withdrawalThreshold;
        emit ThresholdsSet(_depositThreshold, _withdrawalThreshold);
    }

    /// @notice Matching DAI maths.
    /// @dev See DsrManager: 0x373238337Bfe1146fb49989fc222523f83081dDb
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

    /// @notice The latest checkpoint of total equity (latestAssetsValue - latestInternalDebt)
    /// Where:
    ///    assets = Latest checkpoint of value of assets in this strategy
    ///    debt   = The latest checkpoint of the internal Temple debt this strategy has accrued
    ///             The same as `dUSD.balanceOf(strategy)`
    ///             NB: the internal debt tokens won't be transferrable - Strategy Manager & GOV can mint/burn.
    ///    equity = assets - debt
    function latestEquityCheckpoint() external override view returns (int256 equity, uint256 assets, uint256 debt) {
        assets = _latestDaiBalance();
        debt = internalDebtToken.balanceOf(address(this));
        equity = int256(assets) - int256(debt);
    }

    /// @dev Calculate the latest assets and liabilities and checkpoint
    /// eg For DAI's DSR, we need to checkpoint to get the latest total.
    function checkpointEquity() external override returns (int256 equity, uint256 assets, uint256 debt) {
        assets = _checkpointDaiBalance();
        debt = internalDebtToken.balanceOf(address(this));
        equity = int256(assets) - int256(debt);
    }

    /**
      * @notice Apply any balance of DAI into DSR.
      * @dev DAI should be transferred to this contract first.
      */
    function applyDeposits() external onlyStrategyExecutors returns (uint256) {
        uint256 amount = stableToken.balanceOf(address(this));
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        // Don't apply the deposit if there isn't enough balance yet in the account
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
      * @notice Withdraw an amount of DAI from the DSR, and send to receiver
      */
    function withdraw(uint256 amount, address receiver) external onlyStrategyExecutors returns (uint256) {
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
        
        emit DaiWithdrawn(address(stableToken), amount, receiver);
        stableToken.safeTransfer(receiver, amount);
        return amount;
    }

    /**
      * @notice Withdraw all possible DAI from the DSR, and send to receiver
      */
    function withdrawAll(address receiver) external onlyStrategyExecutors returns (uint256) {
        uint256 amount = stableToken.balanceOf(address(this));

        // Send any balance of DAI sitting in the contract
        if (amount != 0) {
            stableToken.safeTransfer(receiver, amount);
        }

        // And also withdraw all from the DSR
        uint256 dsrShares = pot.pie(address(this));
        if (dsrShares != 0) {
            uint256 chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
            uint256 daiToReceive = dsrShares * chi / RAY;

            pot.exit(dsrShares);
            daiJoin.exit(receiver, daiToReceive);

            amount += daiToReceive;
        }

        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        emit DaiWithdrawn(address(stableToken), amount, receiver);
        return amount;
    }

    /// @notice Governance can call to shutdown this strategy. It must be set to 'isShuttingDown' in the StrategyManager first.
    /// 1/ All positions must be unwound before calling - which will be specific to the underlying strategy.
    /// 2/ The strategy manager should have max allowance to pull stables. Any stables are used to pay off dUSD
    /// 3/ Any remaining dUSD is a realised loss (bad debt).
    /// 4/ Any remaining stables are a realised profit.
    function shutdown() external override {


    }

}