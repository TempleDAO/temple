pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/GnosisStrategy.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";

contract GnosisStrategy  is AbstractStrategy {
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

    function setAssets(address[] calldata _assets) external onlyStrategyExecutors {
        assets = _assets;
        emit AssetsSet(_assets);
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
            _gnosisBalance = (_asset == address(0) ? gnosisSafeWallet.balance : IERC20(_asset).balanceOf(gnosisSafeWallet));
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