// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.11;

import './ITempleStaking.sol';
import './amm/ITempleFraxAMMRouter.sol';

import './ZapBaseV2_2.sol';
import 'hardhat/console.sol';

contract TempleZaps is ZapBaseV2_2 {
  /////////////// STORAGE ///////////////

  uint256 public constant TEMPLE_AMM_DEADLINE = 1200; // 20 minutes

  address public constant FRAX = 0x853d955aCEf822Db058eb8505911ED77F175b99e;
  address public TEMPLE = 0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7;
  address public OG_TEMPLE = 0x654590F810f01B51dc7B86915D4632977e49EA33;

  address public TEMPLE_STAKING = 0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77;
  address public TEMPLE_FRAX_AMM_ROUTER =
    0x8A5058100E60e8F7C42305eb505B12785bbA3BcA;

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
   * @param fromAmount The amount of fromToken to invest
   * @param minTempleReceived The minimum acceptable quantity of Temple to receive. Reverts otherwise.
   * @param swapTarget Excecution target for the swap
   * @param swapData DEX data
   * @return amountOGTemple quantity of OGTemple received
   */
  function ZapIn(
    address fromToken,
    uint256 fromAmount,
    uint256 minTempleReceived,
    address swapTarget,
    bytes calldata swapData
  ) external payable whenNotPaused returns (uint256 amountOGTemple) {
    _pullTokens(fromToken, fromAmount);

    uint256 fraxBought = _fillQuote(
      fromToken,
      FRAX,
      fromAmount,
      swapTarget,
      swapData
    );
    console.log('fraxBought:', fraxBought / 1e18);

    amountOGTemple = _enterTemple(fraxBought, minTempleReceived);

    emit zapIn(msg.sender, OG_TEMPLE, amountOGTemple);
  }

  function _enterTemple(uint256 amountFrax, uint256 minTempleReceived)
    internal
    returns (uint256 amountOGTemple)
  {
    _approveToken(FRAX, TEMPLE_FRAX_AMM_ROUTER, amountFrax);

    uint256 amountTempleReceived = ITempleFraxAMMRouter(TEMPLE_FRAX_AMM_ROUTER)
      .swapExactFraxForTemple(
        amountFrax,
        minTempleReceived,
        address(this),
        block.timestamp + TEMPLE_AMM_DEADLINE
      );

    console.log('amountTempleReceived:', amountTempleReceived / 1e18);

    _approveToken(TEMPLE, TEMPLE_STAKING, amountTempleReceived);

    amountOGTemple = ITempleStaking(TEMPLE_STAKING).stakeFor(
      msg.sender,
      amountTempleReceived
    );

    console.log('amountOGTemple:', amountOGTemple / 1e18);
  }

  ///////////// Owner only /////////////

  function updateTemple(address _temple) external onlyOwner {
    TEMPLE = _temple;
  }

  function updateOGTemple(address _ogTemple) external onlyOwner {
    OG_TEMPLE = _ogTemple;
  }

  function updateStaking(address _staking) external onlyOwner {
    TEMPLE_STAKING = _staking;
  }

  function updateAMMRouter(address _ammRouter) external onlyOwner {
    TEMPLE_FRAX_AMM_ROUTER = _ammRouter;
  }
}
