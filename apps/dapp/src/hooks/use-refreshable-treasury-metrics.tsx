import { useEffect, useState } from 'react';
import useInterval from 'use-interval';
import { TreasuryMetrics } from 'services/MetricsService';
import { fetchGenericSubgraph, fetchSubgraph } from 'utils/subgraph';
import env from 'constants/env';
import { FALLBACK_VAULT_APY } from 'components/Pages/Core/Trade/constants';

export default function useRefreshableTreasuryMetrics() {
  const [treasuryMetrics, setTreasuryMetrics] =
    useState<TreasuryMetrics | null>(null);

  async function getDynamicApy(): Promise<number> {
    try {
      const TOTAL_FARM_EARNINGS_QUERY = `{
        dayProtocolMetrics(orderBy: timestamp, orderDirection: desc, first: 14) {
          totalFarmEarnings
        }
      }
      `;

      const farmEarningsResult = await fetchSubgraph<any>(
        TOTAL_FARM_EARNINGS_QUERY
      );

      const day1Earnings =
        farmEarningsResult?.data?.dayProtocolMetrics[13].totalFarmEarnings;
      const day14Earnings =
        farmEarningsResult?.data?.dayProtocolMetrics[0].totalFarmEarnings;
      const dailyEarnings = (day14Earnings - day1Earnings) / 14;

      const VAULT_TVL_QUERY = `{
        vaultGroup(id: "1m-core") {
          tvlUSD
        }
      }`;

      const totalLockedQueryResult = await fetchGenericSubgraph<any>(
        env.subgraph.templeCore,
        VAULT_TVL_QUERY
      );

      const tvl = totalLockedQueryResult?.data?.vaultGroup?.tvlUSD;
      const apr = (dailyEarnings / tvl) * 365 * 100;
      const apy = ((1 + apr / 100 / 13) ** 13 - 1) * 100;

      return Math.floor(apy);
    } catch (error) {
      console.error(error);
      return FALLBACK_VAULT_APY;
    }
  }

  async function getTreasuryMetrics(): Promise<TreasuryMetrics> {
    const response = await fetchSubgraph<any>(
      `{
          protocolMetrics(first: 1, orderBy: timestamp, orderDirection: desc) {
            lockedStables
            epochPercentageYield
            templePrice
          }
        }`
    );

    const data = response?.data?.protocolMetrics?.[0] || {};

    const epy = parseFloat(data.epochPercentageYield);
    const templeApy = Math.round((Math.pow(epy + 1, 365.25) - 1) * 100);
    const templePrice = parseFloat(data.templePrice);
    const lockedStables = parseFloat(data.lockedStables);
    const dynamicVaultApy = await getDynamicApy();

    return {
      templeValue: templePrice,
      templeApy,
      treasuryValue: lockedStables,
      dynamicVaultApy,
    };
  }

  async function refreshMetrics() {
    try {
      const treasuryMetrics = await getTreasuryMetrics();
      setTreasuryMetrics(treasuryMetrics);
    } catch (error) {
      console.info(error);
    }
  }

  const clearInterval = useInterval(refreshMetrics, 5 * 60 * 1000, true);

  // clear interval on unmount
  useEffect(() => clearInterval, [clearInterval]);

  return treasuryMetrics;
}
