pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/GnosisStrategy.sol)

import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";

contract GnosisStrategy  is AbstractStrategy {
    string public constant VERSION = "1.0.0";

    address public gnosisSafeWallet;

    uint256 public assetsValue;
    uint256 public assetsValuedAt;

    event AssetsValued(uint256 value);

    constructor(
        address _initialGov,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _stableToken,
        address _internalDebtToken,
        address _gnosisSafeWallet
    ) AbstractStrategy(_initialGov, _strategyName, _treasuryReservesVault, _stableToken, _internalDebtToken) {
        gnosisSafeWallet = _gnosisSafeWallet;
    }

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external pure returns (string memory) {
        return VERSION;
    }

    /**
     * @notice The latest checkpoint of total equity (latestAssetsValue - latestInternalDebt)
     *  Where:
     *     assets = Latest checkpoint of value of assets in this strategy
     *     debt   = The latest checkpoint of the internal Temple debt this strategy has accrued
     *              The same as `dUSD.balanceOf(strategy)`
     *     equity = assets - debt. This could be negative.
     */
    function latestEquityCheckpoint() external view returns (int256 equity, uint256 assets, uint256 debt) {
        debt = currentDebt();
        uint256 _assetsValue = assetsValue;
        equity = int256(_assetsValue) - int256(debt);
        emit EquityCheckpoint(equity, _assetsValue, debt);
    }

    /**
     * For a Gnosis Safe, the valuation of the assets needs to be done manually
     * 
     */
    function manualEquityCheckpoint(uint256 _assetsValue) external returns (int256 equity, uint256 assets, uint256 debt) {
        assetsValue = _assetsValue;
        assetsValuedAt = block.timestamp;

        debt = currentDebt();
        equity = int256(_assetsValue) - int256(debt);
        emit EquityCheckpoint(equity, _assetsValue, debt);
    }

    /**
     * @notice Calculate the latest assets and liabilities and checkpoint
     * eg For DAI's Savings Rate contract, we need to call a writable function to get the latest total.
     */
    function checkpointEquity() external returns (int256 equity, uint256 assets, uint256 debt) {
        return stableToken.balanceOf(gnosisSafeWallet) + stableToken.balanceOf(address(this));
    }

    /**
     * @notice An automated shutdown is not possible for a Gnosis strategy. The
     * strategy manager (the msig signers) will need to manually liquidate.
     *
     * Once done, they can give the all clear for governance to then shutdown the strategy
     * by calling TRV.shutdown(strategy, stables recovered)
     */
    function automatedShutdown() external virtual override {
        revert Unimplemented();
    }

}