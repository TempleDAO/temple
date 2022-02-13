// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

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

contract TempleZaps is ZapBaseV2_3 {
  address public TEMPLE;
  address public TEMPLE_STAKING;
  address public TEMPLE_FRAX_AMM_ROUTER;

  mapping(address => bool) public permittableTokens;

  // Emitted when `sender` Zaps In
  event zappedIn(address indexed sender, uint256 amountReceived);

  constructor(
    address templeToken,
    address templeStaking,
    address templeAMM
  ) ZapBaseV2_3() {
    TEMPLE = templeToken;
    TEMPLE_STAKING = templeStaking;
    TEMPLE_FRAX_AMM_ROUTER = templeAMM;
  }

  /**
   * @notice This function zaps ETH and ERC20 tokens
   * @param fromToken The token used for entry (address(0) if ether)
   * @param fromAmount The amount of fromToken to zap
   * @param minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @param ammDeadline The UNIX timestamp the zap must be completed by
   * @param swapTarget Execution target for the swap
   * @param swapData DEX data
   * @return amountOGTemple Quantity of OGTemple received
   */
  function zapIn(
    address fromToken,
    uint256 fromAmount,
    uint256 minTempleReceived,
    uint256 ammDeadline,
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

    amountOGTemple = _enterTemple(fraxBought, minTempleReceived, ammDeadline);
    emit zappedIn(msg.sender, amountOGTemple);
  }

  /**
   * @notice This function zaps EIP-2612 compliant tokens using permit
   * @param fromToken The token used for entry
   * @param fromAmount The amount of fromToken to zap
   * @param minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @param ammDeadline The UNIX timestamp the zap must be completed by
   * @param swapTarget Execution target for the swap
   * @param swapData DEX data
   * @param permitDeadline Permit deadline
   * @param v secp256k1 signature component
   * @param r secp256k1 signature component
   * @param s secp256k1 signature component
   * @return amountOGTemple Quantity of OGTemple received
   */
  function zapInWithPermit(
    address fromToken,
    uint256 fromAmount,
    uint256 minTempleReceived,
    uint256 ammDeadline,
    address swapTarget,
    bytes calldata swapData,
    uint256 permitDeadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external whenNotPaused returns (uint256 amountOGTemple) {
    require(permittableTokens[fromToken], 'TZ: token not allowed');

    ERC20 token = ERC20(fromToken);
    token.permit(
      msg.sender,
      address(this),
      fromAmount,
      permitDeadline,
      v,
      r,
      s
    );

    return
      zapIn(
        fromToken,
        fromAmount,
        minTempleReceived,
        ammDeadline,
        swapTarget,
        swapData
      );
  }

  /**
   * @notice This function swaps FRAX for TEMPLE and stakes TEMPLE
   * @param amountFRAX The amount of FRAX to swap
   * @param minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @return amountOGTemple Quantity of OGTemple received
   */
  function _enterTemple(
    uint256 amountFRAX,
    uint256 minTempleReceived,
    uint256 ammDeadline
  ) internal returns (uint256 amountOGTemple) {
    _approveToken(FRAX_ADDR, TEMPLE_FRAX_AMM_ROUTER, amountFRAX);

    uint256 amountTempleReceived = ITempleFraxAMMRouter(TEMPLE_FRAX_AMM_ROUTER)
      .swapExactFraxForTemple(
        amountFRAX,
        minTempleReceived,
        address(this),
        ammDeadline
      );

    _approveToken(TEMPLE, TEMPLE_STAKING, amountTempleReceived);

    amountOGTemple = ITempleStaking(TEMPLE_STAKING).stakeFor(
      msg.sender,
      amountTempleReceived
    );
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

  /**
    @dev Adds or removes a permittable token
    @param tokens An array of token addresses
    @param isPermittable An array of booleans indicating whether the token is permittable
    */
  function setPermittableTokens(
    address[] calldata tokens,
    bool[] calldata isPermittable
  ) external onlyOwner {
    require(tokens.length == isPermittable.length, 'Invalid Input length');

    for (uint256 i = 0; i < tokens.length; i++) {
      permittableTokens[tokens[i]] = isPermittable[i];
    }
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
