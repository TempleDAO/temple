import { useSubgraphRequest } from 'hooks/use-subgraph-request';
import { useEffect, useState } from 'react';
import { SubGraphResponse } from './core/types';
import env from 'constants/env';

interface IAnalytics {
  treasuryValue: number;
  circulatingMarketCap: number;
  fullyDilutedValuation: number;
  circulatingTempleSupply: number;
  fullyDilutedTempleSupply: number;
}

type IAnalyticsResponse = SubGraphResponse<{
  protocolMetrics: [
    {
      totalValueLocked: number;
      crvRewards: number;
      cvxRewards: number;
      templeSupply: number;
      templePrice: number;
      templeCirculatingSupply: number;
      marketCap: number;
    }
  ];
}>;

const QUERY = `{
  protocolMetrics(first: 1, orderBy: timestamp, orderDirection: desc) {
    totalValueLocked
    templeSupply
    templePrice
    templeCirculatingSupply
    marketCap
  }
}`;

export const useAnalytics = () => {
  const [isLoading, setIsLoading] = useState(true);

  const [analytics, setAnalytics] = useState<IAnalytics>({
    treasuryValue: 0,
    circulatingMarketCap: 0,
    fullyDilutedValuation: 0,
    circulatingTempleSupply: 0,
    fullyDilutedTempleSupply: 0,
  });

  const [request, { response, error }] = useSubgraphRequest<IAnalyticsResponse>(
    env.subgraph.protocolMetrics,
    {
      query: QUERY,
    }
  );

  useEffect(() => {
    const requestProtocolData = async () => {
      await request();
      setIsLoading(false);
    };

    requestProtocolData();
  }, [request]);

  useEffect(() => {
    if (response?.data) {
      const protocolData = response.data.protocolMetrics[0];
      setAnalytics({
        treasuryValue: protocolData.totalValueLocked,
        circulatingMarketCap:
          protocolData.templeCirculatingSupply * protocolData.templePrice,
        fullyDilutedValuation:
          protocolData.templeSupply * protocolData.templePrice,
        fullyDilutedTempleSupply: protocolData.templeSupply,
        circulatingTempleSupply: protocolData.templeCirculatingSupply,
      });
    }
  }, [response]);

  return {
    isLoading,
    analytics,
    error,
  };
};
