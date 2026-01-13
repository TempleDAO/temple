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
  TempleGoldStaking__factory,
  TempleLineOfCredit,
  TempleLineOfCredit__factory,
  TreasuryReservesVault,
  TreasuryReservesVault__factory,
} from 'types/typechain';
import { AppConfig, Chain, ContractConfig, TokenConfig } from './types';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

const ENV_VARS = import.meta.env;
const RPC_KEY = ENV_VARS.VITE_RPC_KEY;

// const ETH_SPICE_BAZAAR_SUBGRAPH_URL =
//   "https://api.goldsky.com/api/public/project_cmgzm4q1q009c5np2angrczxw/subgraphs/spice-bazaar-sepolia/test/gn";
// const BERACHAIN_SPICE_BAZAAR_SUBGRAPH_URL =
//   "https://api.goldsky.com/api/public/project_clq1l1in2hoze01x1ha1q1bui/subgraphs/spice-bazaar-bepolia/main/gn";
const ARBIBRUM_SPICE_BAZAAR_SUBGRAPH_URL =
  'https://api.goldsky.com/api/public/project_cmgzm4q1q009c5np2angrczxw/subgraphs/spice-bazaar-arb-sepolia/test/gn';

const ETH_SEPOLIA: Chain = {
  name: 'Ethereum Sepolia',
  id: 11155111,
  rpcUrl: `https://ethereum-sepolia-rpc.publicnode.com/${RPC_KEY}`,
  walletRpcUrl: `https://ethereum-sepolia-rpc.publicnode.com/${RPC_KEY}`,
  nativeCurrency: {
    name: 'SepoliaETH',
    symbol: 'SepoliaETH',
    decimals: 18,
  },
  explorer: {
    transactionUrl: (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`,
    tokenUrl: (hash: string) => `https://sepolia.etherscan.io/token/${hash}`,
    contractUrl: (address: string, params: any) =>
      `https://sepolia.etherscan.io/address/${address}` +
      (params.writeContractMethod
        ? `#writeContract#${params.writeContractMethod}`
        : ''),
  },
  layer0EndpointId: 40161,
};

const BERACHAIN_BEPOLIA: Chain = {
  name: 'Berachain BePolia',
  id: 80069,
  rpcUrl: 'https://bepolia.rpc.berachain.com',
  walletRpcUrl: 'https://bepolia.rpc.berachain.com',
  nativeCurrency: {
    name: 'BERA',
    symbol: 'BERA',
    decimals: 18,
  },
  explorer: {
    transactionUrl: (hash: string) =>
      `https://bepolia.berachain.com/tx/${hash}`,
    tokenUrl: (hash: string) => `https://bepolia.berachain.com/token/${hash}`,
    contractUrl: (address: string, params: any) =>
      `https://bepolia.berachain.com/address/${address}` +
      (params.writeContractMethod
        ? `#writeContract#${params.writeContractMethod}`
        : ''),
  },
  layer0EndpointId: 40371,
};

const ARB_SEPOLIA: Chain = {
  name: 'Arbitrum Sepolia',
  id: 421614,
  rpcUrl: `https://arbitrum-sepolia-rpc.publicnode.com/${RPC_KEY}`,
  walletRpcUrl: `https://arbitrum-sepolia-rpc.publicnode.com/${RPC_KEY}`,
  nativeCurrency: {
    name: 'Arbitrum Sepolia ETH',
    symbol: 'ArbSepoliaETH',
    decimals: 18,
  },
  explorer: {
    transactionUrl: (hash: string) => `https://sepolia.arbiscan.io/tx/${hash}`,
    tokenUrl: (hash: string) => `https://sepolia.arbiscan.io/token/${hash}`,
    contractUrl: (address: string, params: any) =>
      `https://sepolia.arbiscan.io/address/${address}` +
      (params.writeContractMethod
        ? `#writeContract#${params.writeContractMethod}`
        : ''),
  },
  layer0EndpointId: 40231,
};

////////////////////////////////////////////////////////////
// TOKENS
////////////////////////////////////////////////////////////

const TGLD_TOKEN_ON_ETH_SEPOLIA: TokenConfig = {
  chainId: ETH_SEPOLIA.id,
  name: 'Temple Gold',
  address: '0x2ae6318e34bb97ae3755AFcE75559452aA223A5D',
  decimals: 18,
  symbol: 'TGLD',
};

const TGLD_TOKEN_ON_BERACHAIN_BEPOLIA: TokenConfig = {
  chainId: BERACHAIN_BEPOLIA.id,
  name: 'Temple Gold',
  address: '0x20ceB4504a9e7eda0491ab6356A5EfC419002df9',
  decimals: 18,
  symbol: 'TGLD',
};

const SPICE_TOKEN_ON_BERACHAIN_BEPOLIA: TokenConfig = {
  chainId: BERACHAIN_BEPOLIA.id,
  name: 'Spice',
  address: '0x21F980E0B3b484eB361626e0098AA9741A1221cb',
  decimals: 18,
  symbol: 'SPICE',
};

// For example we can have tokens on other chains
// And the provider API and other code can support it
// const GMX_TOKEN_ON_ARBITRUM_SEPOLIA: TokenConfig = {
//   chainId: ARB_SEPOLIA.id,
//   name: "GMX",
//   address: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
//   decimals: 18,
//   symbol: "GMX",
// };

const TEMPLE_TOKEN_ON_ETH_SEPOLIA: TokenConfig = {
  chainId: ETH_SEPOLIA.id,
  name: 'Temple',
  address: '0x64a925B0fA211c44337148C0807f959Bd44b0B67',
  decimals: 18,
  symbol: 'TEMPLE',
};

const FRAX_TOKEN_ON_ETH_SEPOLIA: TokenConfig = {
  chainId: ETH_SEPOLIA.id,
  name: 'FRAX',
  address: '0x73651AD693531F9937528009cC204a4d9b696a68',
  decimals: 18,
  symbol: 'FRAX',
};

const OG_TEMPLE_TOKEN_ON_ETH_SEPOLIA: TokenConfig = {
  chainId: ETH_SEPOLIA.id,
  name: 'OG Temple',
  address: '', //"0x07d6c81fce4263ddeb0610c217c673b315e766f1",
  decimals: 18,
  symbol: 'OGTEMPLE',
};

const USDC_TOKEN_ON_ETH_SEPOLIA: TokenConfig = {
  chainId: ETH_SEPOLIA.id,
  name: 'USDC',
  address: '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
  decimals: 18,
  symbol: 'USDC',
};

const DAI_TOKEN_ON_ETH_SEPOLIA: TokenConfig = {
  chainId: ETH_SEPOLIA.id,
  name: 'DAI',
  address: '0x33FA9618365F67c5345066d5Cfd7f3A2f183599A', //0x33FA9618365F67c5345066d5Cfd7f3A2f183599A addres
  decimals: 18,
  symbol: 'DAI',
};

const USDS_TOKEN_ON_ETH_SEPOLIA: TokenConfig = {
  chainId: ETH_SEPOLIA.id,
  name: 'USDS',
  address: '0xBe9162230D9e637218D74C7f41f62ef2385fEe64',
  decimals: 18,
  symbol: 'USDS',
};

const WETH_TOKEN_ON_ETH_SEPOLIA: TokenConfig = {
  chainId: ETH_SEPOLIA.id,
  name: 'WETH',
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  decimals: 18,
  symbol: 'WETH',
};

const USDT_TOKEN_ON_ETH_SEPOLIA: TokenConfig = {
  chainId: ETH_SEPOLIA.id,
  name: 'USDT',
  address: '',
  decimals: 18,
  symbol: 'USDT',
};

const OHM_TOKEN_ON_ETH_SEPOLIA: TokenConfig = {
  chainId: ETH_SEPOLIA.id,
  name: 'OHM',
  address: '',
  decimals: 18,
  symbol: 'OHM',
};

const TGLD_TOKEN_ON_ARBITRUM_SEPOLIA: TokenConfig = {
  chainId: ARB_SEPOLIA.id,
  name: 'Temple Gold',
  address: '0xca3e16f6f204D221193EF83eC3d67B5A957C032c',
  decimals: 18,
  symbol: 'TGLD',
};

////////////////////////////////////////////////////////////
// CONTRACTS
////////////////////////////////////////////////////////////

const DAI_GOLD_AUCTION_ON_ETH_SEPOLIA: ContractConfig<DaiGoldAuction> = {
  chainId: ETH_SEPOLIA.id,
  address: '0x8d3671d794d511Bb0E3D28e260F8E2233C0653aB',
  contractFactory: DaiGoldAuction__factory,
};

const TEMPLE_GOLD_STAKING_ON_ETH_SEPOLIA: ContractConfig<TempleGoldStaking> = {
  chainId: ETH_SEPOLIA.id,
  address: '0x36061ce3Ac2F5d69667F0c7B98Ec6021ef33b8cB',
  contractFactory: TempleGoldStaking__factory,
};

const TEMPLE_GOLD_ON_ETH_SEPOLIA: ContractConfig<TempleGold> = {
  chainId: ETH_SEPOLIA.id,
  address: '0x2ae6318e34bb97ae3755afce75559452aa223a5d',
  contractFactory: TempleGold__factory,
};

const TEMPLE_LINE_OF_CREDIT_ON_ETH_SEPOLIA: ContractConfig<TempleLineOfCredit> =
  {
    chainId: ETH_SEPOLIA.id,
    address: '0xAe0A4a7690F5f308C6615E3738243Ab629DaEAEA',
    contractFactory: TempleLineOfCredit__factory,
  };

const TREASURY_RESERVES_VAULT_ON_ETH_SEPOLIA: ContractConfig<TreasuryReservesVault> =
  {
    chainId: ETH_SEPOLIA.id,
    address: '0x7f19419488274bcC363d93F70809cDd53C788aF7',
    contractFactory: TreasuryReservesVault__factory,
  };

const DAI_CIRCUIT_BREAKER_CONTRACT_ON_ETH_SEPOLIA: ContractConfig<TempleCircuitBreakerAllUsersPerPeriod> =
  {
    chainId: ETH_SEPOLIA.id,
    address: '0x30AC664062f58b6E4DF187713a2352385633B739',
    contractFactory: TempleCircuitBreakerAllUsersPerPeriod__factory,
  };

const TEMPLE_CIRCUIT_BREAKER_CONTRACT_ON_ETH_SEPOLIA: ContractConfig<TempleCircuitBreakerAllUsersPerPeriod> =
  {
    chainId: ETH_SEPOLIA.id,
    address: '0x8f783c4A3d90712A794d5660b632AC67611852aF',
    contractFactory: TempleCircuitBreakerAllUsersPerPeriod__factory,
  };

const SPICE_AUCTION_FACTORY_ON_ETH_SEPOLIA: ContractConfig<SpiceAuctionFactory> =
  {
    chainId: ETH_SEPOLIA.id,
    address: '0x3c84E8848C2D78107630c367500d79E8E6975be4',
    contractFactory: SpiceAuctionFactory__factory,
  };

const SPICE_AUCTION_ON_ETH_SEPOLIA: ContractConfig<SpiceAuction> = {
  chainId: ETH_SEPOLIA.id,
  address: '0xee46c5826cb312b1a80f7a6d1af795488941dbd0',
  contractFactory: SpiceAuction__factory,
};

const SPICE_AUCTION_ON_BERACHAIN_BEPOLIA: ContractConfig<SpiceAuction> = {
  chainId: BERACHAIN_BEPOLIA.id,
  address: '0x72D7C9c5E0A187A06E4D1508ceA77dE17db07953',
  contractFactory: SpiceAuction__factory,
};

const SPICE_AUCTION_ON_ARBITRUM_SEPOLIA: ContractConfig<SpiceAuction> = {
  chainId: ARB_SEPOLIA.id,
  address: '0x41fFE184C981cA5A9F1453e707c179079aC3A551',
  contractFactory: SpiceAuction__factory,
};

const TEMPLE_GOLD_ON_BERACHAIN_BEPOLIA: ContractConfig<TempleGold> = {
  chainId: BERACHAIN_BEPOLIA.id,
  address: '0x20ceB4504a9e7eda0491ab6356A5EfC419002df9',
  contractFactory: TempleGold__factory,
};

const TEMPLE_GOLD_ON_ARBITRUM_SEPOLIA: ContractConfig<TempleGold> = {
  chainId: ARB_SEPOLIA.id,
  address: '0xca3e16f6f204D221193EF83eC3d67B5A957C032c',
  contractFactory: TempleGold__factory,
};

const SPICE_TOKEN_ON_ARBITRUM_SEPOLIA: TokenConfig = {
  chainId: ARB_SEPOLIA.id,
  name: 'Spice',
  address: '0xe56B2431198CabFaBc1aF5D413c8239c8615E816',
  decimals: 18,
  symbol: 'SPICE',
};

const testEnv: AppConfig = {
  chains: [ETH_SEPOLIA, BERACHAIN_BEPOLIA, ARB_SEPOLIA],
  tokens: {
    templeToken: TEMPLE_TOKEN_ON_ETH_SEPOLIA,
    fraxToken: FRAX_TOKEN_ON_ETH_SEPOLIA,
    ogTempleToken: OG_TEMPLE_TOKEN_ON_ETH_SEPOLIA,
    usdcToken: USDC_TOKEN_ON_ETH_SEPOLIA,
    usdtToken: USDT_TOKEN_ON_ETH_SEPOLIA,
    daiToken: DAI_TOKEN_ON_ETH_SEPOLIA,
    usdsToken: USDS_TOKEN_ON_ETH_SEPOLIA,
    wethToken: WETH_TOKEN_ON_ETH_SEPOLIA,
    ohmToken: OHM_TOKEN_ON_ETH_SEPOLIA,
    // Eth chain
    templeGoldToken: TGLD_TOKEN_ON_ETH_SEPOLIA,
    // Berachain
    templeGoldTokenBerachain: TGLD_TOKEN_ON_BERACHAIN_BEPOLIA,
    spiceTokenBerachain: SPICE_TOKEN_ON_BERACHAIN_BEPOLIA,
    // Arbitrum
    templeGoldTokenArbitrum: TGLD_TOKEN_ON_ARBITRUM_SEPOLIA,
    spiceTokenArbitrum: SPICE_TOKEN_ON_ARBITRUM_SEPOLIA,
  },
  contracts: {
    templeGoldStaking: TEMPLE_GOLD_STAKING_ON_ETH_SEPOLIA,
    daiGoldAuction: DAI_GOLD_AUCTION_ON_ETH_SEPOLIA,
    templeGold: TEMPLE_GOLD_ON_ETH_SEPOLIA,
    templeGoldBerachain: TEMPLE_GOLD_ON_BERACHAIN_BEPOLIA,
    templeGoldArbitrum: TEMPLE_GOLD_ON_ARBITRUM_SEPOLIA,
    tlc: TEMPLE_LINE_OF_CREDIT_ON_ETH_SEPOLIA,
    trv: TREASURY_RESERVES_VAULT_ON_ETH_SEPOLIA,
    daiCircuitBreaker: DAI_CIRCUIT_BREAKER_CONTRACT_ON_ETH_SEPOLIA,
    templeCircuitBreaker: TEMPLE_CIRCUIT_BREAKER_CONTRACT_ON_ETH_SEPOLIA,
  },
  spiceBazaar: {
    // TODO: For now, we only have one active spice auction. Eventually, could be many. So we use an array.
    spiceAuctions: [
      {
        isActive: true,
        name: 'Test ARB TGLD Auction',
        chainId: ARB_SEPOLIA.id,
        auctionTokenSymbol: 'SPICE',
        auctionToken: SPICE_TOKEN_ON_ARBITRUM_SEPOLIA,
        templeGoldToken: TGLD_TOKEN_ON_ARBITRUM_SEPOLIA,
        templeGoldTokenBalanceTickerSymbol:
          TICKER_SYMBOL.TEMPLE_GOLD_TOKEN_ARBITRUM,
        contractConfig: SPICE_AUCTION_ON_ARBITRUM_SEPOLIA,
        subgraphUrl: ARBIBRUM_SPICE_BAZAAR_SUBGRAPH_URL,
      },
    ],
    tgldBridge: {
      active: true,
      sourceLayer0EndpointId: ETH_SEPOLIA.layer0EndpointId,
      sourceTgldTokenContract: TEMPLE_GOLD_ON_ETH_SEPOLIA,
      altchainLayer0EndpointId: ARB_SEPOLIA.layer0EndpointId, // TODO: Possibly other altchains? Object?
      altchainTgldTokenContract: TEMPLE_GOLD_ON_ARBITRUM_SEPOLIA,
      altchainTgldTokenKey: TICKER_SYMBOL.TEMPLE_GOLD_TOKEN_ARBITRUM,
      altchainDisplayName: 'Arbitrum',
    },
  },
};

export function getTestAppConfig(): AppConfig {
  return testEnv;
}
