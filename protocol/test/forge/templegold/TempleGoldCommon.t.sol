pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleGoldCommon.t.sol)

import { TempleTest } from "../TempleTest.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";

contract TempleGoldCommon is TempleTest {
    address public treasury = makeAddr("treasury");
    address public teamGnosis = makeAddr("teamGnosis");
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

    uint256 public constant forkBlockNumber = 204026954;
    uint256 public constant mainnetForkBlockNumber = 19782784;
    uint256 public constant WEEK_LENGTH = 7 days;

    string public constant NAME_ONE = "SPICE_AUCTION_TGLD_USDC";
    string public constant NAME_TWO = "SPICE_AUCTION_TGLD_DAI";

    string public constant VOTE_TOKEN_NAME = "Staked Temple Vote Token";
    string public constant VOTE_TOKEN_SYMBOL = "stTemple";

    receive() external payable {}

    function _approve(address _token, address _spender, uint256 _amount) internal {
        IERC20(_token).approve(_spender, _amount);
    }

    function _getTempleGoldInitArgs() internal view returns (ITempleGold.InitArgs memory initArgs) {
        initArgs.executor = executor;
        initArgs.staking = address(0);
        initArgs.escrow = address(0);
        initArgs.gnosis = teamGnosis;
        initArgs.layerZeroEndpoint = layerZeroEndpointArbitrumOne;
        initArgs.mintChainId = arbitrumOneChainId;
        initArgs.name = TEMPLE_GOLD_NAME;
        initArgs.symbol = TEMPLE_GOLD_SYMBOL;
    }

    function _getDistributionParameters() internal view returns (ITempleGold.DistributionParams memory _params) {
        _params.staking = 40 ether;
        _params.escrow = 50 ether;
        _params.gnosis = 10 ether;
    }

    function _getVestingFactor() internal view returns (ITempleGold.VestingFactor memory _factor) {
        _factor.numerator = 10 ether;
        _factor.denominator = 100 ether;
    }

    function _addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    // function _verifyPackets(uint32 _dstEid, bytes32 _dstAddress) public {
    //     verifyPackets(_dstEid, _dstAddress, 0, address(0x0));
    // } 

    // function _verifyPackets(uint32 _dstEid, address _dstAddress) public {
    //     _verifyPackets(_dstEid, bytes32(uint256(uint160(_dstAddress))), 0, address(0x0));
    // }

    function _verifyPackets(uint32 _dstEid, bytes32 _dstAddress, uint256 _packetAmount, address _composer) public {
        // require(endpoints[_dstEid] != address(0), "endpoint not yet registered");

        // DoubleEndedQueue.Bytes32Deque storage queue = packetsQueue[_dstEid][_dstAddress];
        // uint256 pendingPacketsSize = queue.length();
        // uint256 numberOfPackets;
        // if (_packetAmount == 0) {
        //     numberOfPackets = queue.length();
        // } else {
        //     numberOfPackets = pendingPacketsSize > _packetAmount ? _packetAmount : pendingPacketsSize;
        // }
        // while (numberOfPackets > 0) {
        //     numberOfPackets--;
        //     // front in, back out
        //     bytes32 guid = queue.popBack();
        //     bytes memory packetBytes = packets[guid];
        //     this.assertGuid(packetBytes, guid);
        //     this.validatePacket(packetBytes);

        //     bytes memory options = optionsLookup[guid];
        //     if (_executorOptionExists(options, ExecutorOptions.OPTION_TYPE_NATIVE_DROP)) {
        //         (uint256 amount, bytes32 receiver) = _parseExecutorNativeDropOption(options);
        //         address to = address(uint160(uint256(receiver)));
        //         (bool sent, ) = to.call{ value: amount }("");
        //         require(sent, "Failed to send Ether");
        //     }
        //     if (_executorOptionExists(options, ExecutorOptions.OPTION_TYPE_LZRECEIVE)) {
        //         this.lzReceive(packetBytes, options);
        //     }
        //     if (_composer != address(0) && _executorOptionExists(options, ExecutorOptions.OPTION_TYPE_LZCOMPOSE)) {
        //         this.lzCompose(packetBytes, options, guid, _composer);
        //     }
        // }
    }
}