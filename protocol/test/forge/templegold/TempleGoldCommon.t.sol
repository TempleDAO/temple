pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleGoldCommon.t.sol)

import { TempleTest } from "../TempleTest.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract TempleGoldCommon is TempleTest {
    address public treasury = makeAddr("treasury");
    address public teamGnosis = makeAddr("teamGnosis");
    address public layerZeroEndpointArbitrumOne = 0x1a44076050125825900e736c501f859c50fE728c;
    uint256 public layerZeroEndpointArbitrumId = 30110;
    address public usdcToken = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // arb USDC
    address public daiToken = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1; //arb DAI

    string public constant TEMPLE_GOLD_NAME = "TEMPLE GOLD";
    string public constant TEMPLE_GOLD_SYMBOL = "TGLD";

    uint256 public mintChainId = 1;
    uint256 public arbitrumOneChainId = 42161;

    uint256 public constant forkBlockNumber = 204026954;
    uint256 public constant WEEK_LENGTH = 7 days;

    string public constant NAME_ONE = "SPICE_AUCTION_TGLD_USDC";
    string public constant NAME_TWO = "SPICE_AUCTION_TGLD_DAI";

    function _approve(address _token, address _spender, uint256 _amount) internal {
        IERC20(_token).approve(_spender, _amount);
    }
}