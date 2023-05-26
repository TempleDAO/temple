pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TempleLineOfCredit.sol)

import { TlcBaseLogic } from "contracts/v2/templeLineOfCredit/TlcBaseLogic.sol";
// @todo change to interface
import { TempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { ITlcPositionHelper } from "contracts/interfaces/v2/templeLineOfCredit/ITlcPositionHelper.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";

// import "forge-std/console.sol";

contract TlcPositionHelper is ITlcPositionHelper {
    using TlcBaseLogic for ReserveCache;
    using TlcBaseLogic for ReserveToken;

    uint256 public constant NUM_TOKEN_TYPES = 2;

    TempleLineOfCredit public immutable tlc;

    constructor(address _tlc) {
        tlc = TempleLineOfCredit(_tlc);
    }

    function userPosition(address account) external view returns (UserPosition memory position) {
        UserData memory _userData = tlc.getUserData(account);
        position.collateralPosted = _userData.collateralPosted;

        ITreasuryReservesVault _trv = tlc.treasuryReservesVault();
        ReserveCache memory _reserveCache;
        UserTokenDebt memory _userTokenDebt;
        uint256 latestDebt;
        for (uint256 i; i < NUM_TOKEN_TYPES; ++i) {
            _reserveCache = tlc.getReserveCache(TokenType(i));
            _userTokenDebt = _userData.debtData[i];
            latestDebt = _reserveCache.currentUserTokenDebt(_userTokenDebt.debt, _userTokenDebt.interestAccumulator);
            position.debtPositions[i] = UserDebtPosition({
                debt: latestDebt,
                maxBorrow: _reserveCache.maxBorrowCapacity(position.collateralPosted, _trv),
                healthFactor: _reserveCache.healthFactor(position.collateralPosted, latestDebt, _trv),
                loanToValueRatio: _reserveCache.loanToValueRatio(position.collateralPosted, latestDebt, _trv)
            });
        }
    }

    function totalPosition() external view returns (TotalPosition[2] memory positions) {
        ITreasuryReservesVault _trv = tlc.treasuryReservesVault();
        ReserveCache memory _reserveCache;
        TotalPosition memory _position;
        for (uint256 i; i < NUM_TOKEN_TYPES; ++i) {
            _reserveCache = tlc.getReserveCache(TokenType(i));
            _position.utilizationRatio = _reserveCache.utilizationRatio(_trv);
            _position.borrowRate = _reserveCache.interestRate;
            _position.totalDebt = _reserveCache.totalDebt;
            positions[i] = _position;
        }
    }

}