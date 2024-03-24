pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/DSRStrategy.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ITempleBaseStrategy } from "contracts/interfaces/v2/strategies/ITempleBaseStrategy.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/**
 * @title Temple Token Base Strategy
 * @notice Temple is directly minted and burned in order to provide for strategies.
 */
contract MockBaseStrategy is AbstractStrategy, ITempleBaseStrategy {
    using SafeERC20 for IERC20;

    string private constant VERSION = "1.0.0";

    IERC20 public immutable token;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _token
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        token = IERC20(_token);
        _updateTrvApprovals(address(0), _treasuryReservesVault);
    }

    /**
     * @notice A hook where strategies can optionally update approvals when the trv is updated
     */
    function _updateTrvApprovals(address oldTrv, address newTrv) internal override {
        _setMaxAllowance(token, oldTrv, newTrv);
    }

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external override pure returns (string memory) {
        return VERSION;
    }

    /**
     * @notice The base strategy can pull any idle Temple from the TRV and burn them.
     */
    function borrowAndDeposit(uint256 amount) external override onlyElevatedAccess {
        treasuryReservesVault.borrow(token, amount, address(this));
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
            asset: address(token), 
            balance: token.balanceOf(address(this))
        });
    }

    /**
     * @notice The TRV sends the tokens to deposit (and also mints equivalent dTokens)
     * @dev For Temple, we just burn the tokens out of circulating supply
     */
    function trvDeposit(uint256 amount) external view override {
        if (msg.sender != address(treasuryReservesVault)) revert OnlyTreasuryReserveVault(msg.sender);
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        // no op
    }

    /**
     * @notice The TRV is able to withdraw on demand in order to fund other strategies which 
     * wish to borrow from the TRV.
     * @dev For Temple, we just mint the tokens.
     */
    function trvWithdraw(uint256 requestedAmount) external override returns (uint256) {
        if (msg.sender != address(treasuryReservesVault)) revert OnlyTreasuryReserveVault(msg.sender);
        if (requestedAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();       

        // Cap to the available balance
        uint256 _balance = token.balanceOf(address(this));
        if (requestedAmount > _balance) {
            requestedAmount = _balance;
        }

        token.safeTransfer(msg.sender, requestedAmount);
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
    function _doShutdown(bytes calldata /*data*/) internal pure override {
        revert CommonEventsAndErrors.Unimplemented();
    }

}