import {
  ARBITRUM_CHAIN,
  ARBITRUM_GOERLI_CHAIN,
  ChainDefinition,
  LOCAL_CHAIN,
  MAINNET_CHAIN,
  SEPOLIA_CHAIN,
} from './chains';

export const ENV_CHAIN_MAPPING = new Map<string, ChainDefinition>();

const APP_CHAINS = [
  MAINNET_CHAIN,
  SEPOLIA_CHAIN,
  LOCAL_CHAIN,
  ARBITRUM_CHAIN,
  ARBITRUM_GOERLI_CHAIN,
];

export const getChainById = (id: string) => {
  const _id = parseInt(id, 16);
  return (
    (APP_CHAINS.find(
      (chainDefinition) => chainDefinition.id === _id
    ) as ChainDefinition) || MAINNET_CHAIN
  );
};

export const APP_CHAINS_FOR_WEB3_INIT = APP_CHAINS.map((chainDefinition) => ({
  id: `0x${chainDefinition.id.toString(16)}`,
  token: chainDefinition.token,
  label: chainDefinition.label,
  rpcUrl: chainDefinition.rpcUrl,
}));

ENV_CHAIN_MAPPING.set('production', MAINNET_CHAIN);
ENV_CHAIN_MAPPING.set('preview', SEPOLIA_CHAIN);
ENV_CHAIN_MAPPING.set('local', LOCAL_CHAIN);

export const isSupportedChain = (chainId: number) => {
  return Array.from(ENV_CHAIN_MAPPING).some(
    ([_, chainDefinition]) => chainDefinition.id === chainId
  );
};

export const FEATURE_ENV_CHAIN_MAPPING = new Map<
  string,
  Map<string, ChainDefinition>
>();

export const featureChainMapping = (
  feature: string,
  env: string
): ChainDefinition => {
  console.log('Inside featureChainMapping');
  console.log('feature', feature);
  console.log('env', env);

  const featureMap = FEATURE_ENV_CHAIN_MAPPING.get(feature);
  if (!featureMap) {
    return ENV_CHAIN_MAPPING.get(env) || MAINNET_CHAIN;
  }
  return featureMap.get(env) || ENV_CHAIN_MAPPING.get(env) || MAINNET_CHAIN;
};

FEATURE_ENV_CHAIN_MAPPING.set(
  'trade',
  new Map([
    ['production', MAINNET_CHAIN],
    ['preview', SEPOLIA_CHAIN],
    ['local', LOCAL_CHAIN],
  ])
);

FEATURE_ENV_CHAIN_MAPPING.set(
  'borrow',
  new Map([
    ['production', MAINNET_CHAIN],
    ['preview', SEPOLIA_CHAIN],
    ['local', LOCAL_CHAIN],
  ])
);

FEATURE_ENV_CHAIN_MAPPING.set(
  'ohmage',
  new Map([
    ['production', MAINNET_CHAIN],
    ['preview', SEPOLIA_CHAIN],
    ['local', LOCAL_CHAIN],
  ])
);

FEATURE_ENV_CHAIN_MAPPING.set(
  'legacy',
  new Map([
    ['production', MAINNET_CHAIN],
    ['preview', SEPOLIA_CHAIN],
    ['local', LOCAL_CHAIN],
  ])
);

// FEATURE_ENV_CHAIN_MAPPING.set('legacy', new Map([
//   ['production', ARBITRUM_CHAIN],
//   ['preview', ARBITRUM_GOERLI_CHAIN],
//   ['local', LOCAL_CHAIN],
// ]));
