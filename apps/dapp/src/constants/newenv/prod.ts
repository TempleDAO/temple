import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { AppConfig, Chain, ContractConfig, TokenConfig } from './types';
import {
  DaiGoldAuction,
  DaiGoldAuction__factory,
  SpiceAuction,
  SpiceAuction__factory,
  SpiceAuctionFactory,
  SpiceAuctionFactory__factory,
  TempleCircuitBreakerAllUsersPerPeriod,
  TempleCircuitBreakerAllUsersPerPeriod__factory,
  TempleGold,
  TempleGold__factory,
  TempleGoldStaking,
  TempleLineOfCredit,
  TempleLineOfCredit__factory,
  TreasuryReservesVault,
  TreasuryReservesVault__factory,
  VestingPayments,
  VestingPayments__factory,
} from 'types/typechain';
import { TempleGoldStaking__factory } from 'types/typechain';

const ENV_VARS = import.meta.env;
const RPC_KEY = ENV_VARS.VITE_RPC_KEY;

// chain config
const ETH_MAINNET: Chain = {
  name: 'Ethereum Mainnet',
  id: 1,
  rpcUrl: `https://ethereum-rpc.publicnode.com/${RPC_KEY}`,
  walletRpcUrl: `https://ethereum-rpc.publicnode.com/${RPC_KEY}`,
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  explorer: {
    transactionUrl: (hash: string) => `https://etherscan.io/tx/${hash}`,
    tokenUrl: (hash: string) => `https://etherscan.io/token/${hash}`,
    contractUrl: (address: string, params: any) =>
      `https://etherscan.io/address/${address}` +
      (params.writeContractMethod
        ? `#writeContract#${params.writeContractMethod}`
        : ''),
  },
  layer0EndpointId: 30101,
};

// TODO: Verify correctness
const BERACHAIN_MAINNET: Chain = {
  name: 'Berachain',
  id: 80069,
  rpcUrl: 'https://berachain-rpc.publicnode.com',
  walletRpcUrl: 'https://berachain-rpc.publicnode.com',
  nativeCurrency: {
    name: 'BERA',
    symbol: 'BERA',
    decimals: 18,
  },
  explorer: {
    transactionUrl: (hash: string) => `https://berachain.com/tx/${hash}`,
    tokenUrl: (hash: string) => `https://berachain.com/token/${hash}`,
    contractUrl: (address: string, params: any) =>
      `https://berachain.com/address/${address}` +
      (params.writeContractMethod
        ? `#writeContract#${params.writeContractMethod}`
        : ''),
  },
  layer0EndpointId: 30362,
};

////////////////////////////////////////////////////////////
// TOKENS
////////////////////////////////////////////////////////////

const TGLD_TOKEN_ON_ETH_MAINNET: TokenConfig = {
  chainId: ETH_MAINNET.id,
  name: 'Temple Gold',
  address: '0x0E7B53dDe30754A94D4B10C9CdCaCA1C749ECd1b',
  decimals: 18,
  symbol: 'TGLD',
};

const OG_TEMPLE_TOKEN_ON_ETH_MAINNET: TokenConfig = {
  chainId: ETH_MAINNET.id,
  name: 'OG Temple',
  address: '0x654590F810f01B51dc7B86915D4632977e49EA33',
  decimals: 18,
  symbol: 'OGTEMPLE',
};

// const GMX_TOKEN_ON_ARBITRUM_MAINNET: TokenConfig<GMXToken> = {
//   chainId: ARB_MAINNET.id,
//   name: "GMX",
//   address: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
//   decimals: 18,
//   symbol: "GMX",
// };

const FRAX_TOKEN_ON_ETH_MAINNET: TokenConfig = {
  chainId: ETH_MAINNET.id,
  name: 'FRAX',
  address: '0x853d955acef822db058eb8505911ed77f175b99e',
  decimals: 18,
  symbol: 'FRAX',
};

const TEMPLE_TOKEN_ON_ETH_MAINNET: TokenConfig = {
  chainId: ETH_MAINNET.id,
  name: 'Temple',
  address: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
  decimals: 18,
  symbol: 'TEMPLE',
};

const USDC_TOKEN_ON_ETH_MAINNET: TokenConfig = {
  chainId: ETH_MAINNET.id,
  name: 'USDC',
  address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  decimals: 18,
  symbol: 'USDC',
};

const USDT_TOKEN_ON_ETH_MAINNET: TokenConfig = {
  chainId: ETH_MAINNET.id,
  name: 'USDT',
  address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  decimals: 18,
  symbol: 'USDT',
};

const DAI_TOKEN_ON_ETH_MAINNET: TokenConfig = {
  chainId: ETH_MAINNET.id,
  name: 'DAI',
  address: '0x6b175474e89094c44da98b954eedeac495271d0f',
  decimals: 18,
  symbol: 'DAI',
};

const USDS_TOKEN_ON_ETH_MAINNET: TokenConfig = {
  chainId: ETH_MAINNET.id,
  name: 'USDS',
  address: '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
  decimals: 18,
  symbol: 'USDS',
};

const WETH_TOKEN_ON_ETH_MAINNET: TokenConfig = {
  chainId: ETH_MAINNET.id,
  name: 'WETH',
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  decimals: 18,
  symbol: 'WETH',
};

const OHM_TOKEN_ON_ETH_MAINNET: TokenConfig = {
  chainId: ETH_MAINNET.id,
  name: 'OHM',
  address: '0x64aa3364f17a4d01c6f1751fd97c2bd3d7e7f1d5',
  decimals: 18,
  symbol: 'OHM',
};

////////////////////////////////////////////////////////////
// CONTRACTS
////////////////////////////////////////////////////////////

const TEMPLE_GOLD_STAKING_ON_ETH_MAINNET: ContractConfig<TempleGoldStaking> = {
  address: '0x64866d080CfEf0e45A3a64A558dA6eEAD7542657',
  contractFactory: TempleGoldStaking__factory,
  chainId: ETH_MAINNET.id,
};

const DAIGOLD_AUCTION_ON_ETH_MAINNET: ContractConfig<DaiGoldAuction> = {
  chainId: ETH_MAINNET.id,
  address: '0x0bC14503c467CB675b6B30da05Dbed80C83d154e',
  contractFactory: DaiGoldAuction__factory,
};

const TEMPLE_GOLD_ON_ETH_MAINNET: ContractConfig<TempleGold> = {
  chainId: ETH_MAINNET.id,
  address: '0x0E7B53dDe30754A94D4B10C9CdCaCA1C749ECd1b',
  contractFactory: TempleGold__factory,
};

const TLC_ON_ETH_MAINNET: ContractConfig<TempleLineOfCredit> = {
  chainId: ETH_MAINNET.id,
  address: '0xcbc0A8d5C7352Fe3625614ea343019e6d6b89031',
  contractFactory: TempleLineOfCredit__factory,
};

const TRV_ON_ETH_MAINNET: ContractConfig<TreasuryReservesVault> = {
  chainId: ETH_MAINNET.id,
  address: '0xf359Bae7b6AD295724e798A3Ef6Fa5109919F399',
  contractFactory: TreasuryReservesVault__factory,
};

const DAICIRCUITBREAKER_ON_ETH_MAINNET: ContractConfig<TempleCircuitBreakerAllUsersPerPeriod> =
  {
    chainId: ETH_MAINNET.id,
    address: '0x02607d6bc3146bb3d3022e991ef54f545988fb7b',
    contractFactory: TempleCircuitBreakerAllUsersPerPeriod__factory,
  };

const TEMPLECIRCUITBREAKER_ON_ETH_MAINNET: ContractConfig<TempleCircuitBreakerAllUsersPerPeriod> =
  {
    chainId: ETH_MAINNET.id,
    address: '0x0745D453A19DfEAd0e5fd350a231D878F5c71b8D',
    contractFactory: TempleCircuitBreakerAllUsersPerPeriod__factory,
  };

// TODO: Prod address
const SPICE_AUCTION_FACTORY_ON_ETH_MAINNET: ContractConfig<SpiceAuctionFactory> =
  {
    chainId: ETH_MAINNET.id,
    address: '0x0000000000000000000000000000000000000000',
    contractFactory: SpiceAuctionFactory__factory,
  };

// TODO: Prod address
const SPICE_AUCTION_ON_ETH_MAINNET: ContractConfig<SpiceAuction> = {
  chainId: ETH_MAINNET.id,
  address: '0x0000000000000000000000000000000000000000',
  contractFactory: SpiceAuction__factory,
};

const prodEnv: AppConfig = {
  chains: [ETH_MAINNET, BERACHAIN_MAINNET],
  tokens: {
    templeToken: TEMPLE_TOKEN_ON_ETH_MAINNET,
    fraxToken: FRAX_TOKEN_ON_ETH_MAINNET,
    templeGoldToken: TGLD_TOKEN_ON_ETH_MAINNET,
    ogTempleToken: OG_TEMPLE_TOKEN_ON_ETH_MAINNET,
    usdcToken: USDC_TOKEN_ON_ETH_MAINNET,
    usdtToken: USDT_TOKEN_ON_ETH_MAINNET,
    daiToken: DAI_TOKEN_ON_ETH_MAINNET,
    usdsToken: USDS_TOKEN_ON_ETH_MAINNET,
    wethToken: WETH_TOKEN_ON_ETH_MAINNET,
    ohmToken: OHM_TOKEN_ON_ETH_MAINNET,
    templeGoldTokenBerachain: TGLD_TOKEN_ON_ETH_MAINNET, // TODO: fix
    spiceTokenBerachain: TEMPLE_TOKEN_ON_ETH_MAINNET, // TODO: fix
    templeGoldTokenArbitrum: TGLD_TOKEN_ON_ETH_MAINNET, // TODO: fix
    spiceTokenArbitrum: TEMPLE_TOKEN_ON_ETH_MAINNET, // TODO: fix
  },
  contracts: {
    templeGoldStaking: TEMPLE_GOLD_STAKING_ON_ETH_MAINNET,
    daiGoldAuction: DAIGOLD_AUCTION_ON_ETH_MAINNET,
    templeGold: TEMPLE_GOLD_ON_ETH_MAINNET,
    templeGoldBerachain: TEMPLE_GOLD_ON_ETH_MAINNET, // TODO: fix
    templeGoldArbitrum: TEMPLE_GOLD_ON_ETH_MAINNET, // TODO: fix
    tlc: TLC_ON_ETH_MAINNET,
    trv: TRV_ON_ETH_MAINNET,
    daiCircuitBreaker: DAICIRCUITBREAKER_ON_ETH_MAINNET,
    templeCircuitBreaker: TEMPLECIRCUITBREAKER_ON_ETH_MAINNET,
    vestingPayments: {
      // TODO: Add production VestingPayments contract address
      chainId: ETH_MAINNET.id,
      address: '0x0000000000000000000000000000000000000000',
      contractFactory: VestingPayments__factory,
    },
  },
  spiceBazaar: {
    spiceAuctions: [
      // { TODO
      //   chainId: ETH_MAINNET.id,
      //   address: "0x0000000000000000000000000000000000000000",
      //   contractFactory: SpiceAuctionFactory__factory,
      //   auctionTokenSymbol: "DAI",
      // },
    ],
    tgldBridge: {
      active: false,
      sourceLayer0EndpointId: ETH_MAINNET.layer0EndpointId,
      sourceTgldTokenContract: TEMPLE_GOLD_ON_ETH_MAINNET,
      altchainLayer0EndpointId: BERACHAIN_MAINNET.layer0EndpointId,
      altchainTgldTokenContract: TEMPLE_GOLD_ON_ETH_MAINNET, // TODO: fix (berachain)
      altchainTgldTokenKey: TICKER_SYMBOL.TEMPLE_GOLD_TOKEN_BERACHAIN,
      altchainDisplayName: 'Berachain',
    },
  },
  vesting: {
    // TODO: Add production vesting subgraph URL
    subgraphUrl: '',
  },
};

export function getProdAppConfig(): AppConfig {
  return prodEnv;
}
