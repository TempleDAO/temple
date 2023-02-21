pragma solidity 0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (reserves/TreasuryReservesDaiDsrDepositor.sol)

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ITreasuryReservesDepositor} from "contracts/interfaces/reserves/ITreasuryReservesDepositor.sol";
import {IMakerDaoDaiJoinLike} from "contracts/interfaces/makerDao/IMakerDaoDaiJoinLike.sol";
import {IMakerDaoPotLike} from "contracts/interfaces/makerDao/IMakerDaoPotLike.sol";
import {IMakerDaoVatLike} from "contracts/interfaces/makerDao/IMakerDaoVatLike.sol";
import {Operators} from "contracts/admin/Operators.sol";

/// @title Deposit idle DAI into the Maker DSR (DAI Savings Rate module)
contract TreasuryReservesDaiDsrDepositor is ITreasuryReservesDepositor, Ownable, Operators {
    using SafeERC20 for IERC20;

    /// @notice The MakerDAO DAI deposit token
    IERC20 public immutable dai;

    /// @notice The MakerDAO contract used to enter/exit DSR
    IMakerDaoDaiJoinLike public immutable daiJoin;

    /// @notice The MakerDAO contract to query balances/rates of within DSR
    IMakerDaoPotLike public immutable pot;

    /// @notice MakerDAO const used in DSR share->DAI conversions
    uint256 public constant RAY = 10 ** 27;

    /// @notice Upon applying deposits, if the balance is less than
    /// this threshold, then it won't push into DSR.
    /// @dev This is because the DSR deposit is relatively expensive for gas.
    uint256 public depositThreshold;

    /// @notice Upon withdrawal, if a withdrawal from DSR is required,
    /// it will attempt to withdraw at least this amount into the contract, to save from
    /// withdrawing immediately again next time.
    /// @dev This is because the DSR withdrawal is relatively expensive for gas.
    uint256 public withdrawalThreshold;

    event TokenRecovered(address indexed to, address indexed token, uint256 amount);
    event ThresholdsSet(uint256 depositThreshold, uint256 withdrawalThreshold);
    error ExpectedNonZero();
    error NotEnoughShares(uint256 daiAmountRequested, uint256 sharesRequested, uint256 sharesAvailable);

    constructor(address _daiJoin, address _pot, uint256 _depositThreshold, uint256 _withdrawalThreshold) {
        daiJoin = IMakerDaoDaiJoinLike(_daiJoin);
        IMakerDaoVatLike vat = IMakerDaoVatLike(daiJoin.vat());
        dai = IERC20(daiJoin.dai());
        pot = IMakerDaoPotLike(_pot);
        vat.hope(address(daiJoin));
        vat.hope(address(pot));
        dai.safeApprove(address(daiJoin), type(uint256).max);

        depositThreshold = _depositThreshold;
        withdrawalThreshold = _withdrawalThreshold;
    }

    /// @notice Owner can set the threshold at which balances are actually added/removed into DSR.
    /// eg If DAI balanceOf(this) is below the `_depositThreshold`, applyDeposits() will be a no-op
    function setThresholds(uint256 _depositThreshold, uint256 _withdrawalThreshold) external onlyOwner {
        depositThreshold = _depositThreshold;
        withdrawalThreshold = _withdrawalThreshold;
        emit ThresholdsSet(_depositThreshold, _withdrawalThreshold);
    }

    /// @notice Owner can add new operators which are allowed to deposit/withdrawal
    function addOperator(address _address) external override onlyOwner {
        _addOperator(_address);
    }

    /// @notice Owner can remove new operators which are allowed to deposit/withdrawal
    function removeOperator(address _address) external override onlyOwner {
        _removeOperator(_address);
    }

    /// @notice The deposit token for this TreasuryReserveDepositor
    function depositToken() external override view returns (address) {
        return address(dai);
    }

    /// @notice Matching DAI maths.
    /// @dev See DsrManager: 0x373238337Bfe1146fb49989fc222523f83081dDb
    function rmul(uint256 x, uint256 y) internal pure returns (uint256 z) {
        // always rounds down
        z = x * y / RAY;
    }
    function rdiv(uint256 x, uint256 y) internal pure returns (uint256 z) {
        // always rounds down
        z = x * RAY / y;
    }
    function rdivup(uint256 x, uint256 y) internal pure returns (uint256 z) {
        // always rounds up
        z = ((x * RAY) + (y - 1)) / y;
    }

    /**
      * @notice Get the approximate balance of DAI held by this contract
      * @dev Only accurate up to the last time `pot.drip()` was called to update the 
      * latest accumulated amount in the DSR.
      */
    function approxBalance() external override view returns (uint256) {
        // pot.chi() == DAI/share (accurate to the last checkpoint)
        // pot.pie() == number of shares this contract holds.
        uint256 dsrAmount = rmul(pot.chi(), pot.pie(address(this)));
        return dai.balanceOf(address(this)) + dsrAmount;
    }

    /**
      * @notice Get the exact balance of DAI held by this contract up to and including now.
      * @dev This is not a view as it needs to update the DAI checkpoint first.
      */
    function exactBalance() external override returns (uint256) {
        uint256 chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
        uint256 dsrAmount = rmul(chi, pot.pie(address(this)));
        return dai.balanceOf(address(this)) + dsrAmount;
    }

    /**
      * @notice Apply any balance of DAI into DSR.
      * @dev DAI should be transferred to this contract first.
      */
    function applyDeposits() external override onlyOperators returns (uint256) {
        uint256 amount = dai.balanceOf(address(this));
        if (amount == 0) revert ExpectedNonZero();

        // Don't apply the deposit if there isn't enough balance yet in the account
        if (amount < depositThreshold) return amount;

        emit Deposited(address(dai), amount);

        // Ensure the latest checkpoint has occurred
        uint256 chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
        uint256 shares = rdiv(amount, chi);

        daiJoin.join(address(this), amount);
        pot.join(shares);

        return amount;
    }

    /**
      * @notice Withdraw an amount of DAI from the DSR, and send to receiver
      */
    function withdraw(uint256 amount, address receiver) external override onlyOperators returns (uint256) {
        if (amount == 0) revert ExpectedNonZero();

        // First use any balance which is still sitting in this contract (not yet in the DSR)
        uint256 balance = dai.balanceOf(address(this));
        uint256 transferAmount = balance > amount ? amount : balance;
        uint256 withdrawAmount = amount - transferAmount;

        // Pull any remainder required from DSR
        if (withdrawAmount != 0) {
            // Ensure the latest checkpoint has occurred
            uint256 chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
            uint256 dsrSharesAvailable = pot.pie(address(this));

            // Attempt to withdraw at least the threshold.
            uint256 daiToExit = withdrawAmount < withdrawalThreshold ? withdrawalThreshold : withdrawAmount;
            uint256 sharesToExit = rdivup(daiToExit, chi);
            
            // If not enough shares based on the threshold, then fallback to the requested amount only
            if (sharesToExit > dsrSharesAvailable) {
                daiToExit = withdrawAmount;
                sharesToExit = rdivup(daiToExit, chi);
            }

            // If still not enough shares, then error.
            if (sharesToExit > dsrSharesAvailable) revert NotEnoughShares(withdrawAmount, sharesToExit, dsrSharesAvailable);

            pot.exit(sharesToExit);
            daiJoin.exit(address(this), daiToExit);
        }
        
        emit Withdrawn(address(dai), amount, receiver);
        dai.safeTransfer(receiver, amount);
        return amount;
    }

    /**
      * @notice Withdraw all possible DAI from the DSR, and send to receiver
      */
    function withdrawAll(address receiver) external override onlyOperators returns (uint256) {
        uint256 amount = dai.balanceOf(address(this));

        // Send any balance of DAI sitting in the contract
        if (amount != 0) {
            dai.safeTransfer(receiver, amount);
        }

        // And also withdraw all from the DSR
        uint256 dsrShares = pot.pie(address(this));
        if (dsrShares != 0) {
            uint256 chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
            uint256 daiToReceive = dsrShares * chi / RAY;

            pot.exit(dsrShares);
            daiJoin.exit(receiver, daiToReceive);

            amount += daiToReceive;
        }

        if (amount == 0) revert ExpectedNonZero();
        emit Withdrawn(address(dai), amount, receiver);
        return amount;
    }

    /// @notice Owner can recover tokens
    /// @dev These are protocol owned funds.
    function recoverToken(address _token, address _to, uint256 _amount) external onlyOwner {
        emit TokenRecovered(_to, _token, _amount);
        IERC20(_token).safeTransfer(_to, _amount);
    }
}