// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import 'hardhat/console.sol';

import './ZapBaseV2_2.sol';

interface ITempleFraxAMMRouter {
  function swapExactFraxForTemple(
    uint256 amountIn,
    uint256 amountOutMin,
    address to,
    uint256 deadline
  ) external returns (uint256 amountOut);
}

interface ITempleStaking {
  function stakeFor(address _staker, uint256 _amountTemple)
    external
    returns (uint256 amountOgTemple);
}

interface DAI {
  function permit(
    address holder,
    address spender,
    uint256 nonce,
    uint256 expiry,
    bool allowed,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external;
}

// TODO: Remove this
interface Usdc {
  function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external;
}

contract TempleZaps is ZapBaseV2_2 {
  uint256 public constant TEMPLE_AMM_DEADLINE = 1200; // 20 minutes

  address public constant FRAX_ADDR =
    0x853d955aCEf822Db058eb8505911ED77F175b99e;
  address public constant DAI_ADDR = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
  address public constant USDC_ADDR =
    0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
  address public constant UNI_ADDR = 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984;

  address public TEMPLE = 0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7;
  address public OG_TEMPLE = 0x654590F810f01B51dc7B86915D4632977e49EA33;

  address public TEMPLE_STAKING = 0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77;
  address public TEMPLE_FRAX_AMM_ROUTER =
    0x8A5058100E60e8F7C42305eb505B12785bbA3BcA;

  mapping(address => bool) permitTokens;

  struct DAIPermit {
    address holder;
    address spender;
    uint256 nonce;
    uint256 expiry;
    bool allowed;
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  DAI public dai;

  // Emitted when `sender` Zaps In
  event zappedIn(address sender, address token, uint256 amountReceived);

  constructor() ZapBaseV2_2() {
    // 0x: Exchange Proxy
    approvedTargets[0xDef1C0ded9bec7F1a1670819833240f027b25EfF] = true;
    dai = DAI(DAI_ADDR);
    permitTokens[USDC_ADDR] = true;
    permitTokens[UNI_ADDR] = true;
  }

  /**
   * @notice This function deposits ETH and ERC20 tokens
   * @param fromToken The token used for entry (address(0) if ether)
   * @param fromAmount The amount of fromToken to invest
   * @param minTempleReceived The minimum acceptable quantity of TEMPLE to receive. Reverts otherwise.
   * @param swapTarget Excecution target for the swap
   * @param swapData DEX data
   * @return amountOGTemple quantity of OGTemple received
   */
  function zapIn(
    address fromToken,
    uint256 fromAmount,
    uint256 minTempleReceived,
    address swapTarget,
    bytes calldata swapData
  ) public payable whenNotPaused returns (uint256 amountOGTemple) {
    _pullTokens(fromToken, fromAmount);

    uint256 fraxBought = _fillQuote(
      fromToken,
      FRAX_ADDR,
      fromAmount,
      swapTarget,
      swapData
    );
    console.log('fraxBought:', fraxBought / 1e18);

    amountOGTemple = _enterTemple(fraxBought, minTempleReceived);
    emit zappedIn(msg.sender, OG_TEMPLE, amountOGTemple);
  }

  function zapInFRAX(uint256 amountFRAX, uint256 minTempleReceived)
    external
    whenNotPaused
    returns (uint256 amountOGTemple)
  {
    _pullTokens(FRAX_ADDR, amountFRAX);
    amountOGTemple = _enterTemple(amountFRAX, minTempleReceived);
    emit zappedIn(msg.sender, OG_TEMPLE, amountOGTemple);
  }

  function zapInDAIWithPermit(
    uint256 fromAmount,
    uint256 minTempleReceived,
    address swapTarget,
    bytes calldata swapData,
    DAIPermit calldata permit
  ) external whenNotPaused returns (uint256 amountOGTemple) {
    dai.permit(
      msg.sender,
      address(this),
      permit.nonce,
      permit.expiry,
      true,
      permit.v,
      permit.r,
      permit.s
    );
    return zapIn(DAI_ADDR, fromAmount, minTempleReceived, swapTarget, swapData);
  }

  /**
   * @notice This function deposits EIP-2612 compliant tokens
   */
  function zapInWithPermit(
    address fromToken,
    uint256 fromAmount,
    uint256 minTempleReceived,
    address swapTarget,
    bytes calldata swapData,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external whenNotPaused returns (uint256 amountOGTemple) {
    require(permitTokens[fromToken], 'TZ: token not allowed');

    ERC20 token = ERC20(fromToken);
    token.permit(msg.sender, address(this), fromAmount, deadline, v, r, s);

    return zapIn(fromToken, fromAmount, minTempleReceived, swapTarget, swapData);
  }

  function _enterTemple(uint256 amountFRAX, uint256 minTempleReceived)
    internal
    returns (uint256 amountOGTemple)
  {
    _approveToken(FRAX_ADDR, TEMPLE_FRAX_AMM_ROUTER, amountFRAX);

    uint256 amountTempleReceived = ITempleFraxAMMRouter(TEMPLE_FRAX_AMM_ROUTER)
      .swapExactFraxForTemple(
        amountFRAX,
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

  function withdraw(
    address token,
    address to,
    uint256 amount
  ) external onlyOwner {
    require(to != address(0), 'TZ: to address zero');
    if (token == address(0)) {
      SafeTransferLib.safeTransferETH(to, amount);
    } else {
      SafeTransferLib.safeTransfer(ERC20(token), to, amount);
    }
  }

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
