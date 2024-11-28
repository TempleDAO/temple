pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/DSRStrategy.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ITempleBaseStrategy } from "contracts/interfaces/v2/strategies/ITempleBaseStrategy.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";

/**
 * @title TESTNET Dai Savings Rate (DSR) - Base Strategy
 * @notice Instead of earning rewards via DSR, it mints the DAI directly
 */
contract DsrBaseStrategyTestnet is AbstractStrategy, ITempleBaseStrategy {
    using SafeERC20 for FakeERC20;

    string private constant VERSION = "1.0.0";

    FakeERC20 public immutable daiToken;

    uint256 public daiSavingsRate;
    uint256 public lastUpdatedAt;

    event DaiDeposited(uint256 amount);
    event DaiWithdrawn(uint256 amount);
    event DsrSet(uint256 rate);

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _daiToken,
        uint256 _daiSavingsRate
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        daiToken = FakeERC20(_daiToken);
        daiSavingsRate = _daiSavingsRate;
        lastUpdatedAt = block.timestamp;
        _updateTrvApprovals(address(0), _treasuryReservesVault);
    }

    /**
     * @notice A hook where strategies can optionally update approvals when the trv is updated
     */
    function _updateTrvApprovals(address oldTrv, address newTrv) internal override {
        _setMaxAllowance(daiToken, oldTrv, newTrv);
    }

    function setDaiSavingsRate(uint256 _newRate) external {
        _checkpointDaiBalance(daiToken.balanceOf(address(this)));
        daiSavingsRate = _newRate;
        emit DsrSet(_newRate);
    }

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external override pure returns (string memory) {
        return VERSION;
    }

    /**
     * @notice The latest balance available in DSR. 
     * This may be stale if the DSR rate hasn't been updated for a while.
     */
    function latestDsrBalance() public view returns (uint256) {
        return _updateBalance(daiToken.balanceOf(address(this)));
    }

    /// @dev Simple Interest calc: A = P * (1 + r*t)
    function _updateBalance(uint256 existingBalance) internal view returns (uint256) {
        // solhint-disable-next-line not-rely-on-time
        uint256 elapsed = block.timestamp - lastUpdatedAt;
        return existingBalance * (1e18 + (daiSavingsRate * elapsed / 365 days)) / 1e18;
    }

    function _checkpointDaiBalance(uint256 existingBalance) internal returns (uint256 dai) {
        uint256 newBalance = _updateBalance(existingBalance);
        daiToken.mint(address(this), newBalance - existingBalance);
        return newBalance;
    }

    /**
     * @notice The latest checkpoint of each asset balance this strategy holds, and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev The asset value may be stale at any point in time, depending on the strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() public override(AbstractStrategy, ITempleBaseStrategy) view returns (
        AssetBalance[] memory assetBalances
    ) {
        assetBalances = new AssetBalance[](1);
        assetBalances[0] = AssetBalance({
            asset: address(daiToken), 
            balance: latestDsrBalance()
        });
    }

    /**
     * @notice Calculate the latest assets and liabilities and checkpoint
     * For DAI's Savings Rate contract, we need to call a writable function to get the latest total.
     */
    function checkpointAssetBalances() external override returns (
        AssetBalance[] memory assetBalances
    ) {
        uint256 daiBalance = _checkpointDaiBalance(daiToken.balanceOf(address(this)));
        assetBalances = new AssetBalance[](1);
        assetBalances[0] = AssetBalance({
            asset: address(daiToken), 
            balance: daiBalance
        });
        emit AssetBalancesCheckpoint(assetBalances);
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
    function borrowAndDeposit(uint256 amount) external override onlyElevatedAccess {
        // Ensure our totals are updated before borrowing more
        _checkpointDaiBalance(daiToken.balanceOf(address(this)));

        // Borrow the DAI. This will also mint `dUSD` debt.
        treasuryReservesVault.borrow(daiToken, amount, address(this));
        emit DaiDeposited(amount);
    }

    /**
     * @notice Withdraw DAI from DSR and pay back to Treasury Reserves Vault
     */
    function withdrawAndRepay(uint256 withdrawalAmount) external onlyElevatedAccess {
        if (withdrawalAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();       

        // Ensure our totals are updated before repaying
        uint256 daiAvailable = _checkpointDaiBalance(daiToken.balanceOf(address(this)));
        if (withdrawalAmount > daiAvailable) revert CommonEventsAndErrors.InsufficientBalance(address(daiToken), withdrawalAmount, daiAvailable);
        emit DaiWithdrawn(withdrawalAmount);

        // Repay to TRV ensuring that funds stop in the TRV, they don't get pushed 
        // back to the base strategy (ie back here)
        treasuryReservesVault.repay(daiToken, withdrawalAmount, address(this));
    }

    /**
     * @notice Withdraw all possible DAI from the DSR, and send to the Treasury Reserves Vault
     */
    function withdrawAndRepayAll() external onlyElevatedAccess returns (uint256) {
        // Ensure our totals are updated before repaying
        uint256 daiAvailable = _checkpointDaiBalance(daiToken.balanceOf(address(this)));
        emit DaiWithdrawn(daiAvailable);

        // Repay to TRV ensuring that funds stop in the TRV, they don't get pushed 
        // back to the base strategy (ie back here)
        treasuryReservesVault.repay(daiToken, daiAvailable, address(this));
        return daiAvailable;
    }

    /**
     * @notice The TRV sends the tokens to deposit (and also mints equivalent dTokens)
     * The strategy is then expected to put those tokens to work.
     */
    function trvDeposit(uint256 amount) external override {
        if (msg.sender != address(treasuryReservesVault)) revert OnlyTreasuryReserveVault(msg.sender);
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        
        uint256 balance = daiToken.balanceOf(address(this));
        if (balance < amount) revert CommonEventsAndErrors.InvalidAmount(address(daiToken), amount);
        emit DaiDeposited(amount);

        // TRV sends the dai first - so take off the totals when minting the updated interest.
        _checkpointDaiBalance(balance - amount);
    }

    /**
     * @notice The TRV is able to withdraw on demand in order to fund other strategies which 
     * wish to borrow from the TRV.
     * @dev It may withdraw less than requested if there isn't enough balance in the DSR.
     */
    function trvWithdraw(uint256 requestedAmount) external override returns (uint256) {
        if (msg.sender != address(treasuryReservesVault)) revert OnlyTreasuryReserveVault(msg.sender);
        if (requestedAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();       

        // Ensure our totals are updated before repaying
        uint256 daiAvailable = _checkpointDaiBalance(daiToken.balanceOf(address(this)));

        if (requestedAmount > daiAvailable) {
            requestedAmount = daiAvailable;
        }

        emit DaiWithdrawn(requestedAmount);
        daiToken.safeTransfer(address(treasuryReservesVault), requestedAmount);
        return requestedAmount;
    }

    /**
     * @notice The strategy executor can shutdown this strategy, only after Governance has 
     * marked the strategy as `isShuttingDown` in the TRV.
     * This should handle all liquidations and send all funds back to the TRV, and will then call `TRV.shutdown()`
     * to apply the shutdown.
     * @dev Each strategy may require a different set of params to do the shutdown. It can abi encode/decode
     * that data off chain, or by first calling populateShutdownData()
     * Shutdown data isn't required for a DSR automated shutdown.
     */
    function _doShutdown(bytes calldata /*data*/) internal override {
        // Withdraw all from DSR
        uint256 daiAvailable = _checkpointDaiBalance(daiToken.balanceOf(address(this)));
        emit DaiWithdrawn(daiAvailable);

        // Repay to TRV ensuring that funds stop in the TRV, they don't get pushed 
        // back to the base strategy (ie back here)
        if (daiAvailable > 0) {
            treasuryReservesVault.repay(daiToken, daiAvailable, address(this));
        }
    }

}