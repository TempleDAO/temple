pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";

contract MockStrategy is AbstractStrategy {
    using SafeERC20 for IERC20;

    string private constant VERSION = "X.0.0";

    // solhint-disable-next-line
    string public API_VERSION_X;

    address[] public assets;

    IERC20 public immutable dai;

    IERC20 public immutable weth;

    IERC20 public immutable temple;

    bool public debtCeilingUpdatedCalled;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _dai,
        address _weth,
        address _temple,
        address[] memory _assets 
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        dai = IERC20(_dai);
        weth = IERC20(_weth);
        temple = IERC20(_temple);
        assets = _assets;
        API_VERSION_X = "1.0.0";
        _updateTrvApprovals(address(0), _treasuryReservesVault);
    }

    function strategyVersion() external pure returns (string memory) {
        return VERSION;
    }

    function superApiVersion() public view returns (string memory) {
        return super.apiVersion();
    }

    function apiVersion() public view override returns (string memory) {
        return API_VERSION_X;
    }

    function setApiVersion(string memory v) external {
        API_VERSION_X = v;
    }

    function borrow(IERC20 token, uint256 amount) external {
        treasuryReservesVault.borrow(token, amount, address(this));
    }

    /**
     * @notice A hook where strategies can optionally update approvals when the trv is updated
     */
    function _updateTrvApprovals(address oldTrv, address newTrv) internal override {
        _setMaxAllowance(dai, oldTrv, newTrv);
        _setMaxAllowance(weth, oldTrv, newTrv);
        _setMaxAllowance(temple, oldTrv, newTrv);
    }

    function repay(IERC20 token, uint256 amount) external {
        treasuryReservesVault.repay(token, amount, address(this));
    }

    function latestAssetBalances() public virtual override view returns (
        AssetBalance[] memory assetBalances
    ) {
        uint256 _length = assets.length;
        assetBalances = new AssetBalance[](_length);

        // Sum the balance on this contract + any manual adjustment
        address _asset;
        for (uint256 i; i < _length; ++i) {
            _asset = assets[i];
            assetBalances[i] = AssetBalance({
                asset: _asset,
                balance: FakeERC20(_asset).balanceOf(address(this))
            });
        }
    }

    function checkpointAssetBalances() external virtual override returns (
        AssetBalance[] memory assetBalances
    ) {
        // In reality, this would do something in the strategy to update the balances first.
        assetBalances = latestAssetBalances();
        emit AssetBalancesCheckpoint(assetBalances);
    }

    struct PopulateShutdownInputData {
        uint256 p1;
        uint256 p2;
        address pullTokenFrom;
    }

    struct ShutdownInputData {
        uint256 x;
        uint256 y;
        uint256 c;
        address pullTokenFrom;
    }

    function populateShutdownData(bytes memory data) external override pure returns (bytes memory) {
        PopulateShutdownInputData memory inputData = abi.decode(data, (PopulateShutdownInputData));
        return abi.encode(ShutdownInputData({
            x: inputData.p1,
            y: inputData.p2,
            c: 5,
            pullTokenFrom: inputData.pullTokenFrom
        }));
    }

    function _doShutdown(bytes calldata data) internal virtual override {
        ShutdownInputData memory inputData = abi.decode(data, (ShutdownInputData));
        uint256 amount = inputData.x * inputData.y + inputData.c;
        dai.safeTransferFrom(inputData.pullTokenFrom, address(this), amount);
        treasuryReservesVault.repay(dai, amount, address(this));
    }

    function _debtCeilingUpdated(IERC20 /*token*/, uint256 /*newDebtCeiling*/) internal override {
        debtCeilingUpdatedCalled = true;
    }

}
