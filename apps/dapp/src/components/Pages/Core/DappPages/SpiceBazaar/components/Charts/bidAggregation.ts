type BidForAggregation = {
  bucketIndex: number;
  bucket: string;
  price: number;
  bidAmount: string;
  isFinalBid: boolean;
};

export type AggregatedBucket = {
  bucket: string;
  bucketIndex: number;
  price: number; // average across bids in this bucket
  minPrice: number;
  maxPrice: number;
  totalBidAmount: number;
  count: number;
  maxCount: number;
  isFinalBid: boolean;
};

export type AggregatedBidChartData = {
  chartData: AggregatedBucket[];
  bucketIndices: number[];
  labelMap: Map<number, string>;
};

/**
 * Aggregates an array of bids into per-bucket summary objects suitable for
 * the DotChart. Each bucket contains the average price, total bid amount,
 * bid count, and whether the epoch's final bid fell in this bucket.
 *
 * The original bucketIndex values are preserved (not re-sequenced), so gaps
 * in bidding activity are visible on the X-axis.
 */
export function aggregateBidsByBucket(
  bids: BidForAggregation[]
): AggregatedBidChartData {
  if (!bids.length) {
    return { chartData: [], bucketIndices: [], labelMap: new Map() };
  }

  type Accumulator = {
    bucket: string;
    bucketIndex: number;
    prices: number[];
    totalBidAmount: number;
    count: number;
    isFinalBid: boolean;
  };

  const bucketMap = new Map<number, Accumulator>();

  bids.forEach((bid) => {
    const existing = bucketMap.get(bid.bucketIndex);
    if (existing) {
      existing.prices.push(bid.price);
      existing.totalBidAmount += parseFloat(bid.bidAmount);
      existing.count += 1;
      if (bid.isFinalBid) existing.isFinalBid = true;
    } else {
      bucketMap.set(bid.bucketIndex, {
        bucket: bid.bucket,
        bucketIndex: bid.bucketIndex,
        prices: [bid.price],
        totalBidAmount: parseFloat(bid.bidAmount),
        count: 1,
        isFinalBid: bid.isFinalBid,
      });
    }
  });

  const maxCount = Math.max(
    1,
    ...Array.from(bucketMap.values()).map((b) => b.count)
  );

  const chartData: AggregatedBucket[] = Array.from(bucketMap.values())
    .sort((a, b) => a.bucketIndex - b.bucketIndex)
    .map((b) => ({
      bucket: b.bucket,
      bucketIndex: b.bucketIndex,
      price: b.prices.reduce((sum, p) => sum + p, 0) / b.prices.length,
      minPrice: Math.min(...b.prices),
      maxPrice: Math.max(...b.prices),
      totalBidAmount: b.totalBidAmount,
      count: b.count,
      maxCount,
      isFinalBid: b.isFinalBid,
    }));

  const bucketIndices = chartData.map((d) => d.bucketIndex);

  const labelMap = new Map<number, string>();
  chartData.forEach((d) => {
    labelMap.set(d.bucketIndex, d.bucket);
  });

  return { chartData, bucketIndices, labelMap };
}
