import { useCallback, useEffect, useState } from 'react';
import { spiceBidHistoryQuery, subgraphQuery } from 'utils/subgraph';
import { getAllSpiceBazaarSubgraphEndpoints } from 'constants/env/getSpiceBazaarEndpoints';

// Constants for bid history processing
const BUCKET_SIZE_HOURS = 24; // Group bids into 24-hour time buckets

export type BidData = {
  price: number;
  bidAmount: string;
  hash: string;
  timestamp: number;
  bucket: string; // e.g., "0-24h", "24-48h"
  bucketIndex: number; // e.g., 0, 1, 2...
  epoch: string;
  isFinalBid: boolean; // Whether this is the last (winning) bid of the entire epoch
};

export type BidHistoryMetrics = {
  epoch: string;
  epochLabel: string; // Formatted for display
  startTime: number;
  endTime: number;
  auctionTokenSymbol: string; // e.g., "SPICE", "KAMY"
  bids: BidData[];
};

type UseBidHistoryReturn = {
  data: BidHistoryMetrics[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Custom hook to fetch and process bid history data for spice auctions
 * Groups bids into time buckets from auction start time
 */
export const useBidHistory = (
  auctionTokenAddress: string | undefined
): UseBidHistoryReturn => {
  const [data, setData] = useState<BidHistoryMetrics[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!auctionTokenAddress) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoints = getAllSpiceBazaarSubgraphEndpoints();

      let bidTransactions = null;

      // Try each endpoint until we find data
      for (const entry of endpoints) {
        try {
          const response = await subgraphQuery(
            entry.url,
            spiceBidHistoryQuery(auctionTokenAddress)
          );
          if (response.bidTransactions && response.bidTransactions.length > 0) {
            bidTransactions = response.bidTransactions;
            break;
          }
        } catch (endpointError) {
          console.warn(
            `[BidHistory] Failed to fetch from endpoint ${entry.url}:`,
            endpointError
          );
          // Continue to next endpoint
        }
      }

      if (!bidTransactions || bidTransactions.length === 0) {
        setData([]);
        return;
      }

      // Group bids by epoch
      const bidsByEpoch = new Map<string, any[]>();
      bidTransactions.forEach((bid: any) => {
        const epoch = bid.auctionInstance.epoch;
        if (!bidsByEpoch.has(epoch)) {
          bidsByEpoch.set(epoch, []);
        }
        bidsByEpoch.get(epoch)!.push(bid);
      });

      // Process each epoch's bids into 12-hour buckets
      const metrics: BidHistoryMetrics[] = Array.from(
        bidsByEpoch.entries()
      ).map(([epoch, bids]) => {
        // Get auction start time from first bid's instance
        const startTime = Number(bids[0].auctionInstance.startTime);
        const endTime = Number(bids[0].auctionInstance.endTime);
        const auctionTokenSymbol =
          bids[0].auctionInstance.spiceAuction?.spiceToken?.symbol || 'TOKEN';

        // Process bids into buckets
        const processedBids: BidData[] = bids.map((bid: any, index: number) => {
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
            epoch,
            isFinalBid: false, // Will be set in next step
          };
        });

        // Mark only the very last bid of the entire epoch as final
        if (processedBids.length > 0) {
          // Sort by timestamp to find the last bid
          processedBids.sort((a, b) => a.timestamp - b.timestamp);
          // Mark only the last bid of the epoch
          processedBids[processedBids.length - 1].isFinalBid = true;
        }

        // Format epoch label for display
        const endDate = new Date(endTime * 1000).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const epochLabel = `Epoch ${epoch} - ${endDate}`;

        return {
          epoch,
          epochLabel,
          startTime,
          endTime,
          auctionTokenSymbol,
          bids: processedBids, // Already sorted above
        };
      });

      // Sort by epoch number
      metrics.sort((a, b) => Number(a.epoch) - Number(b.epoch));

      setData(metrics);
    } catch (err) {
      console.error('Failed to fetch bid history data', err);
      setError('Failed to load bid history data.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [auctionTokenAddress]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};
