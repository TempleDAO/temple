// TODO: We need to refactor this using useQuery
import { useCallback, useEffect, useState } from 'react';
import { priceHistory, subgraphQuery } from 'utils/subgraph';
import env from 'constants/env';
import { DaiGoldAuctionInfo } from 'providers/SpiceBazaarProvider';

interface DailyAuctionSnapshot {
  id: string;
  timeframe: string;
  timestamp: string;
  priceRatio: string;
  price: string;
  totalBidTokenAmount: string;
}

interface HourlyAuctionSnapshot {
  id: string;
  timeframe: string;
  timestamp: string;
  priceRatio: string;
  price: string;
}

interface AuctionInstance {
  epoch: string;
  auctionInstanceDailySnapshots: DailyAuctionSnapshot[];
  auctionInstanceHourlySnapshots: HourlyAuctionSnapshot[];
}

interface SubgraphResponse {
  stableGoldAuctionInstances: AuctionInstance[];
}

type Metric = { timestamp: number; price: number };

const convertTimestampToDate = (timestamp: string) => {
  return new Date(parseInt(timestamp, 10) * 1000);
};

const generatePriceData = (
  response: SubgraphResponse,
  auctionInfo: DaiGoldAuctionInfo
) => {
  const dailySnapshots =
    response?.stableGoldAuctionInstances?.[0]?.auctionInstanceDailySnapshots ||
    [];

  const hourlySnapshots =
    response?.stableGoldAuctionInstances?.[0]?.auctionInstanceHourlySnapshots ||
    [];

  const snapshotsWithDates = dailySnapshots.map((snapshot) => ({
    date: convertTimestampToDate(snapshot.timeframe),
    price: parseFloat(snapshot.price),
  }));

  const firstDateOfAuction = new Date(auctionInfo.auctionStartTime);

  const result: Metric[] = [];

  // TODO: What if there are less or more than 7 days in the auction duration?
  for (let i = 0; i < 7; i++) {
    const currentDay = new Date(firstDateOfAuction);

    currentDay.setDate(firstDateOfAuction.getDate() + i);

    let snapshotForDay = snapshotsWithDates.find(
      (snapshot) => snapshot.date.toDateString() === currentDay.toDateString()
    );

    if (!snapshotForDay) {
      const previousSnapshots = snapshotsWithDates.filter(
        (snapshot) => snapshot.date < currentDay
      );

      if (previousSnapshots.length > 0) {
        const previousSnapshot = previousSnapshots.sort(
          (a, b) => b.date.getTime() - a.date.getTime()
        )[0];
        snapshotForDay = { date: currentDay, price: previousSnapshot.price };
      } else {
        snapshotForDay = { date: currentDay, price: 0 };
      }
    }

    result.push({
      timestamp: currentDay.getTime(),
      price: snapshotForDay.price,
    });
  }

  console.log(
    'result',
    result.map((r) => ({
      price: r.price,
      timestamp: `${new Date(r.timestamp).getMonth()}/${new Date(
        r.timestamp
      ).getDate()}/${new Date(r.timestamp).getFullYear()}`,
    }))
  );

  return result;
};

export const useAuctionsPriceHistory = (
  isPhoneOrAbove: boolean,
  auctionInfo: DaiGoldAuctionInfo
) => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [hourlyMetrics, setHourlyMetrics] = useState<Metric[]>([]);

  const fetchData = async () => {
    console.log('fetching epoch', auctionInfo.currentEpoch);
    if (!auctionInfo.currentEpoch) {
      return;
    }

    try {
      const response = await subgraphQuery<SubgraphResponse>(
        env.subgraph.spiceBazaar.eth, // stable/gold auctions only on eth network
        priceHistory(auctionInfo.currentEpoch.toString())
      );

      // TODO: Still need to fill in missing days
      const normalizedDailyMetrics =
        response.stableGoldAuctionInstances[0].auctionInstanceDailySnapshots.map(
          (snapshot) => ({
            timestamp: parseInt(snapshot.timeframe, 10) * 1000,
            price: parseFloat(snapshot.totalBidTokenAmount),
          })
        );

      const hourlyMetricsFromResponse =
        response.stableGoldAuctionInstances[0].auctionInstanceHourlySnapshots.map(
          (snapshot) => ({
            timestamp: parseInt(snapshot.timeframe, 10) * 1000,
            price: parseFloat(snapshot.price),
          })
        );

      setMetrics(normalizedDailyMetrics);
      setHourlyMetrics(hourlyMetricsFromResponse);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { dailyMetrics: metrics, hourlyMetrics };
};
