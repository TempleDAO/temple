import { BigNumber, Contract } from 'ethers';

import { Pool } from 'components/Layouts/Auction/types';
import { Nullable } from 'types/util';

export class BalancerQuoteManager {
  private _wallet: string;
  private _contract: Contract;
  private _pool: Pool;
  private _currentQuote: Nullable<{
    assetOut: string;
    assetIn: string;
    value: BigNumber;
    result: Nullable<[string, string]>;
  }>;

  constructor(
    contract: Contract,
    pool: Pool,
    wallet: string,
  ) {
    this._contract = contract;
    this._pool = pool;
    this._currentQuote = null;
    this._wallet = wallet;
  }

  isSameQuote = (value: BigNumber, buyAsset: string, sellAsset: string): boolean => {
    const quote = this._currentQuote;
    if (!quote) {
      return false;
    }

    return quote.value.eq(value) && quote.assetIn === sellAsset && quote.assetOut === buyAsset;
  }

  getSwapQuote = async (value: BigNumber, buyAsset: string, sellAsset: string, onComplete: (value: [string, string]) => void) => {
    if (this.isSameQuote(value, buyAsset, sellAsset)) {
      return;
    }

    const assetOutIndex = this._pool.tokensList.findIndex((address) => address === buyAsset);
    const assetInIndex = this._pool.tokensList.findIndex((address) => address === sellAsset);

    this._currentQuote = {
      value,
      assetOut: buyAsset,
      assetIn: sellAsset,
      result: null,
    };
    
    /*
    * queryBatchSwap simulates a call to `batchSwap`, returning an array of Vault asset deltas. Calls to `swap` cannot be
    * simulated directly, but an equivalent `batchSwap` call can and will yield the exact same result.
    *
    * Each element in the array corresponds to the asset at the same index, and indicates the number of tokens (or ETH)
    * the Vault would take from the sender (if positive) or send to the recipient (if negative). The arguments it
    * receives are the same that an equivalent `batchSwap` call would receive.
    */
    const quote = await this._contract.callStatic.queryBatchSwap(
      0,
      [{
        poolId: this._pool.id,
        assetInIndex,
        assetOutIndex,
        amount: value,
        userData: '0x',
      }],
      this._pool.tokensList,
      {
        sender: this._wallet.toLowerCase(),
        recipient: this._wallet.toLowerCase(),
        fromInternalBalance: false,
        toInternalBalance: false,
      }
    );

    if (this.isSameQuote(value, buyAsset, sellAsset)) {
      this._currentQuote.result = quote.map((value: BigNumber) => value.toString());
      onComplete(this._currentQuote.result!);
    }
  };
}