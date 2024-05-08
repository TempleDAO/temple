pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/TlcStrategy.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/strategies/ITlcStrategy.sol";
import { ITempleLineOfCredit } from "contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol";

import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/**
 * @title Temple Line of Credit Strategy
 * @notice A simple wrapper strategy over TLC, where
 * the assets is the current total user debt.
 */
contract TlcStrategy is ITlcStrategy, AbstractStrategy {
    string private constant VERSION = "1.0.0";

    ITempleLineOfCredit public immutable tlc;

    IERC20 public immutable daiToken;

    event Borrow(uint256 amount, address recipient);

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _tlc,
        address _daiToken
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        tlc = ITempleLineOfCredit(_tlc);
        daiToken = IERC20(_daiToken);
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
        // TLC repays the DAI directly on behalf of the strategy - no automated approvals required
    }

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external override pure returns (string memory) {
        return VERSION;
    }

    /**
     * @notice The latest checkpoint of each asset balance this strategy holds, and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev The asset value may be stale at any point in time, depending on the strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() public override(AbstractStrategy, ITempleStrategy) view returns (
        AssetBalance[] memory assetBalances
    ) {
        (
            ITempleLineOfCredit.TotalDebtPosition memory daiPosition
        ) = tlc.totalDebtPosition();

        // The total accrued debt of DAI in TLC
        assetBalances = new AssetBalance[](1);
        assetBalances[0] = AssetBalance({
            asset: address(daiToken),
            balance: daiPosition.totalDebt
        });
    }

    /**
     * @notice An automated shutdown is not possible for a TLC strategy. The
     * executor will need to set TLC parameters to encourage users to exit first.
     *
     * Once done, they can give the all clear for governance to then shutdown the strategy
     * by calling TRV.shutdown(strategy, stables recovered)
     */
    function _doShutdown(bytes calldata /*data*/) internal virtual override {
        revert CommonEventsAndErrors.Unimplemented();
    }

    /**
     * @notice TLC (only) will call on this to fund user borrows of DAI
     */
    function fundFromTrv(uint256 amount, address recipient) external override {
        if (msg.sender != address(tlc)) revert CommonEventsAndErrors.InvalidAccess();

        emit Borrow(amount, recipient);
        treasuryReservesVault.borrow(daiToken, amount, recipient);
    }

    /**
     * @notice A hook which is called by the Treasury Reserves Vault when the debt ceiling
     * for this strategy is updated
     * @dev by default it's a no-op unless the strategy implements it
     */
    function _debtCeilingUpdated(IERC20 /*token*/, uint256 /*newDebtCeiling*/) internal override {
        tlc.refreshInterestRates();
    }
}
