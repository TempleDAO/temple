pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleGoldCommon.t.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";

import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

import { TempleTest } from "test/forge/unit/TempleTest.sol";

contract TempleGoldCommon is TempleTest {
    address internal treasury = makeAddr("treasury");

    address internal teamGnosis = makeAddr("teamGnosis");

    address internal mike = makeAddr("mike");

    address internal layerZeroEndpointArbitrumOne = 0x1a44076050125825900e736c501f859c50fE728c;

    address internal layerZeroEndpointEthereum = 0x1a44076050125825900e736c501f859c50fE728c;

    uint256 internal layerZeroEndpointArbitrumId = 30110;

    address internal usdcToken = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // arb USDC

    address internal daiToken = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1; //arb DAI

    string internal constant TEMPLE_GOLD_NAME = "TEMPLE GOLD";

    string internal constant TEMPLE_GOLD_SYMBOL = "TGLD";

    uint256 internal mintChainId = 1;

    uint256 internal arbitrumOneChainId = 42161;

    uint32 internal constant MAINNET_LZ_EID = 30101;

    uint32 internal constant ARBITRUM_ONE_LZ_EID = 30110;

    uint256 internal constant forkBlockNumber = 204226954;

    uint256 internal constant mainnetForkBlockNumber = 20053784;

    uint256 internal constant WEEK_LENGTH = 7 days;

    string internal constant NAME_ONE = "SPICE_AUCTION_TGLD_USDC";

    string internal constant NAME_TWO = "SPICE_AUCTION_TGLD_DAI";

    string internal constant VOTE_TOKEN_NAME = "Staked Temple Vote Token";
    
    string internal constant VOTE_TOKEN_SYMBOL = "stTemple";

    FakeERC20 internal fakeERC20;

    receive() external payable {}

    function _approve(address _token, address _spender, uint256 _amount) internal {
        IERC20(_token).approve(_spender, _amount);
    }

    function _getTempleGoldInitArgs() internal view returns (ITempleGold.InitArgs memory initArgs) {
        initArgs.executor = executor;
        initArgs.layerZeroEndpoint = layerZeroEndpointArbitrumOne;
        initArgs.mintChainId = uint128(arbitrumOneChainId);
        initArgs.mintChainLzEid = uint128(ARBITRUM_ONE_LZ_EID);
        initArgs.name = TEMPLE_GOLD_NAME;
        initArgs.symbol = TEMPLE_GOLD_SYMBOL;
    }

    function _getDistributionParameters() internal pure returns (ITempleGold.DistributionParams memory _params) {
        _params.staking = 40 ether;
        _params.auction = 50 ether;
        _params.gnosis = 10 ether;
    }

    function _getVestingFactor() internal pure returns (ITempleGold.VestingFactor memory _factor) {
        _factor.value = 10 ether;
        _factor.weekMultiplier = 100 ether;
    }

    function _addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    function _setVestingFactor(TempleGold templeGold) internal {
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory factor;
        factor.value = 35;
        factor.weekMultiplier = 1 weeks;
        templeGold.setVestingFactor(factor);
        vm.stopPrank();
    }

    function _expectElevatedAccess() internal {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
    }
}