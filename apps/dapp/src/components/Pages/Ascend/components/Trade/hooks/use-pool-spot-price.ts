import { useEffect, useState } from 'react';
import { useContractReads } from 'wagmi';

import { BigNumber } from 'ethers';

import balancerPoolAbi from 'data/abis/balancerPool.json';
import balancerVaultAbi from 'data/abis/balancerVault.json';

import { formatBigNumber, getBigNumberFromString } from 'components/Vault/utils';
import { ZERO } from 'utils/bigNumber';
import { Pool } from 'components/Layouts/Ascend/types';

const getSpotPrice = (
  balanceSell: BigNumber,
  balanceBuy: BigNumber,
  weightSell: BigNumber,
  weightBuy: BigNumber,
  swapFee: BigNumber,
): BigNumber => {
  const bs = parseFloat(formatBigNumber(balanceSell));
  const bb = parseFloat(formatBigNumber(balanceBuy));
  const ws = parseFloat(formatBigNumber(weightSell));
  const wb = parseFloat(formatBigNumber(weightBuy));

  const price = (bs / ws) / (bb / wb);
  const fee = (1 / (1 - parseFloat(formatBigNumber(swapFee))));
  const spot = getBigNumberFromString(`${price * fee}`);
  console.log(formatBigNumber(spot))
  return spot;
};

export const usePoolSpotPrice = (
  sellToken: string,
  buyToken: string,
  pool: Pool,
  vaultContractAddress?: string,
) => {
  const [spotPrice, setSpotPrice] = useState<BigNumber>();
  console.log('pool', pool)
  const { data: spotPriceData, isLoading, error } = useContractReads({
    contracts: [{
      addressOrName: vaultContractAddress || '',
      contractInterface: balancerVaultAbi,
      functionName: 'getPoolTokens',
      args: [pool.id],
    }, {
      addressOrName: pool.address,
      contractInterface: balancerPoolAbi,
      functionName: 'getNormalizedWeights',
    }, {
      addressOrName: pool.address,
      contractInterface: balancerPoolAbi,
      functionName: 'getSwapFeePercentage',
    }],
    enabled: !!vaultContractAddress
  });
  
  useEffect(() => {
    if (!spotPriceData) {
      return;
    }

    const [tokens, weights, swapFee] = spotPriceData;
    const balances = tokens.balances;
    const indexOfSell = pool.tokensList.findIndex((address) => sellToken === address);
    const indexOfBuy = pool.tokensList.findIndex((address) => buyToken === address);

    setSpotPrice(
      getSpotPrice(
        balances[indexOfSell],
        balances[indexOfBuy],
        weights[indexOfSell],
        weights[indexOfBuy],
        swapFee as any // swapFee is a BigNumber
      )
    );
  }, [
    pool,
    spotPriceData,
    sellToken,
    buyToken
  ]);

  return {
    isLoading,
    spotPrice,
    error,
  };
};