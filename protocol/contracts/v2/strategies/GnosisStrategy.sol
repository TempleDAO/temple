pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/GnosisStrategy.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

contract GnosisStrategy  is AbstractStrategy {
    using SafeERC20 for IERC20;
    string public constant VERSION = "1.0.0";

    /**
     * @notice The underlying gnosis safe wallet which is reported on.
     */
    address public gnosisSafeWallet;

    /**
     * @notice The list of assets which are reporting on for equity performance updates
     * Total balances = the gnosis safe balance of the asset + any delta from `assetBalanceDeltas`
     */
    address[] public assets;

    event AssetsSet(address[] _assets);
    event Borrow(uint256 amount);
    event Repay(uint256 amount);

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
    function strategyVersion() external override pure returns (string memory) {
        return VERSION;
    }

    /**
     * @notice The assets on which to report balances need to be set by the Strategy Executors
     * @dev Use the zero address (0x000) to represent native ETH
     */
    function setAssets(address[] calldata _assets) external onlyStrategyExecutors {
        assets = _assets;
        emit AssetsSet(_assets);
    }

    /**
     * @notice The assets on which to report balances need to be set by the Strategy Executors
     * @dev The zero address (0x000) represents native ETH
     */
    function getAssets() external view returns (address[] memory) {
        return assets;
    }

    /**
     * @notice A strategy executor borrows a fixed amount from the Treasury Reserves
     * These stables are sent to the Gnosis wallet
     */
    function borrow(uint256 amount) external onlyStrategyExecutors {
        emit Borrow(amount);
        treasuryReservesVault.borrow(amount);
        stableToken.safeTransfer(gnosisSafeWallet, amount);
    }

    /**
     * @notice A strategy executor borrows the max amount from the Treasury Reserves
     * These stables are sent to the Gnosis wallet
     */
    function borrowMax() external onlyStrategyExecutors returns (uint256 borrowedAmount) {
        borrowedAmount = treasuryReservesVault.borrowMax();
        emit Borrow(borrowedAmount);
        stableToken.safeTransfer(gnosisSafeWallet, borrowedAmount);
    }

    /**
     * @notice A strategy executor repays debt back to the Treasury Reserves.
     * They must send the stable tokens to this strategy prior to calling.
     */
    function repay(uint256 amount) external onlyStrategyExecutors {
        emit Repay(amount);
        treasuryReservesVault.repay(amount);
    }

    /**
     * @notice A strategy executor repays debt back to the Treasury Reserves.
     * They must send the stable tokens to this strategy prior to calling.
     */
    function repayAll() external onlyStrategyExecutors returns (uint256 repaidAmount) {
        repaidAmount = treasuryReservesVault.repayAll();
        emit Repay(repaidAmount);
    }

    /** 
     * @notice A strategy executor pulls tokens from this contract back into it's whitelisted gnosis
     */
    function recoverToGnosis(address token, uint256 amount) external onlyStrategyExecutors {
        IERC20(token).safeTransfer(gnosisSafeWallet, amount);
        emit CommonEventsAndErrors.TokenRecovered(gnosisSafeWallet, token, amount);
    }

    /**
     * @notice The latest checkpoint of each asset balance this stratgy holds, and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev The asset value may be stale at any point in time, depending onthe strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() public override view returns (AssetBalance[] memory assetBalances, uint256 debt) {
        uint256 _length = assets.length;
        assetBalances = new AssetBalance[](_length);

        address _asset;
        uint256 _gnosisBalance;
        for (uint256 i; i < _length; ++i) {
            _asset = assets[i];

            if (_asset == address(0)) {
                // 0x00 == ETH
                _gnosisBalance = gnosisSafeWallet.balance;
            } else {
                // Sum the gnosis balance and this contract's balance of the ERC20.
                _gnosisBalance = (
                    IERC20(_asset).balanceOf(gnosisSafeWallet) +
                    IERC20(_asset).balanceOf(address(this))
                );
            }

            assetBalances[i] = AssetBalance({
                asset: _asset,
                balance: addManualAssetBalanceDelta(_gnosisBalance, _asset)
            });
        }

        debt = currentDebt();
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