pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/RamosStrategy.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { AMO__IRamos } from "contracts/amo/interfaces/AMO__IRamos.sol";
import { AMO__IAuraStaking } from "contracts/amo/interfaces/AMO__IAuraStaking.sol";
import { AMO__IPoolHelper, AMO__IBalancerVault } from "contracts/amo/interfaces/AMO__IPoolHelper.sol";


interface IBPT {
    function getActualSupply() external view returns (uint256);
}

contract RamosStrategy  is AbstractStrategy {
    using SafeERC20 for IERC20;
    string public constant VERSION = "1.0.0";

    /**
     * @notice The RAMOS contract used to manage the TPI
     */
    AMO__IRamos public ramos;

    /**
     * @notice The list of assets which are reporting on for equity performance updates
     * Total balances = the RAMOS strategy balance of the asset + any delta from `assetBalanceDeltas`
     */
    address[] public assets;

    event AssetsSet(address[] _assets);
    event BorrowAndAddLiquidity(uint256 amount);
    event RemoveLiquidityAndRepay(uint256 amount);

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _ramos
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        ramos = AMO__IRamos(_ramos);
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
        for (uint256 i; i < _assets.length; ++i) {
            if (_assets[i] == address(0)) revert CommonEventsAndErrors.InvalidAddress(_assets[i]);   // 0x00 == ETH
        }

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
     * @notice The latest checkpoint of each asset balance this stratgy holds, and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev The asset value may be stale at any point in time, depending onthe strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() public override view returns (AssetBalance[] memory assetBalances, uint256 debt) {
        // RAMOS strategy assets = RAMOS's DAI balance + claimed AURA & BPT rewards =
        // (bpt.balanceOf(RAMOS) / bpt.totalSupply() * Total_DAI_Balance in the LP) + 
        // claimed AURA & BAL rewards

        // get the RAMOS's DAI balance
        AMO__IAuraStaking amoStaking = AMO__IAuraStaking(ramos.amoStaking());
        AMO__IPoolHelper poolHelper = AMO__IPoolHelper(ramos.poolHelper());
        IERC20 bptToken = IERC20(ramos.bptToken());
        address stable = ramos.stable();

        uint256 stableBalanceInRamos;
        {
            // Use `bpt.getActualSupply()` instead of `bpt.totalSupply()`
            // https://docs.balancer.fi/reference/lp-tokens/underlying.html#overview
            // https://docs.balancer.fi/concepts/advanced/valuing-bpt.html#on-chain
            uint256 bptTotalSupply = IBPT(address(bptToken)).getActualSupply();
            if (bptTotalSupply > 0) {
                uint256 bptBalanceInRamos = amoStaking.stakedBalance() + bptToken.balanceOf(address(amoStaking));
                (, uint256 stableBalanceInLP) = poolHelper.getTempleStableBalances();

                stableBalanceInRamos = stableBalanceInLP * bptBalanceInRamos / bptTotalSupply;
            }
        }

        // get the RAMOS strategy assets
        uint256 length = assets.length;
        assetBalances = new AssetBalance[](length);

        address asset;
        uint256 ramosStrategyBalance;
        for (uint256 i; i < length; ++i) {
            asset = assets[i];

            if (asset == stable) {
                // Sum the RAMOS balance and this contract's balance of the ERC20.
                ramosStrategyBalance = stableBalanceInRamos + IERC20(asset).balanceOf(address(this));
            } else {
                // Sum the `amoStaking` balance, `rewardsRecipient` balance and this contract's balance of the ERC20.
                // But since `rewardsRecipient` address may be a hot wallet with a bunch of different things going on, we won't include that balance
                ramosStrategyBalance = IERC20(asset).balanceOf(address(amoStaking)) + IERC20(asset).balanceOf(address(this));
            }

            assetBalances[i] = AssetBalance({
                asset: asset,
                balance: addManualAssetBalanceDelta(ramosStrategyBalance, asset)
            });
        }

        debt = currentDebt();
    }

    /**
     * @notice Borrow a fixed amount from the Treasury Reserves and add liquidity
     * These stables are sent to the RAMOS to add liquidity and stake BPT
     */
    function borrowAndAddLiquidity(uint256 _amount, AMO__IBalancerVault.JoinPoolRequest memory _requestData) external onlyElevatedAccess {
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
    function removeLiquidityAndRepay(AMO__IBalancerVault.ExitPoolRequest memory _requestData, uint256 _bptAmount) external onlyElevatedAccess {
        // Remove liquidity
        ramos.removeLiquidity(_requestData, _bptAmount, address(this));

        // Repay debt back to the Treasury Reserves
        uint256 stableBalance = stableToken.balanceOf(address(this));

        treasuryReservesVault.repay(stableBalance, address(this));
        emit RemoveLiquidityAndRepay(stableBalance);
    }

    /**
     * @notice An automated shutdown is not possible for a RAMOS strategy. The
     * strategy manager (the msig signers) will need to manually liquidate.
     *
     * Once done, they can give the all clear for governance to then shutdown the strategy
     * by calling TRV.shutdown(strategy, stables recovered)
     */
    function automatedShutdown() external virtual override returns (uint256) {
        revert Unimplemented();
    }
}