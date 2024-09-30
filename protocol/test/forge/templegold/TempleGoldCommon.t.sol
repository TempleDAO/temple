pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleGoldCommon.t.sol)

import { TempleTest } from "../TempleTest.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";

contract TempleGoldCommon is TempleTest {
    address public treasury = makeAddr("treasury");
    address public teamGnosis = makeAddr("teamGnosis");
    address public mike = makeAddr("mike");
    address public layerZeroEndpointArbitrumOne = 0x1a44076050125825900e736c501f859c50fE728c;
    address public layerZeroEndpointEthereum = 0x1a44076050125825900e736c501f859c50fE728c;
    uint256 public layerZeroEndpointArbitrumId = 30110;
    address public usdcToken = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // arb USDC
    address public daiToken = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1; //arb DAI

    string public constant TEMPLE_GOLD_NAME = "TEMPLE GOLD";
    string public constant TEMPLE_GOLD_SYMBOL = "TGLD";

    uint256 public mintChainId = 1;
    uint256 public arbitrumOneChainId = 42161;
    uint32 public constant MAINNET_LZ_EID = 30101;
    uint32 public constant ARBITRUM_ONE_LZ_EID = 30110;

    uint256 public constant forkBlockNumber = 204226954;
    uint256 public constant mainnetForkBlockNumber = 20053784;
    uint256 public constant WEEK_LENGTH = 7 days;

    string public constant NAME_ONE = "SPICE_AUCTION_TGLD_USDC";
    string public constant NAME_TWO = "SPICE_AUCTION_TGLD_DAI";

    string public constant VOTE_TOKEN_NAME = "Staked Temple Vote Token";
    string public constant VOTE_TOKEN_SYMBOL = "stTemple";

    FakeERC20 public fakeERC20;

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
        _params.daiGoldAuction = 50 ether;
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
}