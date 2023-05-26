pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TlcLiquidationModule.sol)

// import { TlcReserveLogic } from "contracts/v2/templeLineOfCredit/TlcReserveLogic.sol";
// import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
// import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TlcStorage } from "contracts/v2/templeLineOfCredit/TlcStorage.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";
import { ITlcLiquidationModule } from "contracts/interfaces/v2/templeLineOfCredit/ITlcLiquidationModule.sol";
import { TlcBaseLogic } from "contracts/v2/templeLineOfCredit/TlcBaseLogic.sol";

contract TlcLiquidationModule is ITlcLiquidationModule, TlcStorage { 
    using TlcBaseLogic for ReserveCache;
    using TlcBaseLogic for ReserveToken;

    ITreasuryReservesVault public immutable treasuryReservesVault;

    constructor(
        address _templeToken,
        address _treasuryReservesVault
    ) TlcStorage(_templeToken)
    {
        treasuryReservesVault = ITreasuryReservesVault(_treasuryReservesVault);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                       LIQUIDATIONS                         */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/


    function batchLiquidate(address[] memory accounts) external {
        ITreasuryReservesVault _trv = treasuryReservesVault;
        LiquidityStatus memory _status;
        uint256 _daiIndex = uint256(TokenType.DAI);
        uint256 _oudIndex = uint256(TokenType.OUD);

        uint256 _numAccounts = accounts.length;
        uint256 totalCollateralClaimed;
        ReserveCache[NUM_TOKEN_TYPES] memory reserveCaches = [
            reserveTokens[TokenType.DAI].cache(),
            reserveTokens[TokenType.OUD].cache()
        ];

        uint256[NUM_TOKEN_TYPES] memory totalDebtWiped;
        uint256 i;
        address _account;
        for (; i < _numAccounts; ++i) {
            _account = accounts[i];
            _status = computeLiquidity(allUserData[_account], reserveCaches, false);

            // Skip if this account is still under the maxLTV across all assets
            if (_status.hasExceededMaxLtv) {
                totalCollateralClaimed += _status.collateral;
                totalDebtWiped[_daiIndex] += _status.debt[_daiIndex];
                totalDebtWiped[_oudIndex] += _status.debt[_oudIndex];
                delete allUserData[_account];    
            }
        }

        // burn the temple collateral by repaying to TRV. This will burn the equivalent dUSD debt too.
        _trv.repayTemple(totalCollateralClaimed, address(this));

        // Update the reserve token total state and update interest rates.
        for (i = 0; i < NUM_TOKEN_TYPES; ++i) {
            ReserveToken storage _reserveToken = reserveTokens[TokenType(i)];
            // LiquidationTokenParams memory _tokenParams = _liquidationParams.tokens[i];
            ReserveCache memory _reserveCache = reserveCaches[i];

            // Update the reserve token details, and then update the interest rates.            
            // A decrease in amount, so this downcast is safe without a check
            _reserveToken.totals.totalDebt = _reserveCache.totalDebt = uint128(
                _reserveCache.totalDebt - totalDebtWiped[i]
            );

            _reserveToken.updateInterestRates(_reserveCache, treasuryReservesVault);
        }
    }

    function computeLiquidityForToken(
        ReserveCache memory _reserveCache,
        UserTokenDebt storage _userTokenDebt,
        bool _includePendingRequests,
        LiquidityStatus memory status
    ) private view {
        if (_userTokenDebt.debt == 0) return;
        uint256 totalDebt = _reserveCache.currentUserTokenDebt(_userTokenDebt.debt, _userTokenDebt.interestAccumulator);
        if (_includePendingRequests) {
            totalDebt += _userTokenDebt.borrowRequest.amount; 
        }

        if (!status.hasExceededMaxLtv) {
            status.hasExceededMaxLtv = totalDebt > _reserveCache.maxBorrowCapacity(status.collateral, treasuryReservesVault);
        }
    }

    function computeLiquidity(
        UserData storage _userData,
        ReserveCache[NUM_TOKEN_TYPES] memory _reserveCaches,
        bool _includePendingRequests
    ) private view returns (LiquidityStatus memory status) {
        status.collateral = _userData.collateralPosted;
        if (_includePendingRequests) {
            status.collateral -= _userData.removeCollateralRequest.amount;
        }

        computeLiquidityForToken(_reserveCaches[uint256(TokenType.DAI)], _userData.debtData[uint256(TokenType.DAI)], _includePendingRequests, status);
        computeLiquidityForToken(_reserveCaches[uint256(TokenType.OUD)], _userData.debtData[uint256(TokenType.OUD)], _includePendingRequests, status);
    }

    // @todo think about how best to get the list of all users
    // so the bot can iterate on them.
    // Just relying on subgraph could be risky if it's down?
    // Paginated list of accounts?
    function computeLiquidity(
        address account, 
        bool includePendingRequests
    ) external view returns (LiquidityStatus memory status) {
        ReserveCache[NUM_TOKEN_TYPES] memory reserveCaches = [
            reserveTokens[TokenType.DAI].cacheRO(),
            reserveTokens[TokenType.OUD].cacheRO()
        ];
        status = computeLiquidity(allUserData[account], reserveCaches, includePendingRequests);
    }

    function checkLiquidity(
        address account, 
        bool includePendingRequests
    ) external view {
        ReserveCache[NUM_TOKEN_TYPES] memory reserveCaches = [
            reserveTokens[TokenType.DAI].cacheRO(),
            reserveTokens[TokenType.OUD].cacheRO()
        ];
        LiquidityStatus memory _status = computeLiquidity(allUserData[account], reserveCaches, includePendingRequests);
        if (_status.hasExceededMaxLtv) revert ExceededMaxLtv();
    }

    // function checkLiquidity(UserData storage _userData) internal view {
    //     ReserveCache[NUM_TOKEN_TYPES] memory reserveCaches = [
    //         reserveTokens[TokenType.DAI].cacheRO(),
    //         reserveTokens[TokenType.OUD].cacheRO()
    //     ];
    //     LiquidityStatus memory _status = computeLiquidity(_userData, reserveCaches, true);
    //     if (_status.hasExceededMaxLtv) revert ExceededMaxLtv();
    // }

}
