import React, { useState, useEffect } from 'react';
import { BigNumber, ethers } from 'ethers';
import axios, { AxiosRequestConfig } from 'axios';

import { fromAtto, toAtto } from 'utils/bigNumber';
import { TempleAddress, TEMPLE_ADDRESS_LABELS } from 'enums/addresses';

import { useWallet } from 'providers/WalletProvider';
import useIsMounted from './use-is-mounted';

interface TransactionHistoryResponse {
  blockHash: string;
  blockNumber: string;
  gasPrice: string;
  gasUsed: string;
  id: string;
  timestamp: string;
  to: string;
  value: string;
}

interface Transaction {
  blockHash: string;
  blockNumber: number;
  gasPrice: BigNumber;
  gasUsed: BigNumber;
  gasGwei: number;
  id: string;
  time: Date;
  timestamp: number;
  to: string;
  toName: string;
  value: number;
}

export function useTransactionHistory() {
  const { wallet } = useWallet();
  const isMounted = useIsMounted();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleRequest = async () => {
      if (wallet) {
        const request = setOptions(wallet);
        try {
          const { data } = await axios(request);
          if (data) {
            const transactions: TransactionHistoryResponse[] =
              data.data.transactions;

            const formattedTransactions: Transaction[] = transactions
              .map((tx) => formatTransaction(tx))
              .sort((a, b) => {
                return b.timestamp - a.timestamp;
              });

            if (isMounted) {
              setTransactions(formattedTransactions);
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
      } else
        setError({
          name: 'MissingWallet',
          message: 'Could not get wallet address',
        });
    };

    handleRequest();
  }, [wallet]);

  return { transactions, isLoading, error };
}

function setOptions(wallet: string): AxiosRequestConfig {
  return {
    method: 'post',
    url: 'https://api.thegraph.com/subgraphs/name/templedao/templedao-balances',
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

function formatTransaction(tx: TransactionHistoryResponse): Transaction {
  return {
    blockHash: tx.blockHash,
    blockNumber: Number(tx.blockNumber),
    gasPrice: toAtto(Number(tx.gasPrice)),
    gasUsed: toAtto(Number(tx.gasUsed)),
    id: tx.id,
    time: new Date(Number(tx.timestamp) * 1000),
    timestamp: Number(tx.timestamp) * 1000,
    to: tx.to,
    toName: TEMPLE_ADDRESS_LABELS[tx.to as TempleAddress],
    value: Number(tx.value),
    gasGwei: Number(ethers.utils.formatUnits(tx.gasPrice, 'gwei')),
  };
}
