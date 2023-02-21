pragma solidity 0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/reserves/ITreasuryReservesDepositor.sol)

interface ITreasuryReservesDepositor {
    event Deposited(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount, address indexed receiver);

    /// @notice The deposit token for this TreasuryReserveDepositor
    function depositToken() external view returns (address);

    /**
      * @notice Get the approximate balance of depositToken held by this contract
      * @dev May not be accurate if the underlying protocol needs to checkpoint first
      */
    function approxBalance() external returns (uint256);

    /**
      * @notice Get the exact balance of depositToken held by this contract up to and including now.
      * @dev This is not a view as it may need to update the underlying protocol checkpoint
      */
    function exactBalance() external returns (uint256);

    /**
      * @notice Apply any balance of DAI into DSR.
      * @dev DAI should be transferred to this contract first.
      */
    function applyDeposits() external returns (uint256);

    /**
      * @notice Withdraw an amount of DAI from the DSR, and send to reeiver
      */
    function withdraw(uint256 amount, address receiver) external returns (uint256);

    /**
      * @notice Withdraw all possible DAI from the DSR, and send to reeiver
      */
    function withdrawAll(address receiver) external returns (uint256);

}