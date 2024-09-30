pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/GnosisStrategy.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleCircuitBreakerProxy } from "contracts/interfaces/v2/circuitBreaker/ITempleCircuitBreakerProxy.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";

contract GnosisStrategy is AbstractStrategy {
    using SafeERC20 for IERC20;
    string private constant VERSION = "1.0.0";

    /**
     * @notice The underlying gnosis safe wallet which is reported on.
     */
    address public immutable gnosisSafeWallet;

    /**
     * @notice The list of assets which are reporting on for equity performance updates
     * Total balances = the gnosis safe balance of the asset + any delta from `assetBalanceDeltas`
     */
    address[] public assets;

    /**
     * @notice New withdrawals of tokens from TRV are checked against a circuit breaker
     * to ensure no more than a cap is withdrawn in a given period
     */
    ITempleCircuitBreakerProxy public immutable circuitBreakerProxy;

    event AssetsSet(address[] _assets);
    event Borrow(address indexed token, uint256 amount);
    event Repay(address indexed token, uint256 amount);

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _gnosisSafeWallet,
        address _circuitBreakerProxy
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        gnosisSafeWallet = _gnosisSafeWallet;
        circuitBreakerProxy = ITempleCircuitBreakerProxy(_circuitBreakerProxy);
    }

    /**
     * @notice A hook where strategies can optionally update approvals when the trv is updated
     */
    function _updateTrvApprovals(
        address oldTrv, 
        address newTrv
    ) internal override
    // solhint-disable-next-line no-empty-blocks
    {
        // Tokens for Gnosis strategy are approved when they're required, rather than upfront.
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
    function setAssets(address[] calldata _assets) external onlyElevatedAccess {
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
     * @notice Borrow a fixed amount from the Treasury Reserves
     * These stables are sent to the Gnosis wallet
     */
    function borrow(IERC20 token, uint256 amount) external onlyElevatedAccess {
        circuitBreakerProxy.preCheck(
            address(token), 
            msg.sender, 
            amount
        );
        emit Borrow(address(token), amount);
        treasuryReservesVault.borrow(token, amount, gnosisSafeWallet);
    }

    /**
     * @notice Borrow the max amount from the Treasury Reserves
     * These stables are sent to the Gnosis wallet
     */
    function borrowMax(IERC20 token) external onlyElevatedAccess returns (uint256 borrowedAmount) {
        ITreasuryReservesVault _trv = treasuryReservesVault;
        borrowedAmount = _trv.availableForStrategyToBorrow(address(this), token);
        circuitBreakerProxy.preCheck(
            address(token), 
            msg.sender, 
            borrowedAmount
        );
        emit Borrow(address(token), borrowedAmount);
        _trv.borrow(token, borrowedAmount, gnosisSafeWallet);
    }

    /**
     * @notice Repay debt back to the Treasury Reserves.
     * First send the stable tokens to this strategy prior to calling.
     */
    function repay(IERC20 token, uint256 amount) external onlyElevatedAccess {
        ITreasuryReservesVault _trv = treasuryReservesVault;
        emit Repay(address(token), amount);
        _setTokenAllowance(token, address(_trv), amount);
        _trv.repay(token, amount, address(this));
    }

    /**
     * @notice Repay debt back to the Treasury Reserves.
     * First send the stable tokens to this strategy prior to calling.
     */
    function repayAll(IERC20 token) external onlyElevatedAccess returns (uint256 repaidAmount) {
        // Set max allowance, repay all, then set the allowance to zero
        ITreasuryReservesVault _trv = treasuryReservesVault;
        _setTokenAllowance(token, address(_trv), type(uint256).max);
        repaidAmount = _trv.repayAll(token, address(this));
        _setTokenAllowance(token, address(_trv), 0);
        
        emit Repay(address(token), repaidAmount);
    }

    /** 
     * @notice Pull tokens from this contract back into it's whitelisted gnosis
     */
    function recoverToGnosis(address token, uint256 amount) external onlyElevatedAccess {
        IERC20(token).safeTransfer(gnosisSafeWallet, amount);
        emit CommonEventsAndErrors.TokenRecovered(gnosisSafeWallet, token, amount);
    }

    /**
     * @notice The latest checkpoint of each asset balance this strategy holds, and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev The asset value may be stale at any point in time, depending on the strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() public override view returns (
        AssetBalance[] memory assetBalances
    ) {
        uint256 _length = assets.length;
        assetBalances = new AssetBalance[](_length);

        address _asset;
        uint256 _gnosisBalance;
        for (uint256 i; i < _length; ++i) {
            _asset = assets[i];
            _gnosisBalance = _asset == address(0)
                ? gnosisSafeWallet.balance // ETH
                : (
                    IERC20(_asset).balanceOf(gnosisSafeWallet) +
                    IERC20(_asset).balanceOf(address(this))
                );

            assetBalances[i] = AssetBalance({
                asset: _asset,
                balance: _gnosisBalance
            });
        }
    }

    /**
     * @notice An automated shutdown is not possible for a Gnosis strategy. The
     * executor will need to manually liquidate.
     *
     * Once done, they can give the all clear for governance to then shutdown the strategy
     * by calling TRV.shutdown(strategy, stables recovered)
     */
    function _doShutdown(bytes calldata /*data*/) internal virtual override {
        revert CommonEventsAndErrors.Unimplemented();
    }

}