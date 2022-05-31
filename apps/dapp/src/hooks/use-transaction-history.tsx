import { useState, useEffect } from 'react';
import axios, { AxiosRequestConfig } from 'axios';

import { TempleAddress, TEMPLE_ADDRESS_LABELS } from 'enums/addresses';

import { useWallet } from 'providers/WalletProvider';
import useIsMounted from './use-is-mounted';

interface ContractInteractionHistoryResponse {
  blockHash: string;
  blockNumber: string;
  gasPrice: string;
  gasUsed: string;
  id: string;
  timestamp: string;
  to: string;
  value: string;
}

interface SwapHistoryResponse {
  timestamp: string;
  amount1In: string;
  amount1Out: string;
  amount0In: string;
  amount0Out: string;
  amountUSD: string;
  pair: {
    token0: {
      symbol: string;
    };
    token1: {
      symbol: string;
    };
  };
  transaction: {
    id: string;
  };
}

interface TransactionRecord {
  time: Date;
  timestamp: number;
  to: string;
  id: string;
  toName: string;
  tokenSwapped?: string;
  tokenSwappedFor?: string;
  swappedAmount: number;
  receivedAmount: number;
  amountUsd?: number;
}

export function useTransactionHistory() {
  const { wallet } = useWallet();
  const isMounted = useIsMounted();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);

    if (!wallet) {
      if (isMounted) {
        setError({
          name: 'MissingWallet',
          message: 'Could not get wallet address',
        });
        setIsLoading(false);
      }
    } else {
      const handleRequest = async () => {
        const balancesRequest = createBalancesRequest(wallet);
        const ammRequest = createSwapsRequest(wallet);
        try {
          const promises = [axios(balancesRequest), axios(ammRequest)];
          const data = await Promise.all(promises);

          if (data) {
            const interactions: ContractInteractionHistoryResponse[] =
              data[0].data.data.transactions;

            const swaps: SwapHistoryResponse[] = data[1].data.data.swaps;

            const transactionHistory = createTransactionArray(
              interactions,
              swaps
            );

            if (isMounted) {
              setTransactions(transactionHistory);
            }
          }
        } catch (error) {
          if (isMounted) {
            setError(error as Error);
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };

      handleRequest();
    }
  }, [wallet]);

  return { transactions, isLoading, error };
}

function createTransactionArray(
  interactions: ContractInteractionHistoryResponse[],
  swaps: SwapHistoryResponse[]
): TransactionRecord[] {
  const formattedInteractions: TransactionRecord[] = interactions.map((tx) =>
    formatContractInteraction(tx)
  );

  const formattedSwaps: TransactionRecord[] = swaps.map((swap) =>
    formatSwap(swap)
  );

  // subgraph can return dupiclate txs so we need to make sure they're unique
  const filteredTransactionRecords = [
    ...formattedInteractions,
    ...formattedSwaps,
  ].filter(
    (tx, index, self) => self.findIndex((tx2) => tx2.id === tx.id) === index
  );

  return filteredTransactionRecords.sort((a, b) => b.timestamp - a.timestamp);
}

function formatContractInteraction(
  tx: ContractInteractionHistoryResponse
): TransactionRecord {
  return {
    id: tx.id,
    timestamp: Number(tx.timestamp) * 1000,
    time: new Date(Number(tx.timestamp) * 1000),
    to: tx.to,
    toName: TEMPLE_ADDRESS_LABELS[tx.to as TempleAddress],
    swappedAmount: 0,
    receivedAmount: 0,
  };
}

function formatSwap(swap: SwapHistoryResponse): TransactionRecord {
  let tokenSwapped = '';
  let tokenSwappedFor = '';
  let swappedAmount = 0;
  let receivedAmount = 0;

  if (Number(swap.amount0Out) > 0) {
    tokenSwapped = swap.pair.token1.symbol;
    tokenSwappedFor = swap.pair.token0.symbol;
    swappedAmount = Number(swap.amount1In);
    receivedAmount = Number(swap.amount0Out);
  }

  if (Number(swap.amount1Out) > 0) {
    tokenSwapped = swap.pair.token0.symbol;
    tokenSwappedFor = swap.pair.token1.symbol;
    swappedAmount = Number(swap.amount0In);
    receivedAmount = Number(swap.amount1Out);
  }

  return {
    id: swap.transaction.id,
    timestamp: Number(swap.timestamp) * 1000,
    time: new Date(Number(swap.timestamp) * 1000),
    to: TempleAddress.ammRouter,
    toName: TEMPLE_ADDRESS_LABELS[TempleAddress.ammRouter],
    tokenSwapped: tokenSwapped,
    swappedAmount: swappedAmount,
    tokenSwappedFor: tokenSwappedFor,
    receivedAmount: receivedAmount,
    amountUsd: Number(swap.amountUSD),
  };
}

function createBalancesRequest(wallet: string): AxiosRequestConfig {
  return {
    method: 'post',
    url: `https://api.thegraph.com/subgraphs/name/templedao/templedao-balances`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      query: `{
        transactions(where:{from: "${wallet.toLowerCase()}"}){
          id
          timestamp
          blockNumber
          blockHash
          to
          value
          gasUsed
          gasPrice
        }
      }`,
    },
  };
}

function createSwapsRequest(wallet: string): AxiosRequestConfig {
  return {
    method: 'post',
    url: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-amm',
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      query: `{
        swaps(where: {from: "${wallet.toLowerCase()}", to: "${wallet.toLowerCase()}"}){
          timestamp
          pair {
            token0 {
              symbol
            }
            token1 {
              symbol
            }
          }
          amount1In
          amount1Out
          amount0Out
          amount0In
          amountUSD
          transaction {
            id
          }
        }
      }`,
    },
  };
}
