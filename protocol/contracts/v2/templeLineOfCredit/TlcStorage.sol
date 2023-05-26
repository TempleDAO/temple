pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TlcStorage.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";

contract TlcStorage is ITlcDataTypes {

    constructor(
        address _templeToken
    ) {
        templeToken = IERC20(_templeToken);
    }

    /**
     * @notice Collateral Token supplied by users
     */
    IERC20 public immutable templeToken;

    /**
     * @notice User collateral and current token debt information
     */
    mapping(address => UserData) internal allUserData;

    // mapping(address => mapping(FundsRequestType => WithdrawFundsRequest)) public fundsRequests;

    /**
     * @notice Configuration and current data for borrowed tokens
     */
    mapping(TokenType => ReserveToken) public reserveTokens;

    uint32 public withdrawCollateralCooldownSecs;

    // @todo add tests to check the sizes
    uint256 public constant NUM_TOKEN_TYPES = 2;
}