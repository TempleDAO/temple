pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/DSRStrategy.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// solhint-disable-next-line no-unused-import
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IMakerDaoDaiJoinLike } from "contracts/interfaces/external/makerDao/IMakerDaoDaiJoinLike.sol";
import { IMakerDaoPotLike } from "contracts/interfaces/external/makerDao/IMakerDaoPotLike.sol";
import { IMakerDaoVatLike } from "contracts/interfaces/external/makerDao/IMakerDaoVatLike.sol";
import { ITempleBaseStrategy } from "contracts/interfaces/v2/strategies/ITempleBaseStrategy.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/**
 * @title Dai Savings Rate (DSR) - Base Strategy
 * @notice Deposit idle DAI from the Treasury Reserve Vaults into the Maker DSR (DAI Savings Rate module)
 */
contract DsrBaseStrategy is AbstractStrategy, ITempleBaseStrategy {
    using SafeERC20 for IERC20;

    string private constant VERSION = "1.0.0";

    IERC20 public immutable daiToken;

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
        address _daiToken,
        address _daiJoin, 
        address _pot
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        daiJoin = IMakerDaoDaiJoinLike(_daiJoin);
        IMakerDaoVatLike vat = IMakerDaoVatLike(daiJoin.vat());
        pot = IMakerDaoPotLike(_pot);
        vat.hope(address(daiJoin));
        vat.hope(address(pot));
        daiToken = IERC20(_daiToken);
        daiToken.forceApprove(address(daiJoin), type(uint256).max);
        _updateTrvApprovals(address(0), _treasuryReservesVault);
    }

    /**
     * @notice A hook where strategies can optionally update approvals when the trv is updated
     */
    function _updateTrvApprovals(address oldTrv, address newTrv) internal override {
        _setMaxAllowance(daiToken, oldTrv, newTrv);
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
     *      And Pot: 0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7
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
    
    function _rpow(uint256 x, uint256 n) internal pure returns (uint256 z) {
        // slither-disable-start weak-prng,divide-before-multiply,incorrect-equality,assembly,timestamp
        // solhint-disable-next-line no-inline-assembly
        assembly {
            switch x case 0 {switch n case 0 {z := RAY} default {z := 0}}
            default {
                switch mod(n, 2) case 0 { z := RAY } default { z := x }
                let half := div(RAY, 2)  // for rounding.
                for { n := div(n, 2) } n { n := div(n,2) } {
                    let xx := mul(x, x)
                    if iszero(eq(div(xx, x), x)) { revert(0,0) }
                    let xxRound := add(xx, half)
                    if lt(xxRound, xx) { revert(0,0) }
                    x := div(xxRound, RAY)
                    if mod(n,2) {
                        let zx := mul(z, x)
                        if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) { revert(0,0) }
                        let zxRound := add(zx, half)
                        if lt(zxRound, zx) { revert(0,0) }
                        z := div(zxRound, RAY)
                    }
                }
            }
        }
        // slither-disable-end weak-prng,divide-before-multiply,incorrect-equality,assembly,timestamp
    }

    /**
     * @notice The latest balance available in DSR. 
     * This may be stale if the DSR rate hasn't been updated for a while.
     */
    function latestDsrBalance() public view returns (uint256) {
        // pot.chi() == DAI/share (accurate to the last checkpoint)
        // pot.pie() == number of dsr shares this strategy holds.
        // pot.rho() == Timestamp of last checkpoint

        uint256 rho = pot.rho();
        // solhint-disable-next-line not-rely-on-time
        uint256 chi = (block.timestamp > rho) ? _rpow(pot.dsr(), block.timestamp - rho) * pot.chi() / RAY : pot.chi();
        return _rmul(chi, pot.pie(address(this)));
    }

    function _checkpointChi() internal returns (uint256 chi) {
        // solhint-disable-next-line not-rely-on-time
        chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
    }

    function _checkpointDaiBalance() internal returns (uint256 dai, uint256 chi, uint256 shares) {
        chi = _checkpointChi();
        shares = pot.pie(address(this));
        dai = _rmul(chi, shares);
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
            balance: latestDsrBalance()
        });
    }

    /**
     * @notice Calculate the latest assets and liabilities and checkpoint
     * For DAI's Savings Rate contract, we need to call a writable function to get the latest total.
     */
    function checkpointAssetBalances() external override returns (
        AssetBalance[] memory assetBalances
    ) {
        (uint256 daiBalance,,) = _checkpointDaiBalance();
        assetBalances = new AssetBalance[](1);
        assetBalances[0] = AssetBalance({
            asset: address(daiToken), 
            balance: daiBalance
        });
        emit AssetBalancesCheckpoint(assetBalances);
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
        treasuryReservesVault.borrow(daiToken, amount, address(this));
        _dsrDeposit(amount);
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
        if (withdrawalAmount > daiAvailable) revert CommonEventsAndErrors.InsufficientBalance(address(daiToken), withdrawalAmount, daiAvailable);
        
        //  Use `_rdivup()` on withdrawals.
        uint256 sharesAmount = _rdivup(withdrawalAmount, chi);
        _dsrWithdrawal(sharesAmount, withdrawalAmount);

        // Repay to TRV ensuring that funds stop in the TRV, they don't get pushed 
        // back to the base strategy (ie back here)
        treasuryReservesVault.repay(daiToken, withdrawalAmount, address(this));
    }

    /**
     * @notice Withdraw all possible DAI from the DSR, and send to the Treasury Reserves Vault
     */
    function withdrawAndRepayAll() external onlyElevatedAccess returns (uint256) {
        (uint256 daiAvailable,, uint256 sharesAvailable) = _checkpointDaiBalance();
        _dsrWithdrawal(sharesAvailable, daiAvailable);

        // Repay to TRV ensuring that funds stop in the TRV, they don't get pushed 
        // back to the base strategy (ie back here)
        treasuryReservesVault.repay(daiToken, daiAvailable, address(this));
        return daiAvailable;
    }

    /**
     * @notice The TRV sends the tokens to deposit (and also mints equivalent dTokens)
     * The strategy is then expected to put those tokens to work.
     */
    function trvDeposit(uint256 amount) external override {
        if (msg.sender != address(treasuryReservesVault)) revert OnlyTreasuryReserveVault(msg.sender);
        if (amount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        _dsrDeposit(amount);
    }

    /**
     * @notice The TRV is able to withdraw on demand in order to fund other strategies which 
     * wish to borrow from the TRV.
     * @dev It may withdraw less than requested if there isn't enough balance in the DSR.
     */
    function trvWithdraw(uint256 requestedAmount) external override returns (uint256) {
        address _trvAddr = address(treasuryReservesVault);
        if (msg.sender != _trvAddr) revert OnlyTreasuryReserveVault(msg.sender);
        if (requestedAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();       

        // Checkpoint DSR and calculate how many DSR shares the request equates to.
        //  Use `_rdivup()` on withdrawals.
        (uint256 daiAvailable, uint256 chi, uint256 sharesAvailable) = _checkpointDaiBalance();
        uint256 sharesAmount = _rdivup(requestedAmount, chi);

        // Cap at the max balance available in DSR
        if (sharesAmount > sharesAvailable) {
            requestedAmount = daiAvailable;
            sharesAmount = sharesAvailable;
        }

        _dsrWithdrawal(sharesAmount, requestedAmount);
        daiToken.safeTransfer(_trvAddr, requestedAmount);
        return requestedAmount;
    }

    function _dsrWithdrawal(uint256 sharesAmount, uint256 daiAmount) internal {
        pot.exit(sharesAmount);
        daiJoin.exit(address(this), daiAmount);
        emit DaiWithdrawn(daiAmount);
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
    function _doShutdown(bytes calldata /*data*/) internal override {
        // Withdraw all from DSR
        (uint256 daiAvailable,, uint256 sharesAvailable) = _checkpointDaiBalance();
        _dsrWithdrawal(sharesAvailable, daiAvailable);

        // Repay to TRV ensuring that funds stop in the TRV, they don't get pushed 
        // back to the base strategy (ie back here)
        if (daiAvailable > 0) {
            treasuryReservesVault.repay(daiToken, daiAvailable, address(this));
        }
    }

}