import { constants } from 'ethers';
import { Interface, JsonFragment } from '@ethersproject/abi'
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { SwapInfo, SwapType, FundManagement, SingleSwap, Swap, Relayers, SwapRelayer } from './types';
import { decorateSorSwapInfo } from './utils';

// function relayerResolver(
//   assetIn: string,
//   assetOut: string,
//   chainId: number
// ): SwapRelayer {
//   const { tokens, contracts } = networkAddresses(chainId);

//   let to = {
//     id: Relayers.vault,
//     address: contracts.vault,
//   };

//   if (tokens.stETH && contracts.lidoRelayer)
//     if ([assetIn, assetOut].includes(tokens.stETH))
//       to = {
//         id: Relayers.lido,
//         address: contracts.lidoRelayer,
//       };

//   return to;
// }


interface AmountForLimit {
  amount: BigNumber;
  max: (slippage: number) => BigNumber;
  min: (slippage: number) => BigNumber;
}

interface SDKSwapInfo extends SwapInfo {
  /** Name mapping to improve readability. */
  amountIn: BigNumber;
  amountOut: BigNumber;
  /** Name mapping for amounts used specifically for limits calculations. */
  amountInForLimits: AmountForLimit;
  amountOutForLimits: AmountForLimit;
  /** Wrapped token addresses used in the swap. */
  tokenInForSwaps: string;
  tokenOutFromSwaps: string;
}

class SingleSwapBuilder {
  private swapInfo: SDKSwapInfo;
  funds?: FundManagement;
  limit?: BigNumberish;
  deadline?: BigNumberish;
  readonly functionName = 'swap';

  /**
   * Building swap transaction data
   *
   * @param swapInfo SOR result
   * @param kind
   * @param chainId used to resolve relayer addresses
   */
  constructor(
    swapInfo: SwapInfo,
    private readonly kind: SwapType,
    private readonly chainId: number
  ) {
    this.swapInfo = decorateSorSwapInfo(swapInfo, kind);
  }

  setFunds(sender: string, recipient?: string): void {
    this.funds = {
      sender,
      recipient: recipient || sender,
      fromInternalBalance: false,
      toInternalBalance: false,
    };
  }

  /**
   * @param deadline block timestamp
   */
  setDeadline(deadline: BigNumber): void {
    this.deadline = deadline.toString();
  }

  get amount(): BigNumber {
    return this.kind === SwapType.SwapExactOut
      ? this.swapInfo.amountOutForLimits.amount
      : this.swapInfo.amountInForLimits.amount;
  }

  /**
   * Calculates the limit for token amount.
   * https://dev.balancer.fi/guides/swaps/single-swaps
   * https://dev.balancer.fi/resources/swaps/single-swap
   *
   * For swap:
   * The meaning of limit depends on the value of kind
   *    GIVEN_IN: The minimum amount of tokens we would accept to receive from the swap.
   *    GIVEN_OUT: The maximum amount of tokens we would be sending to swap.
   *
   * @param maxSlippage [bps], eg: 1 === 0.01%, 100 === 1%
   */
  setLimits(maxSlippage: number): void {
    this.limit =
      this.kind === SwapType.SwapExactIn
        ? this.swapInfo.amountOutForLimits.min(maxSlippage).toString()
        : this.swapInfo.amountInForLimits.max(maxSlippage).toString();
  }

  get singleSwap(): SingleSwap {
    const poolId = this.swapInfo.swaps[0].poolId;
    const kind = this.kind;
    const assetIn = this.swapInfo.tokenInForSwaps;
    const assetOut = this.swapInfo.tokenOutFromSwaps;
    const amount = this.amount.toString();
    const userData = '0x';

    return {
      poolId,
      kind,
      assetIn,
      assetOut,
      amount,
      userData,
    };
  }

  attributes(): Swap {
    if (!this.funds || !this.limit || !this.deadline) {
      throw new Error('Uninitialized arguments');
    }

    // TODO: Raise errors when some parameters are missing
    let attrs: Swap = {
      request: this.singleSwap,
      funds: this.funds,
      limit: this.limit,
      deadline: this.deadline,
    };

    return attrs;
  }

  value(maxSlippage: number): BigNumber {
    let amount = BigNumber.from(0);
    if (this.swapInfo.tokenIn === constants.AddressZero)
      amount =
        this.kind === SwapType.SwapExactIn
          ? this.swapInfo.amountIn
          : this.swapInfo.amountInForLimits.max(maxSlippage);
    return amount;
  }
}

export { SingleSwapBuilder };