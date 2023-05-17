pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/DSRStrategy.sol)

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IMakerDaoDaiJoinLike } from "contracts/interfaces/external/makerDao/IMakerDaoDaiJoinLike.sol";
import { IMakerDaoPotLike } from "contracts/interfaces/external/makerDao/IMakerDaoPotLike.sol";
import { IMakerDaoVatLike } from "contracts/interfaces/external/makerDao/IMakerDaoVatLike.sol";
import { ITempleBaseStrategy } from "contracts/interfaces/v2/strategies/ITempleBaseStrategy.sol";
import { AbstractStrategy, ITempleStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/**
 * @title Dai Savings Rate (DSR) - Base Strategy
 * @notice Deposit idle DAI from the Treasury Reserve Vaults into the Maker DSR (DAI Savings Rate module)
 */
contract DsrBaseStrategy is AbstractStrategy, ITempleBaseStrategy {
    using SafeERC20 for IERC20;

    string public constant VERSION = "1.0.0";

    /**
     * @notice The MakerDAO contract used to enter/exit DSR
     */
    IMakerDaoDaiJoinLike public immutable daiJoin;

    /**
     * @notice The MakerDAO contract to query balances/rates of within DSR
     */
    IMakerDaoPotLike public immutable pot;

    /**
     * @notice MakerDAO const used in DSR share->DAI conversions
     */
    uint256 public constant RAY = 10 ** 27;

    event DaiDeposited(uint256 amount);
    event DaiWithdrawn(uint256 amount);

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _daiJoin, 
        address _pot
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        daiJoin = IMakerDaoDaiJoinLike(_daiJoin);
        IMakerDaoVatLike vat = IMakerDaoVatLike(daiJoin.vat());
        pot = IMakerDaoPotLike(_pot);
        vat.hope(address(daiJoin));
        vat.hope(address(pot));
        stableToken.safeApprove(address(daiJoin), type(uint256).max);
    }

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external override pure returns (string memory) {
        return VERSION;
    }

    /**
     * @notice Match DAI DSR's maths.
     * @dev See DsrManager: 0x373238337Bfe1146fb49989fc222523f83081dDb
     */
    function _rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        // always rounds down
        z = x * y / RAY;
    }

    function _rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        // always rounds down
        z = x * RAY / y;
    }

    function _rdivup(uint256 x, uint256 y) internal pure returns (uint256 z) {
        // always rounds up
        z = ((x * RAY) + (y - 1)) / y;
    }
    
    /**
     * @notice The latest balance available in DSR. 
     * This may be stale if the DSR rate hasn't been updated for a while.
     */
    function latestDsrBalance() public view returns (uint256) {
        // pot.chi() == DAI/share (accurate to the last checkpoint)
        // pot.pie() == number of shares this contract holds.
        return _rmul(pot.chi(), pot.pie(address(this)));
    }

    function _checkpointChi() internal returns (uint256 chi) {
        chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
    }

    function _checkpointDaiBalance() internal returns (uint256 dai, uint256 chi, uint256 shares) {
        chi = _checkpointChi();
        shares = pot.pie(address(this));
        dai = _rmul(chi, shares);
    }

    /**
     * @notice The latest checkpoint of each asset balance this stratgy holds, and the current debt.
     * This will be used to report equity performance: `sum(asset value in STABLE) - debt`
     * The conversion of each asset price into the stable token (eg DAI) will be done off-chain
     *
     * @dev The asset value may be stale at any point in time, depending onthe strategy. 
     * It may optionally implement `checkpointAssetBalances()` in order to update those balances.
     */
    function latestAssetBalances() public override(AbstractStrategy, ITempleStrategy) view returns (AssetBalance[] memory assetBalances, uint256 debt) {
        assetBalances = new AssetBalance[](1);
        assetBalances[0] = AssetBalance({
            asset: address(stableToken), 
            balance: addManualAssetBalanceDelta(latestDsrBalance(), address(stableToken))
        });
        debt = currentDebt();
    }

    /**
     * @notice Calculate the latest assets and liabilities and checkpoint
     * For DAI's Savings Rate contract, we need to call a writable function to get the latest total.
     */
    function checkpointAssetBalances() external override(AbstractStrategy, ITempleStrategy) returns (AssetBalance[] memory assetBalances, uint256 debt) {
        (uint256 daiBalance,,) = _checkpointDaiBalance();
        assetBalances = new AssetBalance[](1);
        assetBalances[0] = AssetBalance({
            asset: address(stableToken), 
            balance: addManualAssetBalanceDelta(daiBalance, address(stableToken))
        });
        debt = currentDebt();
        emit AssetBalancesCheckpoint(assetBalances, debt);
    }

    /**
     * @notice Periodically, the Base Strategy will pull a fixed amount of idle DAI reserves
     * from the TRV contract and apply into DSR in order to generate base yield 
     * (the basis of the dUSD base in interest rate.)
     *
     * These idle DAI will only be drawn from a balance of tokens in the TRV itself.
     * 
     * This will be likely be called from a bot. It should only do this if there's a 
     * minimum threshold to pull and deposit given gas costs to deposit into DSR.
     */
    function borrowAndDeposit(uint256 amount) external override onlyElevatedAccess {
        // Borrow the DAI. This will also mint `dUSD` debt.
        treasuryReservesVault.borrow(amount, address(this));
        _dsrDeposit(amount);
    }

    /**
     * @notice Periodically, the Base Strategy will pull all DAI reserves
     * from the TRV contract and apply into DSR in order to generate base yield 
     * (the basis of the dUSD base in interest rate.)
     *
     * These idle DAI will only be drawn from a balance of tokens in the TRV itself.
     * 
     * This will be likely be called from a bot. It should only do this if there's a 
     * minimum threshold to pull and deposit given gas costs to deposit into DSR.
     */
    function borrowAndDepositMax() external override onlyElevatedAccess returns (uint256 borrowedAmount) {
        // Borrow the DAI. This will also mint `dUSD` debt.
        borrowedAmount = treasuryReservesVault.borrowMax(address(this));
        _dsrDeposit(borrowedAmount);
    }

    function _dsrDeposit(uint256 amount) internal {
        // Ensure the latest DSR checkpoint has occurred so we join with the
        // correct shares. Use `_rdiv()` on deposits.
        uint256 shares = _rdiv(amount, _checkpointChi());

        emit DaiDeposited(amount);
        daiJoin.join(address(this), amount);
        pot.join(shares);
    }

    /**
     * @notice Withdraw DAI from DSR and pay back to Treasury Reserves Vault
     */
    function withdrawAndRepay(uint256 withdrawalAmount) external onlyElevatedAccess {
        if (withdrawalAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();       

        (uint256 daiAvailable, uint256 chi, ) = _checkpointDaiBalance();
        if (withdrawalAmount > daiAvailable) revert CommonEventsAndErrors.InsufficientBalance(address(stableToken), withdrawalAmount, daiAvailable);
        
        //  Use `_rdivup()` on withdrawals.
        uint256 sharesAmount = _rdivup(withdrawalAmount, chi);
        _dsrWithdrawal(sharesAmount, withdrawalAmount);
        treasuryReservesVault.repay(withdrawalAmount);
    }

    /**
     * @notice Withdraw all possible DAI from the DSR, and send to the Treasury Reserves Vault
     */
    function withdrawAndRepayAll() external onlyElevatedAccess returns (uint256) {
        (uint256 daiAvailable,, uint256 sharesAvailable) = _checkpointDaiBalance();
        _dsrWithdrawal(sharesAvailable, daiAvailable);

        treasuryReservesVault.repay(daiAvailable);
        return daiAvailable;
    }

    /**
     * @notice The TRV is able to withdraw on demand in order to fund other strategies which 
     * wish to borrow from the TRV.
     * @dev It may withdraw less than requested if there isn't enough balance in the DSR.
     */
    function trvWithdraw(uint256 requestedAmount) external override returns (uint256) {
        if (msg.sender != address(treasuryReservesVault)) revert OnlyTreasuryReserveVault(msg.sender);
        if (requestedAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();       

        // Checkpoint DSR and calculate how many DSR shares the request equates to.
        //  Use `_rdivup()` on withdrawals.
        (uint256 daiAvailable, uint256 chi, uint256 sharesAvailable) = _checkpointDaiBalance();
        uint256 sharesAmount = _rdivup(requestedAmount, chi);

        // Cap at the max balance in DSR
        if (sharesAmount > sharesAvailable) {
            requestedAmount = daiAvailable;
            sharesAmount = sharesAvailable;
        }

        _dsrWithdrawal(sharesAmount, requestedAmount);
        stableToken.safeTransfer(address(treasuryReservesVault), requestedAmount);
        return requestedAmount;
    }

    function _dsrWithdrawal(uint256 sharesAmount, uint256 daiAmount) internal {
        pot.exit(sharesAmount);
        daiJoin.exit(address(this), daiAmount);
        emit DaiWithdrawn(daiAmount);
    }
    
    /**
     * @notice Shutdown this strategy, only after it has first been
     * marked the in the Treasury Reserve Vault as `isShuttingDown` in the TRV.
     *
     * @dev This first withdraws all DAI from the DSR and sends all funds to the TRV, and then 
     * applies the shutdown in the TRV.
     */
    function automatedShutdown() external override onlyElevatedAccess returns (uint256) {
        // Withdraw all from DSR and send everything back to the Treasury Reserves Vault.
        (uint256 daiAvailable,, uint256 sharesAvailable) = _checkpointDaiBalance();
        _dsrWithdrawal(sharesAvailable, daiAvailable);

        emit Shutdown(daiAvailable);
        
        // Transfer the stables to TRV
        stableToken.safeTransfer(address(treasuryReservesVault), daiAvailable);

        // Now mark as shutdown in the TRV.
        // This will only succeed if governance has first set the strategy to `isShuttingDown`
        treasuryReservesVault.shutdown(address(this), daiAvailable);
        return daiAvailable;
    }

}