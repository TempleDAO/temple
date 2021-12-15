pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./TempleERC20Token.sol";
import "./TempleTreasury.sol";
import "./TempleStaking.sol";
import "./LockedOGTemple.sol";
import "./OpeningCeremony.sol";

// USDC/USDT/DAI/ETH Zaps
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import '@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol';

interface IUniswapRouter is ISwapRouter {
    function refundETH() external payable;
}

/**
 * Generic Zap contract, to allow swap + mint
 */
contract Zap is Ownable {
    OpeningCeremony public openingCeremonyContract;
    
    IERC20 public stablecToken; // ERC20 exchanged for temple

    event ZapComplete(address minter, address exchangeTokenAddress, uint256 amountExchangeToken, uint256 amountStablec);

    // USDC/USDT/DAI/ETH Zaps
    IUniswapRouter public uniswapRouter;
    IQuoter public quoter;
    uint256 constant MAX_INT = 2**256 - 1;

    constructor(
      OpeningCeremony _openingCeremonyContract,
      IERC20 _stablecToken,
      IUniswapRouter _uniswapRouter,
      IQuoter _quoter) {

      openingCeremonyContract = _openingCeremonyContract;
      stablecToken = _stablecToken;
      uniswapRouter = _uniswapRouter;
      quoter = _quoter;
    }

    /** 
     * Zaps _tokenAddress for stablec using uniswap
     *
     * @dev if (_tokenAddress = address(0), assume eth)
     */
    function mintAndStakeZapsOC(uint256 _amountTokenInMaximum, address _tokenAddress, uint256 _fraxAmountOut, bytes memory _path) external payable {
      require((_tokenAddress != address(0) && msg.value == 0) ||  (_tokenAddress == address(0) && msg.value > 0), "ETH only accepted if zapping ETH.");

      uint256 _amountIn;

      if (_tokenAddress != address(0)) {
        _amountIn = _amountTokenInMaximum;
        SafeERC20.safeTransferFrom(IERC20(_tokenAddress), msg.sender, address(this), _amountIn);
        SafeERC20.safeIncreaseAllowance(IERC20(_tokenAddress), address(uniswapRouter), _amountIn);
      } else {
        _amountIn = msg.value;
      }

      ISwapRouter.ExactOutputParams memory params =
          ISwapRouter.ExactOutputParams({
              path: _path,
              recipient: address(this),
              deadline: block.timestamp,
              amountOut: _fraxAmountOut,
              amountInMaximum: _amountIn
          });

      uint256 _amountInPaid = uniswapRouter.exactOutput{ value: msg.value }(params); //Get amount of FRAX returned

      //The following will revert if _fraxAmountOut (Frax) is more than allocated amount. If we want to handle
      //the case where we proceed and refund excess Frax, the mintAndStakeFor has to be updated.
      SafeERC20.safeIncreaseAllowance(stablecToken, address(openingCeremonyContract), _fraxAmountOut);
      openingCeremonyContract.mintAndStakeFor(msg.sender, _fraxAmountOut);

      if (_amountInPaid < _amountIn) {
          uint256 excess = _amountIn - _amountInPaid;
          if (_tokenAddress != address(0)) {
            SafeERC20.safeTransfer(IERC20(_tokenAddress), msg.sender, excess);
          }
          else {
            uniswapRouter.refundETH();
            (bool success,) = msg.sender.call{ value: excess }("");
            require(success, "Refund of excess ETH failed");
          }
      }

      emit ZapComplete(msg.sender, _tokenAddress, _amountInPaid, _fraxAmountOut);
    }

    receive() payable external {} //This is important to be able to receive ETH refunds.

    // // Do not use on-chain, gas inefficient. Use only for frontend
    // function getEstimatedInput(bytes memory _path, uint256 _amountTokenOut) external payable returns (uint256) {
    //   return quoter.quoteExactOutput(
    //       _path,
    //       _amountTokenOut
    //   );
    // }
}