import { useState, useEffect, useCallback } from 'react';
import { bidsHistoryGoldAuction, subgraphQuery } from 'utils/subgraph';
import env from 'constants/env';

const BUCKET_SIZE_HOURS = 12;

export type Bid = {
  date: string;
  bidAmount: string;
  price: string;
  transaction: string;
  transactionHash: string;
};

export type BidChartData = {
  price: number;
  bidAmount: string;
  hash: string;
  timestamp: number;
  bucket: string;
  bucketIndex: number;
  isFinalBid: boolean;
};

export type BidChartMetrics = {
  epoch: string;
  epochLabel: string;
  startTime: number;
  endTime: number;
  bids: BidChartData[];
};

type UseBidsHistoryReturn = {
  data: Bid[] | null;
  chartData: BidChartMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useBidsHistory = (
  epoch: string | undefined
): UseBidsHistoryReturn => {
  const [data, setData] = useState<Bid[] | null>(null);
  const [chartData, setChartData] = useState<BidChartMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const shortenTxnHash = (hash: string) => {
    if (!hash || hash.length < 16) return hash;
    return `${hash.slice(0, 16)}...${hash.slice(-8)}`;
  };

  const daiGoldAuction = env.contracts.spiceBazaar.daiGoldAuction.toLowerCase();
  const auctionId = epoch ? `${daiGoldAuction}-${epoch}` : undefined;

  const fetchData = useCallback(async () => {
    if (!auctionId) {
      setData(null);
      setChartData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await subgraphQuery(
        env.subgraph.spiceBazaar.eth,
        bidsHistoryGoldAuction(auctionId)
      );

      const instance = response.stableGoldAuctionInstance;
      const startTime = Number(instance.startTime);
      const endTime = Number(instance.endTime);

      setData(
        instance.bidTransaction.map((r) => ({
          date: r.timestamp,
          bidAmount: r.bidAmount,
          price: r.price,
          transaction: shortenTxnHash(r.hash),
          transactionHash: r.hash,
        }))
      );

      const processedBids: BidChartData[] = instance.bidTransaction.map(
        (bid) => {
          const bidTimestamp = Number(bid.timestamp);
          const secondsSinceStart = bidTimestamp - startTime;
          const hoursSinceStart = secondsSinceStart / 3600;
          const bucketIndex = Math.floor(hoursSinceStart / BUCKET_SIZE_HOURS);
          const bucketStart = bucketIndex * BUCKET_SIZE_HOURS;
          const bucketEnd = (bucketIndex + 1) * BUCKET_SIZE_HOURS;
          const bucketLabel = `${bucketStart}-${bucketEnd}h`;

          return {
            price: parseFloat(bid.price),
            bidAmount: bid.bidAmount,
            hash: bid.hash,
            timestamp: bidTimestamp,
            bucket: bucketLabel,
            bucketIndex,
            isFinalBid: false,
          };
        }
      );

      if (processedBids.length > 0) {
        processedBids.sort((a, b) => a.timestamp - b.timestamp);
        processedBids[processedBids.length - 1].isFinalBid = true;
      }

      const endDate = new Date(endTime * 1000).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      setChartData({
        epoch: epoch!,
        epochLabel: `Epoch ${epoch} - ${endDate}`,
        startTime,
        endTime,
        bids: processedBids,
      });

      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch transaction history.');
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    chartData,
    loading,
    error,
    refetch: fetchData,
  };
};
