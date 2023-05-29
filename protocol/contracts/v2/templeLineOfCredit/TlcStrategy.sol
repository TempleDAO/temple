pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TlcStrategy.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AbstractStrategy, ITempleStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";
import { ITempleLineOfCredit } from "contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

contract TlcStrategy is ITlcStrategy, AbstractStrategy {
    string public constant VERSION = "1.0.0";

    ITempleLineOfCredit public immutable tlc;

    address public immutable templeToken;

    event Borrow(uint256 amount, address recipient);

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _tlc,
        address _templeToken
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        tlc = ITempleLineOfCredit(_tlc);
        templeToken = _templeToken;
    }

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external override pure returns (string memory) {
        return VERSION;
    }

    /**
     * @notice The latest checkpoint of each asset balance this stratgy holds, and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev The asset value may be stale at any point in time, depending onthe strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() public override(AbstractStrategy, ITempleStrategy) view returns (
        AssetBalance[] memory assetBalances, 
        uint256 debt
    ) {
        // The only asset which TLC has is the Temple collateral given by users.
        // In the case of a user liquidation, that user Temple is burned, and
        // the equivalent dUSD debt is also reduced by `Temple x TPI`
        assetBalances = new AssetBalance[](1);
        assetBalances[0] = AssetBalance({
            asset: templeToken,
            balance: addManualAssetBalanceDelta(
                IERC20(templeToken).balanceOf(address(tlc)), 
                templeToken
            )
        });

        debt = currentDebt();
    }

    /**
     * @notice An automated shutdown is not possible for a Gnosis strategy. The
     * strategy manager (the msig signers) will need to manually liquidate.
     *
     * Once done, they can give the all clear for governance to then shutdown the strategy
     * by calling TRV.shutdown(strategy, stables recovered)
     */
    function automatedShutdown() external virtual override returns (uint256) {
        revert Unimplemented();
    }

    function fundFromTrv(uint256 amount, address recipient) external override {
        if (msg.sender != address(tlc)) revert CommonEventsAndErrors.InvalidAccess();

        emit Borrow(amount, recipient);
        treasuryReservesVault.borrow(amount, recipient);
    }
}
