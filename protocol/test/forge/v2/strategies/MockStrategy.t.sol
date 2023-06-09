pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AbstractStrategy } from "contracts/v2/strategies/AbstractStrategy.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";

contract MockStrategy is AbstractStrategy {

    string public constant VERSION = "X.0.0";

    // solhint-disable-next-line
    string public API_VERSION_X;

    address[] public assets;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        string memory _strategyName,
        address _treasuryReservesVault,
        address[] memory _assets 
    ) AbstractStrategy(_initialRescuer, _initialExecutor, _strategyName, _treasuryReservesVault) {
        assets = _assets;
        API_VERSION_X = "1.0.0";
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
    }

    struct ShutdownInputData {
        uint256 x;
        uint256 y;
        uint256 c;
    }

    function populateShutdownData(bytes memory data) external override view returns (bytes memory) {
        PopulateShutdownInputData memory inputData = abi.decode(data, (PopulateShutdownInputData));
        return abi.encode(ShutdownInputData({
            x: inputData.p1,
            y: inputData.p2,
            c: 5
        }));
    }

    function doShutdown(bytes memory data) internal virtual override view returns (uint256) {
        ShutdownInputData memory inputData = abi.decode(data, (ShutdownInputData));
        return inputData.x * inputData.y + inputData.c;
    }
}
