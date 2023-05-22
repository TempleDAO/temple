pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TempleLineOfCredit.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

import { ITempleLineOfCredit } from "contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { IMintableToken } from "contracts/interfaces/common/IMintableToken.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TlcReserveLogic } from "contracts/v2/templeLineOfCredit/TlcReserveLogic.sol";
import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";

// import "forge-std/console.sol";

// @todo need to pause/unpause borrows/repays
// @todo add liquidations

contract TempleLineOfCredit is ITempleLineOfCredit, AbstractStrategy {
    using SafeERC20 for IERC20;
    using TlcReserveLogic for ReserveCache;
    using SafeCast for uint256;

    string public constant VERSION = "1.0.0";

    /**
     * @notice Collateral Token supplied by users
     */
    IERC20 public immutable templeToken;

    /**
     * @notice User collateral and current token debt information
     */
    mapping(address => UserData) userData;

    /**
     * @notice Configuration and current data for borrowed tokens
     */
    mapping(IERC20 => ReserveToken) private reserveTokens;

    // @todo change oud to be updatable since it will be deployed later.
    IMintableToken public immutable oudToken;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _templeToken,
        ReserveTokenConfig memory _stableTokenConfig,
        address _oudAddress,
        ReserveTokenConfig memory _oudTokenConfig
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        templeToken = IERC20(_templeToken);
        oudToken = IMintableToken(_oudAddress);

        // @todo safe cast the configs to check they're ok.
        ReserveToken storage rt = reserveTokens[stableToken];
        rt.config = _stableTokenConfig;
        rt.totals.interestAccumulator = 1e18;
        rt.totals.interestAccumulatorUpdatedAt = uint32(block.timestamp);

        rt = reserveTokens[IERC20(_oudAddress)];
        rt.config = _oudTokenConfig;
        rt.totals.interestAccumulator = 1e18;
        rt.totals.interestAccumulatorUpdatedAt = uint32(block.timestamp);
    }

    /**
     * The version of this particular strategy
     */
    function strategyVersion() external override pure returns (string memory) {
        return VERSION;
    }

    function getReserveToken(address token) external view returns (ReserveToken memory) {
        return _getReserveToken(IERC20(token));
    }

    function getUserData(address account) external view returns (
        uint256 collateralPosted, 
        UserTokenDebt memory daiDebt, 
        UserTokenDebt memory oudDebt
    ) {
        UserData storage _userData = userData[account];
        collateralPosted = _userData.collateralPosted;
        daiDebt = _userData.debtData[stableToken];
        oudDebt = _userData.debtData[oudToken];
    }

    /**
     * @notice Get user max borrow capacity 
     * @param token token to get max borrow capacity for 
     * @param account address of user 
     */
    function maxBorrowCapacity(address token, address account) external view returns(uint256) {
        ReserveToken storage reserveToken = _getReserveToken(IERC20(token));
        ReserveCache memory reserveCache = TlcReserveLogic.cacheRO(reserveToken, treasuryReservesVault);

        return maxBorrowCapacityInternal(
            userData[account].collateralPosted,
            reserveCache
        );
    }

    /**
     * @notice Update the total debt up until now, then recalculate the interest rate
     * based on the updated utilisation ratio
     * @param token address of the debt token
     */
    function refreshInterestRates(address token) external {
        ReserveToken storage reserveToken = _getReserveToken(IERC20(token));

        // Update the cache (which updates the accumulators and total debt)
        ReserveCache memory reserveCache = TlcReserveLogic.cache(reserveToken, treasuryReservesVault);

        // Now update the interest rates, based on the updated Utilization Ratio
        reserveCache.updateInterestRates(reserveToken, address(token));
    }

    function setReserveTokenConfig(address token, ReserveTokenConfig memory config) external onlyElevatedAccess {
        ReserveToken storage reserveToken = _getReserveToken(IERC20(token));
        ReserveCache memory reserveCache = TlcReserveLogic.cache(reserveToken, treasuryReservesVault);

        reserveToken.config.tokenPriceType = config.tokenPriceType;
        reserveToken.config.interestRateModelType = reserveCache.interestRateModelType = config.interestRateModelType;
        reserveToken.config.interestRateModel = reserveCache.interestRateModel = config.interestRateModel;
        reserveToken.config.maxLtvRatio = reserveCache.maxLtvRatio = config.maxLtvRatio;

        reserveCache.updateInterestRates(reserveToken, address(token)); //, 0, 0);
    }

    function setMaxLtvRatio(address token, uint256 maxLtvRatio) external onlyElevatedAccess {
        ReserveToken storage reserveToken = _getReserveToken(IERC20(token));
        reserveToken.config.maxLtvRatio = maxLtvRatio.encodeUInt216();
    }

    function totalDebtInfo() external view returns (
        uint256 stableUtilizationRatio, // based off the last debt checkpoint
        int256 stableBorrowRate,  // based off the last debt checkpoint
        uint256 stableTotalDebt, // the last debt checkpoint compounded to now
        int256 oudBorrowRate, // based off the last debt checkpoint
        uint256 oudTotalDebt // the last debt checkpoint compounded to now
    ) {
        ITreasuryReservesVault trv = treasuryReservesVault;

        // Stable (eg DAI)
        ReserveCache memory reserveCache = TlcReserveLogic.cacheRO(reserveTokens[stableToken], trv);
        stableUtilizationRatio = reserveCache.utilizationRatio();
        stableBorrowRate = reserveCache.interestRate;
        stableTotalDebt = reserveCache.totalDebt;

        // OUD
        reserveCache = TlcReserveLogic.cacheRO(reserveTokens[oudToken], trv);
        // utilization ratio for OUD is always zero
        oudBorrowRate = reserveCache.interestRate;
        oudTotalDebt = reserveCache.totalDebt;
    }

    /**
     * @dev Get user total debt incurred (principal + interest)
     * @param account user address
     */
    function userTotalDebt(address account) public view returns (uint256 stableAmount, uint256 oudAmount) {
        ITreasuryReservesVault _trv = treasuryReservesVault;

        // Stable (eg DAI) Debt
        ReserveCache memory _reserveCache = TlcReserveLogic.cacheRO(reserveTokens[stableToken], _trv);
        UserTokenDebt storage _userTokenDebt = userData[account].debtData[stableToken];
        stableAmount = currentUserTokenDebt(
            _reserveCache,
            _userTokenDebt
        );

        // OUD Debt
        _reserveCache = TlcReserveLogic.cacheRO(reserveTokens[oudToken], _trv);
        _userTokenDebt = userData[account].debtData[oudToken];
        oudAmount = currentUserTokenDebt(
            _reserveCache,
            _userTokenDebt
        );
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
        AssetBalance[] memory assetBalances, 
        uint256 debt
    ) {
        // The only asset which TLC has is the Temple collateral given by users.
        // In the case of a user liquidation, that user Temple is burned, and
        // the equivalent dUSD debt is also reduced by `Temple x TPI`
        assetBalances = new AssetBalance[](1);
        assetBalances[0] = AssetBalance({
            asset: address(templeToken),
            balance: addManualAssetBalanceDelta(
                templeToken.balanceOf(address(this)), 
                address(templeToken)
            )
        });

        debt = currentDebt();
    }

    /**
     * @dev Allows borrower to deposit temple collateral
     * @param collateralAmount is the amount to deposit
     */
    function postCollateral(uint256 collateralAmount, address onBehalfOf) external {
        if (collateralAmount == 0) revert CommonEventsAndErrors.InvalidAmount(address(templeToken), collateralAmount);
        emit PostCollateral(msg.sender, onBehalfOf, collateralAmount);

        userData[onBehalfOf].collateralPosted += collateralAmount;

        templeToken.safeTransferFrom(
            msg.sender,
            address(this),
            collateralAmount 
        );
    }

    /**
     * @dev Allows user to borrow debt tokens
     * @param stableBorrowAmount amount of stable (eg DAI) to borrow
     * @param oudBorrowAmount amount of OUD to borrow
     */
    function borrow(uint256 stableBorrowAmount, uint256 oudBorrowAmount, address recipient) external {
        UserData storage _userData = userData[msg.sender];
        uint256 _collateralPosted = _userData.collateralPosted;
        ITreasuryReservesVault _trv = treasuryReservesVault;

        if (stableBorrowAmount != 0 ) {
            _doBorrowToken({
                _token: stableToken,
                _borrowAmount: stableBorrowAmount,
                _userTokenDebt: _userData.debtData[stableToken], 
                _collateralPosted: _collateralPosted, 
                _trv: _trv
            });
            
            emit Borrow(msg.sender, recipient, address(stableToken), stableBorrowAmount);

            // Borrow the funds from the TRV and send to the recipient
            treasuryReservesVault.borrow(stableBorrowAmount, recipient);
        }
        
        if (oudBorrowAmount != 0) {
            _doBorrowToken({
                _token: oudToken,
                _borrowAmount: oudBorrowAmount,
                _userTokenDebt: _userData.debtData[oudToken],
                _collateralPosted: _collateralPosted,
                _trv: _trv
            });

            emit Borrow(msg.sender, recipient, address(oudToken), oudBorrowAmount);

            // Mint the OUD and send to recipient
            oudToken.mint(
               recipient,
               oudBorrowAmount
            );
        }
    }

    /**
     * @notice Allows borrower to repay borrowed amount
     * @param repayStableAmount amount of stable (eg DAI) to repay
     * @param repayOudAmount amount of oud to repay
     */
    function repay(uint256 repayStableAmount, uint256 repayOudAmount, address onBehalfOf) public {
        UserData storage _userData = userData[onBehalfOf];
        ITreasuryReservesVault _trv = treasuryReservesVault;

        ReserveToken storage _reserveToken;
        ReserveCache memory _reserveCache;
        UserTokenDebt storage _userTokenDebt;

        if (repayStableAmount != 0 ) {
            _reserveToken = reserveTokens[stableToken];
            _reserveCache = TlcReserveLogic.cache(_reserveToken, _trv);
            _userTokenDebt = _userData.debtData[stableToken];
            _repayStable(_reserveToken, _reserveCache, _userTokenDebt, msg.sender, onBehalfOf, repayStableAmount);
        }

        if (repayOudAmount != 0) {
            _reserveToken = reserveTokens[oudToken];
            _reserveCache = TlcReserveLogic.cache(_reserveToken, _trv);
            _userTokenDebt = _userData.debtData[oudToken];
            _repayOud(_reserveToken, _reserveCache, _userTokenDebt, msg.sender, onBehalfOf, repayOudAmount);
        }
    }

    /**
     * @notice Allows borrower to repay all outstanding balances
     * @dev leave no dust balance
     */
    function repayAll(address onBehalfOf) external {
        UserData storage _userData = userData[onBehalfOf];
        ITreasuryReservesVault _trv = treasuryReservesVault;
        
        // Get the outstanding debt for Stable
        ReserveToken storage _reserveToken = reserveTokens[stableToken];
        ReserveCache memory _reserveCache = TlcReserveLogic.cache(_reserveToken, _trv);
        UserTokenDebt storage _userTokenDebt = _userData.debtData[stableToken];
        uint256 repayAmount = currentUserTokenDebt(_reserveCache, _userTokenDebt);

        if (repayAmount != 0) {
            _repayStable(_reserveToken, _reserveCache, _userTokenDebt, msg.sender, onBehalfOf, repayAmount);
        }

        // Get the outstanding debt for Oud
        _reserveToken = reserveTokens[oudToken];
        _reserveCache = TlcReserveLogic.cache(_reserveToken, _trv);
        _userTokenDebt = _userData.debtData[oudToken];
        repayAmount = currentUserTokenDebt(_reserveCache, _userTokenDebt);

        if (repayAmount != 0) {
            _repayOud(_reserveToken, _reserveCache, _userTokenDebt, msg.sender, onBehalfOf, repayAmount);
        }
    }

    function _doBorrowToken(
        IERC20 _token,
        uint256 _borrowAmount,
        UserTokenDebt storage _userTokenDebt,
        uint256 _collateralPosted,
        ITreasuryReservesVault _trv
    ) internal {
        ReserveToken storage _reserveToken = reserveTokens[_token];
        ReserveCache memory _reserveCache = TlcReserveLogic.cache(_reserveToken, _trv);

        uint256 _newDebt = updateUserTokenAccumulator(_userTokenDebt, _reserveCache);

        uint256 _borrowCapacity = maxBorrowCapacityInternal(_collateralPosted, _reserveCache) - _newDebt;
        if (_borrowAmount > _borrowCapacity) revert InsufficentCollateral(_borrowCapacity, _borrowAmount);

        _newDebt += _borrowAmount;
        _userTokenDebt.debt = _newDebt.encodeUInt128();
        _reserveToken.totals.totalDebt = _reserveCache.totalDebt = (
            _reserveCache.totalDebt + _borrowAmount
        ).encodeUInt128();

        _reserveCache.updateInterestRates(_reserveToken, address(_token));
    }

    function currentUserTokenDebt(
        ReserveCache memory _reserveCache,
        UserTokenDebt storage _userTokenDebt
    ) internal view returns (uint256) {
        uint256 prevDebt = _userTokenDebt.debt;
        return (prevDebt == 0) 
            ? 0
            : prevDebt * _reserveCache.interestAccumulator / _userTokenDebt.interestAccumulator;
    }

    function updateUserTokenAccumulator(
        UserTokenDebt storage _userTokenDebt,
        ReserveCache memory _reserveCache
    ) internal returns (uint256 newDebt) {
        newDebt = currentUserTokenDebt(_reserveCache, _userTokenDebt);
        _userTokenDebt.interestAccumulator = _reserveCache.interestAccumulator;
    }
    function _repayStable(
        ReserveToken storage _reserveToken,
        ReserveCache memory _reserveCache,
        UserTokenDebt storage _userTokenDebt,
        address _fundedBy, 
        address _onBehalfOf,
        uint256 _repayAmount
    ) internal {
        _doRepayToken(stableToken, _repayAmount, _reserveToken, _reserveCache, _userTokenDebt);

        emit Repay(_fundedBy, _onBehalfOf, address(stableToken), _repayAmount);

        // Pull the stables, and repay the TRV debt
        stableToken.safeTransferFrom(_fundedBy, address(this), _repayAmount);
        treasuryReservesVault.repay(_repayAmount, address(this));
    }

    function _repayOud(
        ReserveToken storage _reserveToken,
        ReserveCache memory _reserveCache,
        UserTokenDebt storage _userTokenDebt,
        address _fundedBy, 
        address _onBehalfOf,
        uint256 _repayAmount
    ) internal {
        _doRepayToken(oudToken, _repayAmount, _reserveToken, _reserveCache, _userTokenDebt);

        emit Repay(_fundedBy, _onBehalfOf, address(oudToken), _repayAmount);

        // Burn the OUD
        oudToken.burn(_fundedBy, _repayAmount);
    }
    
    function _doRepayToken(
        IERC20 _token,
        uint256 _repayAmount,
        ReserveToken storage _reserveToken,
        ReserveCache memory _reserveCache,
        UserTokenDebt storage _userTokenDebt
    ) internal {
        uint256 _newDebt = updateUserTokenAccumulator(_userTokenDebt, _reserveCache);
        if (_repayAmount > _newDebt) revert ExceededBorrowedAmount(_newDebt, _repayAmount);

        _newDebt -= _repayAmount;
        _userTokenDebt.debt = _newDebt.encodeUInt128();
        _reserveToken.totals.totalDebt = _reserveCache.totalDebt = (
            _reserveCache.totalDebt - _repayAmount
        ).encodeUInt128();

        _reserveCache.updateInterestRates(_reserveToken, address(_token));
    }

    function _getReserveToken(IERC20 token) internal view returns (
        ReserveToken storage reserveToken
    ) {
        reserveToken = reserveTokens[token];
        if (address(reserveToken.config.interestRateModel) == address(0)) {
            revert CommonEventsAndErrors.InvalidToken(address(token));
        }
    }

    function maxBorrowCapacityInternal(
        uint256 collateralPosted,
        ReserveCache memory reserveCache
    ) internal pure returns (uint256) {
        return mulDiv(
            collateralPosted * reserveCache.price,
            reserveCache.maxLtvRatio,
            1e8
        );
    }
    
    /**
     * @notice An automated shutdown is not possible for TLC. All users will first have to exit positions:
     *   - Pause new borrows
     *   - Comms for users to exit
     *   - Increase the borrow rate | reduce maxLTV such that users are slowly liquidated
     *
     * Once done and all debt is repaid, they can give the all clear for governance to then shutdown the strategy
     * by calling TRV.shutdown(strategy, stables recovered)
     */
    function automatedShutdown() external virtual override returns (uint256) {
        revert Unimplemented();
    }
}