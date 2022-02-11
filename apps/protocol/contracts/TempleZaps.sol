// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import 'hardhat/console.sol';

import './ZapBaseV2_3.sol';

interface ITempleFraxAMMRouter {
  function swapExactFraxForTemple(
    uint256 amountIn,
    uint256 amountOutMin,
    address to,
    uint256 deadline
  ) external returns (uint256 amountOut);
}

interface ITempleStaking {
  function stakeFor(address staker, uint256 amountTemple)
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

contract TempleZaps is ZapBaseV2_3 {
  uint256 private constant TEMPLE_AMM_DEADLINE = 1200; // 20 minutes

  address private constant DAI_ADDR = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
  address public TEMPLE = 0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7;
  address public TEMPLE_STAKING = 0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77;
  address public TEMPLE_FRAX_AMM_ROUTER =
    0x8A5058100E60e8F7C42305eb505B12785bbA3BcA;

  DAI private dai;

  mapping(address => bool) public permittableTokens;

  // Emitted when `sender` Zaps In
  event zappedIn(address indexed sender, uint256 amountReceived);

  constructor() ZapBaseV2_3() {
    // 0x: Exchange Proxy
    approvedTargets[0xDef1C0ded9bec7F1a1670819833240f027b25EfF] = true;
    // USDC
    permittableTokens[0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48] = true;
    // UNI
    permittableTokens[0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984] = true;
    dai = DAI(DAI_ADDR);
  }

  /**
   * @notice This function zaps ETH and ERC20 tokens
   * @param fromToken The token used for entry (address(0) if ether)
   * @param fromAmount The amount of fromToken to zap
   * @param minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @param swapTarget Execution target for the swap
   * @param swapData DEX data
   * @return amountOGTemple Quantity of OGTemple received
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
      fromAmount,
      swapTarget,
      swapData
    );
    console.log('fraxBought:', fraxBought / 1e18);

    amountOGTemple = _enterTemple(fraxBought, minTempleReceived);
    emit zappedIn(msg.sender, amountOGTemple);
  }

  /**
   * @notice This function skips the FRAX swap and performs the remaining zap steps
   * @param amountFRAX The amount of FRAX to zap
   * @param minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @return amountOGTemple Quantity of OGTemple received
   */
  function zapInFRAX(uint256 amountFRAX, uint256 minTempleReceived)
    external
    whenNotPaused
    returns (uint256 amountOGTemple)
  {
    _pullTokens(FRAX_ADDR, amountFRAX);
    amountOGTemple = _enterTemple(amountFRAX, minTempleReceived);
    emit zappedIn(msg.sender, amountOGTemple);
  }

  /**
   * @notice This function zaps DAI using permit
   * @param fromAmount The amount of DAI to zap
   * @param minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @param swapTarget Execution target for the swap
   * @param swapData DEX data
   * @param nonce Nonce of the last permit transaction of a user’s wallet
   * @param expiry Permit deadline
   * @param v secp256k1 signature component
   * @param r secp256k1 signature component
   * @param s secp256k1 signature component
   * @return amountOGTemple Quantity of OGTemple received
   */
  function zapInDAIWithPermit(
    uint256 fromAmount,
    uint256 minTempleReceived,
    address swapTarget,
    bytes calldata swapData,
    uint256 nonce,
    uint256 expiry,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external whenNotPaused returns (uint256 amountOGTemple) {
    dai.permit(msg.sender, address(this), nonce, expiry, true, v, r, s);
    return zapIn(DAI_ADDR, fromAmount, minTempleReceived, swapTarget, swapData);
  }

  /**
   * @notice This function zaps EIP-2612 compliant tokens using permit
   * @param fromToken The token used for entry
   * @param fromAmount The amount of fromToken to zap
   * @param minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @param swapTarget Execution target for the swap
   * @param swapData DEX data
   * @param deadline Permit deadline
   * @param v secp256k1 signature component
   * @param r secp256k1 signature component
   * @param s secp256k1 signature component
   * @return amountOGTemple Quantity of OGTemple received
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
    require(permittableTokens[fromToken], 'TZ: token not allowed');

    ERC20 token = ERC20(fromToken);
    token.permit(msg.sender, address(this), fromAmount, deadline, v, r, s);

    return zapIn(fromToken, fromAmount, minTempleReceived, swapTarget, swapData);
  }

  /**
   * @notice This function swaps FRAX for TEMPLE and stakes TEMPLE
   * @param amountFRAX The amount of FRAX to swap
   * @param minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @return amountOGTemple Quantity of OGTemple received
   */
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

  function setPermittableToken(address token, bool status) external onlyOwner {
    permittableTokens[token] = status;
  }

  function updateTemple(address _temple) external onlyOwner {
    TEMPLE = _temple;
  }

  function updateStaking(address _staking) external onlyOwner {
    TEMPLE_STAKING = _staking;
  }

  function updateAMMRouter(address _ammRouter) external onlyOwner {
    TEMPLE_FRAX_AMM_ROUTER = _ammRouter;
  }
}
