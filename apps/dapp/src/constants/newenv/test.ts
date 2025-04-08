import {
  DaiGoldAuction,
  DaiGoldAuction__factory,
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

const ETH_SEPOLIA: Chain = {
  name: 'Ethereum Sepolia',
  id: 11155111,
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  walletRpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
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
};

// const ARB_SEPOLIA: Chain = {
//   name: "Arbitrum Sepolia",
//   id: 421614,
//   rpcUrl: "https://sepolia-arb-rpc.publicnode.com",
//   walletRpcUrl: "https://sepolia-arb-rpc.publicnode.com",
//   nativeCurrency: {
//     // TODO: Fix
//     name: "ETH",
//     symbol: "ETH",
//     decimals: 18,
//   },
//   explorer: {
//     transactionUrl: (hash: string) =>
//       `https://sepolia-arb.arbiscan.io/tx/${hash}`,
//     tokenUrl: (hash: string) => `https://sepolia-arb.arbiscan.io/token/${hash}`,
//     contractUrl: (address: string, params: any) =>
//       `https://sepolia-arb.arbiscan.io/address/${address}` +
//       (params.writeContractMethod
//         ? `#writeContract#${params.writeContractMethod}`
//         : ""),
//   },
// };

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
  address: '0x64a925B0fA211c44337148C0807f959Bd44b0B67', //"0x98c5e61b1b3731a1f379e8770861164d23118cdc", // this the spice bazaar temple
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
  address: '0xdbDAc0FCA9cF8CA2F2Ef718775f0F265f581808F',
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

const testEnv: AppConfig = {
  chains: [ETH_SEPOLIA], //, ARB_SEPOLIA],
  tokens: {
    templeToken: TEMPLE_TOKEN_ON_ETH_SEPOLIA,
    fraxToken: FRAX_TOKEN_ON_ETH_SEPOLIA,
    templeGoldToken: TGLD_TOKEN_ON_ETH_SEPOLIA,
    ogTempleToken: OG_TEMPLE_TOKEN_ON_ETH_SEPOLIA,
    usdcToken: USDC_TOKEN_ON_ETH_SEPOLIA,
    usdtToken: USDT_TOKEN_ON_ETH_SEPOLIA,
    daiToken: DAI_TOKEN_ON_ETH_SEPOLIA,
    usdsToken: USDS_TOKEN_ON_ETH_SEPOLIA,
    wethToken: WETH_TOKEN_ON_ETH_SEPOLIA,
    ohmToken: OHM_TOKEN_ON_ETH_SEPOLIA,
  },
  contracts: {
    templeGoldStaking: TEMPLE_GOLD_STAKING_ON_ETH_SEPOLIA,
    daiGoldAuction: DAI_GOLD_AUCTION_ON_ETH_SEPOLIA,
    templeGold: TEMPLE_GOLD_ON_ETH_SEPOLIA,
    tlc: TEMPLE_LINE_OF_CREDIT_ON_ETH_SEPOLIA,
    trv: TREASURY_RESERVES_VAULT_ON_ETH_SEPOLIA,
    daiCircuitBreaker: DAI_CIRCUIT_BREAKER_CONTRACT_ON_ETH_SEPOLIA,
    templeCircuitBreaker: TEMPLE_CIRCUIT_BREAKER_CONTRACT_ON_ETH_SEPOLIA,
  },
};

export function getTestAppConfig(): AppConfig {
  return testEnv;
}
