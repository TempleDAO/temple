// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.11;

import './ITempleStaking.sol';
import './ZapBaseV2_2.sol';

contract TempleZaps is ZapBaseV2_2 {
  using SafeERC20 for IERC20;

  /////////////// storage ///////////////

  address public olympusDAO;

  address public staking = 0xFd31c7d00Ca47653c6Ce64Af53c1571f9C36566a;

  address public constant OHM = 0x383518188C0C6d7730D91b2c03a03C837814a899;

  address public sOHM = 0x04F2694C8fcee23e8Fd0dfEA1d4f5Bb8c352111F;

  address public wsOHM = 0xCa76543Cf381ebBB277bE79574059e32108e3E65;

  /////////////// Events ///////////////

  // Emitted when `sender` Zaps In
  event zapIn(address sender, address token, uint256 tokensRec);

  // Emitted when `sender` Zaps Out
  event zapOut(address sender, address token, uint256 tokensRec);

  /////////////// Modifiers ///////////////

  modifier onlyOlympusDAO() {
    require(msg.sender == olympusDAO, 'Only OlympusDAO');
    _;
  }

  /////////////// Construction ///////////////

  constructor(address _olympusDAO) ZapBaseV2_2() {
    // 0x Proxy
    approvedTargets[0xDef1C0ded9bec7F1a1670819833240f027b25EfF] = true;

    olympusDAO = _olympusDAO;
  }

  /**
   * @notice This function deposits assets into OlympusDAO with ETH or ERC20 tokens
   * @param fromToken The token used for entry (address(0) if ether)
   * @param amountIn The amount of fromToken to invest
   * @param toToken The token fromToken is getting converted to.
   * @param minToToken The minimum acceptable quantity sOHM
   * or wsOHM or principal tokens to receive. Reverts otherwise
   * @param swapTarget Excecution target for the swap or zap
   * @param swapData DEX or Zap data. Must swap to ibToken underlying address
   * @return OHMRec quantity of sOHM or wsOHM  received (depending on toToken)
   */
  function ZapIn(
    address fromToken,
    uint256 amountIn,
    address toToken,
    uint256 minToToken,
    address swapTarget,
    bytes calldata swapData
  ) external payable stopInEmergency returns (uint256 OHMRec) {
    require(
      toToken == sOHM || toToken == wsOHM,
      'toToken must be sOHM or wsOHM'
    );

    uint256 toInvest = _pullTokens1(fromToken, amountIn);

    uint256 tokensBought = _fillQuote(
      fromToken,
      OHM,
      toInvest,
      swapTarget,
      swapData
    );

    OHMRec = _enterOlympus(tokensBought, toToken);
    require(OHMRec > minToToken, 'High Slippage');

    emit zapIn(msg.sender, sOHM, OHMRec);
  }

  /**
   * @notice This function withdraws assets from OlympusDAO, receiving tokens or ETH
   * @param fromToken The ibToken being withdrawn
   * @param amountIn The quantity of fromToken to withdraw
   * @param toToken Address of the token to receive (0 address if ETH)
   * @param minToTokens The minimum acceptable quantity of tokens to receive. Reverts otherwise
   * @param swapTarget Excecution target for the swap or zap
   * @param swapData DEX or Zap data
   * @return tokensRec Quantity of aTokens received
   */
  function ZapOut(
    address fromToken,
    uint256 amountIn,
    address toToken,
    uint256 minToTokens,
    address swapTarget,
    bytes calldata swapData
  ) external stopInEmergency returns (uint256 tokensRec) {
    require(
      fromToken == sOHM || fromToken == wsOHM,
      'fromToken must be sOHM or wsOHM'
    );

    amountIn = _pullTokens2(fromToken, amountIn);

    uint256 OHMRec = _exitOlympus(fromToken, amountIn);

    tokensRec = _fillQuote(OHM, toToken, OHMRec, swapTarget, swapData);
    require(tokensRec >= minToTokens, 'High Slippage');

    if (toToken == address(0)) {
      payable(msg.sender).transfer(tokensRec);
    } else {
      IERC20(toToken).safeTransfer(msg.sender, tokensRec);
    }
    tokensRec = tokensRec;

    emit zapOut(msg.sender, toToken, tokensRec);
  }

  function _enterOlympus(uint256 amount, address toToken)
    internal
    returns (uint256)
  {
    _approveToken(OHM, staking, amount);

    if (toToken == wsOHM) {
      IStaking(staking).stake(amount, address(this));
      IStaking(staking).claim(address(this));

      _approveToken(sOHM, wsOHM, amount);

      uint256 beforeBalance = _getBalance(wsOHM);

      IwsOHM(wsOHM).wrap(amount);

      uint256 wsOHMRec = _getBalance(wsOHM) - beforeBalance;

      IERC20(wsOHM).safeTransfer(msg.sender, wsOHMRec);

      return wsOHMRec;
    }
    IStaking(staking).stake(amount, msg.sender);
    IStaking(staking).claim(msg.sender);

    return amount;
  }

  function _exitOlympus(address fromToken, uint256 amount)
    internal
    returns (uint256)
  {
    if (fromToken == wsOHM) {
      uint256 sOHMRec = IwsOHM(wsOHM).unwrap(amount);

      _approveToken(sOHM, address(staking), sOHMRec);

      IStaking(staking).unstake(sOHMRec, true);

      return sOHMRec;
    }
    _approveToken(sOHM, address(staking), amount);

    IStaking(staking).unstake(amount, true);

    return amount;
  }

  function removeLiquidityReturn(address fromToken, uint256 fromAmount)
    external
    view
    returns (uint256 ohmAmount)
  {
    if (fromToken == sOHM) {
      return fromAmount;
    } else if (fromToken == wsOHM) {
      return IwsOHM(wsOHM).wOHMTosOHM(fromAmount);
    }
  }

  ///////////// olympus only /////////////

  function update_OlympusDAO(address _olympusDAO) external onlyOlympusDAO {
    olympusDAO = _olympusDAO;
  }

  function update_Staking(address _staking) external onlyOlympusDAO {
    staking = _staking;
  }

  function update_sOHM(address _sOHM) external onlyOlympusDAO {
    sOHM = _sOHM;
  }

  function update_wsOHM(address _wsOHM) external onlyOlympusDAO {
    wsOHM = _wsOHM;
  }
}
