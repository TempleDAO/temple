// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.11;

import './ITempleStaking.sol';
import './ZapBaseV2_2.sol';

contract TempleZaps is ZapBaseV2_2 {
  using SafeERC20 for IERC20;

  /////////////// STORAGE ///////////////

  address public constant FRAX = 0x853d955aCEf822Db058eb8505911ED77F175b99e;
  address public TempleStaking = 0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77;
  address public OGTemple = 0x654590F810f01B51dc7B86915D4632977e49EA33;

  /////////////// EVENTS ///////////////

  // Emitted when `sender` Zaps In
  event zapIn(address sender, address token, uint256 amountReceived);

  /////////////// CONSTRUCTOR ///////////////

  constructor() ZapBaseV2_2() {
    // 0x: Exchange Proxy
    approvedTargets[0xDef1C0ded9bec7F1a1670819833240f027b25EfF] = true;
  }

  /////////////// LOGIC ///////////////

  /**
   * @notice This function deposits assets into TempleDAO with ETH or ERC20 tokens
   * @param fromToken The token used for entry (address(0) if ether)
   * @param amountIn The amount of fromToken to invest
   * @param minToToken The minimum acceptable quantity of OGTemple to receive. Reverts otherwise
   * @param swapTarget Excecution target for the swap or zap
   * @param swapData DEX data
   * @return amountReceived quantity of OGTemple received
   */
  function ZapIn(
    address fromToken,
    uint256 amountIn,
    uint256 minToToken,
    address swapTarget,
    bytes calldata swapData
  ) external payable whenNotPaused returns (uint256 amountReceived) {
    uint256 toInvest = _pullTokens1(fromToken, amountIn);

    uint256 tokensBought = _fillQuote(
      fromToken,
      FRAX,
      toInvest,
      swapTarget,
      swapData
    );

    amountReceived = _enterTemple(tokensBought);
    require(amountReceived > minToToken, 'High Slippage');

    emit zapIn(msg.sender, OGTemple, amountReceived);
    return amountReceived;
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
