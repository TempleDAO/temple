pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/SkyFarmBaseStrategy.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";

import { ITempleBaseStrategy } from "contracts/interfaces/v2/strategies/ITempleBaseStrategy.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

interface DaiUsds {
    function daiToUsds(address usr, uint256 wad) external;
    function usdsToDai(address usr, uint256 wad) external;
    function dai() external view returns (IERC20);
    function usds() external view returns (IERC20);
}

/**
 * @title DAI to Origami SKY Farm - Base Strategy
 * @notice Deposit idle DAI from the Treasury Reserve Vaults into the Origami sUSDS+s ERC4626 vault
 */
contract SkyFarmBaseStrategy is AbstractStrategy, ITempleBaseStrategy {
    using SafeERC20 for IERC20;

    string private constant VERSION = "1.0.0";

    /// @notice DAI
    IERC20 public immutable daiToken;

    /// @notice USDS
    IERC20 public immutable usdsToken;

    /// @notice The ERC4626 vault token taking USDS deposits
    IERC4626 public immutable usdsVaultToken;

    /// @notice Maker/Sky provided contract to convert DAI<-->USDS 1:1
    DaiUsds public immutable daiToUsds;

    event DaiDeposited(uint256 amount);
    event DaiWithdrawn(uint256 amount);

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _usdsVaultToken,
        address _daiToUsds
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        usdsVaultToken = IERC4626(_usdsVaultToken);
        daiToUsds = DaiUsds(_daiToUsds);
        daiToken = daiToUsds.dai();
        usdsToken = daiToUsds.usds();

        // Grant maximum approval - these can be changed later if required by elevated access
        // see AbstractStrategy::setTokenAllowance()
        daiToken.forceApprove(address(daiToUsds), type(uint256).max);
        usdsToken.forceApprove(address(usdsVaultToken), type(uint256).max);
        usdsToken.forceApprove(address(daiToUsds), type(uint256).max);

        _updateTrvApprovals(address(0), _treasuryReservesVault);
    }

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external override pure returns (string memory) {
        return VERSION;
    }

    /**
     * @notice The latest DAI amount which can be withdrawn from the USDS savings vault
     * @dev USDS within the vault can be redeemed 1:1 for DAI
     */
    function latestDaiBalance() public view returns (uint256) {
        return usdsVaultToken.maxWithdraw(address(this));
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
            asset: address(daiToken), 
            balance: latestDaiBalance()
        });
    }

    /**
     * @notice Periodically, the Base Strategy will pull a fixed amount of idle DAI reserves
     * from the TRV contract and deposit into the `usdsVaultToken` in order to generate base yield 
     * (the basis of the dUSD base in interest rate.)
     *
     * These idle DAI will only be drawn from a balance of tokens in the TRV itself.
     * 
     * This will be likely be called from a bot. It should only do this if there's a 
     * minimum threshold to pull and deposit given gas costs to deposit.
     */
    function borrowAndDeposit(uint256 amount) external override onlyElevatedAccess {
        // Borrow the DAI. This will also mint `dUSD` debt.
        treasuryReservesVault.borrow(daiToken, amount, address(this));
        _daiDeposit(amount);
    }

    /**
     * @notice Withdraw DAI from the `usdsVaultToken` and pay back to Treasury Reserves Vault
     */
    function withdrawAndRepay(uint256 withdrawalAmount) external onlyElevatedAccess {
        if (withdrawalAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();       

        uint256 daiAvailable = latestDaiBalance();
        if (withdrawalAmount > daiAvailable) revert CommonEventsAndErrors.InsufficientBalance(address(daiToken), withdrawalAmount, daiAvailable);
        
        _daiWithdrawal(withdrawalAmount);

        // Repay to TRV ensuring that funds stop in the TRV, they don't get pushed 
        // back to the base strategy (ie back here)
        treasuryReservesVault.repay(daiToken, withdrawalAmount, address(this));
    }

    /**
     * @notice Withdraw all possible DAI from the `usdsVaultToken`, and send to the Treasury Reserves Vault
     */
    function withdrawAndRepayAll() external onlyElevatedAccess returns (uint256 daiAmount) {
        daiAmount = _vaultRedemption(usdsVaultToken.maxRedeem(address(this)));

        // Repay to TRV ensuring that funds stop in the TRV, they don't get pushed 
        // back to the base strategy (ie back here)
        treasuryReservesVault.repay(daiToken, daiAmount, address(this));
    }

    /**
     * @notice The TRV sends the tokens to deposit (and also mints equivalent dTokens)
     * The strategy is then expected to put those tokens to work.
     */
    function trvDeposit(uint256 amount) external override {
        if (msg.sender != address(treasuryReservesVault)) revert OnlyTreasuryReserveVault(msg.sender);
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        _daiDeposit(amount);
    }

    /**
     * @notice The TRV is able to withdraw on demand in order to fund other strategies which 
     * wish to borrow from the TRV.
     * @dev It may withdraw less than requested if there isn't enough balance in the `usdsVaultToken`.
     */
    function trvWithdraw(uint256 requestedAmount) external override returns (uint256) {
        address _trvAddr = address(treasuryReservesVault);
        if (msg.sender != _trvAddr) revert OnlyTreasuryReserveVault(msg.sender);
        if (requestedAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();       

        // Cap at the max amount which can be withdrawn.
        uint256 availableToWithdraw = usdsVaultToken.maxWithdraw(address(this));
        if (requestedAmount > availableToWithdraw) {
            requestedAmount = availableToWithdraw;
        }

        _daiWithdrawal(requestedAmount);
        daiToken.safeTransfer(_trvAddr, requestedAmount);
        return requestedAmount;
    }

    /**
     * @notice A hook where strategies can optionally update approvals when the trv is updated
     */
    function _updateTrvApprovals(address oldTrv, address newTrv) internal override {
        _setMaxAllowance(daiToken, oldTrv, newTrv);
    }

    function _daiDeposit(uint256 daiAmount) internal {
        // Convert to USDS
        daiToUsds.daiToUsds(address(this), daiAmount);

        // Deposit into the USDS savings vault
        usdsVaultToken.deposit(daiAmount, address(this));
        emit DaiDeposited(daiAmount);
    }

    function _daiWithdrawal(uint256 daiAmount) internal {
        // Withdraw from the USDS savings vault
        usdsVaultToken.withdraw(daiAmount, address(this), address(this));

        // Convert to DAI
        daiToUsds.usdsToDai(address(this), daiAmount);
        emit DaiWithdrawn(daiAmount);
    }

    function _vaultRedemption(uint256 vaultShares) internal returns (uint256 daiAmount) {
        // Redeem from the USDS savings vault
        daiAmount = usdsVaultToken.redeem(vaultShares, address(this), address(this));

        // Convert to DAI
        daiToUsds.usdsToDai(address(this), daiAmount);
        emit DaiWithdrawn(daiAmount);
    }

    /**
     * @notice The strategy executor can shutdown this strategy, only after Governance has 
     * marked the strategy as `isShuttingDown` in the TRV.
     * This should handle all liquidations and send all funds back to the TRV, and will then call `TRV.shutdown()`
     * to apply the shutdown.
     * @dev Each strategy may require a different set of params to do the shutdown. It can abi encode/decode
     * that data off chain, or by first calling populateShutdownData()
     * Shutdown data isn't required for the `usdsVaultToken` automated shutdown.
     */
    function _doShutdown(bytes calldata /*data*/) internal override {
        // Withdraw all
        uint256 daiAmount = _vaultRedemption(usdsVaultToken.maxRedeem(address(this)));

        // Repay to TRV ensuring that funds stop in the TRV, they don't get pushed 
        // back to the base strategy (ie back here)
        if (daiAmount > 0) {
            treasuryReservesVault.repay(daiToken, daiAmount, address(this));
        }
    }
}
