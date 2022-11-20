import environmentConfig from 'constants/env';
import { Token } from 'constants/env/types';
import type { AMO__IBalancerVault } from 'types/typechain/AMO__IBalancerVault';

export const formatJoinRequestTuple = (request?: AMO__IBalancerVault.JoinPoolRequestStruct): string => {
  if (request) {
    return `[[${request.assets.map((asset) => `"${asset}"`).join(',')}],[${request.maxAmountsIn
      .map((amount) => `"${amount}"`)
      .join(',')}],"${request.userData}",false]`;
  }
  return '';
};

export const formatExitRequestTuple = (request?: AMO__IBalancerVault.ExitPoolRequestStruct): string => {
  if (request) {
    return `[[${request?.assets.map((asset) => `"${asset}"`).join(',')}],[${request?.minAmountsOut
      .map((amount) => `"${amount}"`)
      .join(',')}],"${request?.userData}",false]`;
  }
  return '';
};

export const getTokenSymbolByAddress = (tokenAddress: string): string => {
  const tokens: Token[] = Object.values(environmentConfig.tokens);
  const tokenMatch = tokens.find(({ address }) => address === tokenAddress);
  return tokenMatch && tokenMatch.symbol ? tokenMatch.symbol : tokenAddress;
};
