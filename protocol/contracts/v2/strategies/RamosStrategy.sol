pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/RamosStrategy.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IRamos } from "contracts/interfaces/amo/IRamos.sol";
import { IBalancerVault } from "contracts/interfaces/external/balancer/IBalancerVault.sol";

import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";

contract RamosStrategy  is AbstractStrategy {
    using SafeERC20 for IERC20;
    string public constant VERSION = "1.0.0";

    /**
     * @notice The RAMOS contract used to manage the TPI
     */
    IRamos public ramos;

    event BorrowAndAddLiquidity(uint256 amount);
    event RemoveLiquidityAndRepay(uint256 amount);

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _ramos
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        ramos = IRamos(_ramos);
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
    function latestAssetBalances() public override view returns (
        AssetBalance[] memory assetBalances
    ) {
        // RAMOS strategy assets = RAMOS's DAI balance + claimed AURA & BPT rewards =
        // (bpt.balanceOf(RAMOS) / bpt.totalSupply() * Total_DAI_Balance in the LP) + 
        // claimed AURA & BAL rewards

        // get RAMOS's Stable's balance
        (,, uint256 stableBalanceInRamos) = ramos.positions();

        assetBalances = new AssetBalance[](1);
        assetBalances[0] = AssetBalance({
            asset: address(stableToken),
            balance: stableBalanceInRamos
        });
    }

    /**
     * @notice Borrow a fixed amount from the Treasury Reserves and add liquidity
     * These stables are sent to the RAMOS to add liquidity and stake BPT
     */
    function borrowAndAddLiquidity(uint256 _amount, IBalancerVault.JoinPoolRequest memory _requestData) external onlyElevatedAccess {
        // Borrow the DAI and send it to RAMOS. This will also mint `dUSD` debt.
        treasuryReservesVault.borrow(_amount, address(ramos));
        emit BorrowAndAddLiquidity(_amount);

        // Add liquidity
        ramos.addLiquidity(_requestData);
    }

    /**
     * @notice Remove liquidity and repay debt back to the Treasury Reserves
     * The stables from the removed liquidity are sent from RAMOS to this address to repay debt
     */
    function removeLiquidityAndRepay(IBalancerVault.ExitPoolRequest memory _requestData, uint256 _bptAmount) external onlyElevatedAccess {
        // Remove liquidity
        ramos.removeLiquidity(_requestData, _bptAmount, address(this));

        // Repay debt back to the Treasury Reserves
        uint256 stableBalance = stableToken.balanceOf(address(this));

        treasuryReservesVault.repay(stableBalance, address(this));
        emit RemoveLiquidityAndRepay(stableBalance);
    }

    function populateShutdownData(
        bytes memory populateParams
    ) external virtual override returns (
        bytes memory shutdownParams
    ) {
        // Get a quote to remove all liquidity.
        // @todo
    }

    /**
     * @notice @todo 
     *
     * Once done, they can give the all clear for governance to then shutdown the strategy
     * by calling TRV.shutdown(strategy, stables recovered)
     */
    function doShutdown(bytes memory /*data*/) internal virtual override returns (uint256) {
        revert Unimplemented();
    }
}