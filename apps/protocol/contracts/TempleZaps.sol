// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.11;

import './ITempleStaking.sol';
import './ZapBaseV2_2.sol';

contract TempleZaps is ZapBaseV2_2 {
  using SafeERC20 for IERC20;

  /////////////// storage ///////////////

  address public constant FRAX = 0x853d955aCEf822Db058eb8505911ED77F175b99e;

  address public TempleStaking = 0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77;

  address public OGTemple = 0x654590F810f01B51dc7B86915D4632977e49EA33;

  /////////////// Events ///////////////

  // Emitted when `sender` Zaps In
  event zapIn(address sender, address token, uint256 tokensRec);

  // Emitted when `sender` Zaps Out
  event zapOut(address sender, address token, uint256 tokensRec);

  /////////////// Construction ///////////////

  constructor() ZapBaseV2_2() {
    // 0x: Exchange Proxy
    approvedTargets[0xDef1C0ded9bec7F1a1670819833240f027b25EfF] = true;
  }

  /**
   * @notice This function deposits assets into TempleDAO with ETH or ERC20 tokens
   * @param fromToken The token used for entry (address(0) if ether)
   * @param amountIn The amount of fromToken to invest
   * @param minToToken The minimum acceptable quantity of OGTemple to receive. Reverts otherwise
   * @param swapTarget Excecution target for the swap or zap
   * @param swapData DEX or Zap data. Must swap to ibToken underlying address
   * @return OGTempleReceived quantity of OGTemple received
   */
  function ZapIn(
    address fromToken,
    uint256 amountIn,
    uint256 minToToken,
    address swapTarget,
    bytes calldata swapData
  ) external payable stopInEmergency returns (uint256 OGTempleReceived) {
    uint256 toInvest = _pullTokens1(fromToken, amountIn);

    uint256 tokensBought = _fillQuote(
      fromToken,
      FRAX,
      toInvest,
      swapTarget,
      swapData
    );

    OGTempleReceived = _enterTemple(tokensBought);
    require(OGTempleReceived > minToToken, 'High Slippage');

    emit zapIn(msg.sender, OGTemple, OGTempleReceived);
  }

  function _enterTemple(uint256 amount) internal returns (uint256) {
    _approveToken(FRAX, TempleStaking, amount);

    ITempleStaking(TempleStaking).stakeFor(msg.sender, amount);

    return amount;
  }

  ///////////// Owner only /////////////

  function updateStaking(address _staking) external onlyOwner {
    TempleStaking = _staking;
  }

  function updateOGTemple(address _OGTemple) external onlyOwner {
    OGTemple = _OGTemple;
  }
}
