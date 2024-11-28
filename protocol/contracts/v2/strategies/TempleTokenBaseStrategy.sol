pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/TempleTokenBaseStrategy.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ITempleBaseStrategy } from "contracts/interfaces/v2/strategies/ITempleBaseStrategy.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";

/**
 * @title Temple Token Base Strategy
 * @notice Temple is directly minted and burned in order to provide for strategies.
 */
contract TempleTokenBaseStrategy is AbstractStrategy, ITempleBaseStrategy {
    using SafeERC20 for ITempleERC20Token;

    string private constant VERSION = "1.0.0";

    /**
     * @notice The Temple token which is directly minted/burned.
     */
    ITempleERC20Token public immutable templeToken;

    event TempleMinted(uint256 amount);
    event TempleBurned(uint256 amount);

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _templeToken
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        templeToken = ITempleERC20Token(_templeToken);
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
        // No approvals required since it is a direct mint/burn
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
        treasuryReservesVault.borrow(templeToken, amount, address(this));
        emit TempleBurned(amount);
        templeToken.burn(amount);
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
        // Since we always mint/burn on demand, the balance is always zero.
        // TreasuryReservesVault::totalAvailable depends on the first asset with base strategies.
        assetBalances = new AssetBalance[](1);
        assetBalances[0] = AssetBalance({
            asset: address(templeToken), 
            balance: 0
        });
    }

    /**
     * @notice The TRV sends the tokens to deposit (and also mints equivalent dTokens)
     * @dev For Temple, we just burn the tokens out of circulating supply
     */
    function trvDeposit(uint256 amount) external override {
        if (msg.sender != address(treasuryReservesVault)) revert OnlyTreasuryReserveVault(msg.sender);
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        emit TempleBurned(amount);
        templeToken.burn(amount);
    }

    /**
     * @notice The TRV is able to withdraw on demand in order to fund other strategies which 
     * wish to borrow from the TRV.
     * @dev For Temple, we just mint the tokens.
     */
    function trvWithdraw(uint256 requestedAmount) external override returns (uint256) {
        address _trvAddr = address(treasuryReservesVault);
        if (msg.sender != _trvAddr) revert OnlyTreasuryReserveVault(msg.sender);
        if (requestedAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();       

        emit TempleMinted(requestedAmount);
        templeToken.mint(_trvAddr, requestedAmount);
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