import { ethers, network } from 'hardhat';
import {
  BaseContract,
  BigNumber,
  ContractFactory,
  ContractTransaction,
} from 'ethers';

export interface DeployedContracts {
  FRAX: string;
  PRESALE_ALLOCATION: string;
  TEMPLE: string;
  OLD_EXIT_QUEUE: string;
  EXIT_QUEUE: string;
  ACCELERATED_EXIT_QUEUE: string;
  STAKING: string;
  LEGACY_LOCKED_OG_TEMPLE: string;
  TREASURY: string;
  PRESALE: string;
  SANDALWOOD_TOKEN: string;
  TREASURY_MANAGEMENT: string;
  OPENING_CEREMONY: string;
  OPENING_CEREMONY_VERIFIER: string;

  TEMPLE_TEAM_FIXED_PAYMENTS: string;
  TEMPLE_TEAM_EPOCH_2: string;
  TEMPLE_TEAM_CONTIGENT_PAYMENTS: string;
  TEMPLE_V2_PAIR: string;
  TEMPLE_V2_FEI_PAIR: string;
  TEMPLE_V2_ROUTER: string;
  TEMPLE_AMM_OPS: string;
  AMM_WHITELIST: string;
  TEMPLE_CASHBACK: string;

  FAITH: string;
  FAITH_AIRDROP: string;
  LOCKED_OG_TEMPLE: string;
  DEVOTION: string;
  TEMPLE_IV_SWAP: string;

  MULTISIG: string;
}

export interface PolygonContracts {
  SANDALWOOD_TOKEN: string;
  OPENING_CEREMONY_QUEST: string;
}

export const POLYGON_CONTRACTS: { [key: string]: PolygonContracts } = {
  matic: {
    SANDALWOOD_TOKEN: '0xe99e95ec6DCae4c85806F13CDf1351aE0FEf55Be', // bridged: 0x4FA80013F5d13DB10f2c5DC2987081cb48c7c069
    OPENING_CEREMONY_QUEST: '0x17d723436740F2852274192dA27F65116ECd011E',
  },
};

export const DEPLOYED_CONTRACTS: { [key: string]: DeployedContracts } = {
  rinkeby: {
    // No longer active/unused
    PRESALE_ALLOCATION: '0x321518CCaf0f815Eff4A219951269A93BA45A5f8',
    PRESALE: '0x8E861254C691FA1D4E25b966F064fAE395D9D630',
    SANDALWOOD_TOKEN: '0xA7377AbD44F62730271DE322F920037E86e9e5C8', // not bridged onto polygon
    OPENING_CEREMONY: '0x16e3cD38C1ddf24E758B2f3a69a8042d96c220b1',
    OPENING_CEREMONY_VERIFIER: '0x91828143801899e82D1eD6B0Be92ebe61B1D299E',
    OLD_EXIT_QUEUE: '0x4caA5F5e306f99d07DDB6c17ce9AE5Af3c9B0B1a',
    AMM_WHITELIST: '0x412326Afc6d8E27467e979dc1Ac404887802018a',

    // From network/environment
    FRAX: '0x5eD8BD53B0c3fa3dEaBd345430B1A3a6A4e8BD7C',

    // Active contrats
    TEMPLE: '0x359655dcB8A32479680Af81Eb38eA3Bb2B42Af54',
    EXIT_QUEUE: '0x5B1ccC64cc9e39BA8d6395fA6Cb4FFCaB3e3069f',
    ACCELERATED_EXIT_QUEUE: '0x75a89f50cb40aec7Ed237F1Bfab562A60023ebE6',
    STAKING: '0xfF8D8342DC367D66BA20403216d55B1fcC1f284e',
    LEGACY_LOCKED_OG_TEMPLE: '0x564462C807600684965d8A8f57eA190F2F66169C',
    TREASURY: '0xA443355cE4F9c1AA6d68e057a962E86E071B0ed3',

    // currently not configured, need to swap treasury owner via
    // multisig. Test on rinkeby before doing the same on mainnet
    TREASURY_MANAGEMENT: '0xB9A7F07f5D0ea3AFa454486cffe39ceFec8e136C',
    TEMPLE_TEAM_FIXED_PAYMENTS: '',
    TEMPLE_TEAM_EPOCH_2: '',
    TEMPLE_TEAM_CONTIGENT_PAYMENTS: '',

    TEMPLE_V2_PAIR: '0x57fd5b0CcC0Ad528050a2D5e3b3935c08F058Dca',
    TEMPLE_V2_FEI_PAIR: '0x519462fD548D0Ba1e7d380Ed7F3DA10Cab912Fa7',
    // TEMPLE_V2_ROUTER: '0xb50341AF85763d2D997F4ba764EbBdfAeeC0E07d', // old
    TEMPLE_V2_ROUTER: '0x459E8c845D5e11d50E5f42Cd51650a86aF1Af5B1',

    TEMPLE_AMM_OPS: '0xe04D90A6d408D25c96Aea5Be018853c604bE794a',
    TEMPLE_CASHBACK: '0x2FDac592c53A8d64183f727ee125c9bB997484D9',

    FAITH: '0x727d442f05cf22f3A60b787913623f406f9E94bA',
    FAITH_AIRDROP: '0xc101ca108be832a4c44f1F0d9872E33A118317b7',
    LOCKED_OG_TEMPLE: '0x3C777c4F6fF2bdDD1394De9D4d6ddAB980d47Ed8',
    DEVOTION: '0x262Eb109183B7f1b4Aa36c136C6A27e9a0c9210F',
    TEMPLE_IV_SWAP: '',

    MULTISIG: '0x577BB87962b76e60d3d930c1B9Ddd6DFD64d24A2',
  },
  mainnet: {
    // No longer active/unused
    PRESALE_ALLOCATION: '0x6cf2A119f98A4B4A7FA4Fd08A1E72D7aF3ba72FE',
    PRESALE: '0xDC9D4685847f1C8bDd4CE86BE6A83Fa09B6A08b1',
    SANDALWOOD_TOKEN: '0x4FA80013F5d13DB10f2c5DC2987081cb48c7c069', // bridged 0xe99e95ec6DCae4c85806F13CDf1351aE0FEf55Be
    OPENING_CEREMONY: '0xA2642dF0139faeBB1D45526a46d5c54B805Be02c',
    OPENING_CEREMONY_VERIFIER: '0x8ed9a9980E4C7e87eDf8DA13Fc2ba53802BBa117',
    OLD_EXIT_QUEUE: '0xfaeadcd9cb6870a5df09e403e4dcfcf1a6f20a0c',
    AMM_WHITELIST: '0x3fAEb34Ab68709DCa02D6B48A03256317b338896',

    // From network/environment
    FRAX: '0x853d955acef822db058eb8505911ed77f175b99e',
    MULTISIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',

    // Active contrats
    TEMPLE: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
    EXIT_QUEUE: '0x967591888A5e8aED9D2A920fE4cC726e83d2bca9',
    ACCELERATED_EXIT_QUEUE: '0xC6d556C34a179a224AEBE42e77c6e76594148B97',
    STAKING: '0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77',
    LEGACY_LOCKED_OG_TEMPLE: '0x879B843868dA248B1F2F53b4f8CC6e17e7E8b949',
    TREASURY: '0x22c2fE05f55F81Bf32310acD9a7C51c4d7b4e443',

    // currently not configured, need to swap treasury owner via
    // multisig. Test on rinkeby and carefully verifiy everything
    // before making the change.
    // NOTE: Probably better to just migrate treasury instead
    TREASURY_MANAGEMENT: '0x20bEB455c3b7b0D84091b84c25f51Bc002d92f05', // currently unused
    TEMPLE_TEAM_FIXED_PAYMENTS: '0xF7b10A0C780a3906D9A9F3d706EcD2624B6ED84e',
    TEMPLE_TEAM_EPOCH_2: '0xe0Aafcf26576a53Cbec99481607FB53384909C36',
    TEMPLE_TEAM_CONTIGENT_PAYMENTS: '',

    TEMPLE_V2_PAIR: '0x6021444f1706f15465bEe85463BCc7d7cC17Fc03',
    TEMPLE_V2_FEI_PAIR: '0xf994158766e0a4E64c26feCE675186f489EC9107',
    // TEMPLE_V2_ROUTER: '0x8A5058100E60e8F7C42305eb505B12785bbA3BcA', // old
    TEMPLE_V2_ROUTER: '0x98257c876ace5009e7b97843f8c71b3ae795c71e',

    TEMPLE_AMM_OPS: '0xc8c3C72d667196bAd40dE3e5eaDC29E74431257B',

    TEMPLE_CASHBACK: '0x72e9fa8eD38ddbdA4b044E95A206EDaA509FdF72',

    FAITH: '0x78F683247cb2121B4eBfbD04110760da42752a6B',
    FAITH_AIRDROP: '0x1b44a9a94f2bb14eeF0ded2f0428231e358d31d7',
    LOCKED_OG_TEMPLE: '',
    DEVOTION: '',
    TEMPLE_IV_SWAP: '0xb0D978C8Be39C119922B99f483cD8C4092f0EA56',
  },
  localhost: {
    // No longer active/unused
    PRESALE_ALLOCATION: process.env.PRESALE_ALLOCATION || '',
    PRESALE: process.env.PRESALE || '',
    SANDALWOOD_TOKEN: process.env.SANDALWOOD_TOKEN || '',
    OPENING_CEREMONY: process.env.OPENING_CEREMONY || '',
    OPENING_CEREMONY_VERIFIER: process.env.OPENING_CEREMONY_VERIFIER || '',
    OLD_EXIT_QUEUE: process.env.OLD_EXIT_QUEUE || '',
    AMM_WHITELIST: process.env.AMM_WHITELIST || '',

    // From network/environment (setup when 00-localhost-env.ts script is run)
    FRAX: process.env.FRAX || '',

    // Active contrats
    TEMPLE: process.env.TEMPLE || '',
    EXIT_QUEUE: process.env.EXIT_QUEUE || '',
    ACCELERATED_EXIT_QUEUE: process.env.ACCELERATED_EXIT_QUEUE || '',
    STAKING: process.env.STAKING || '',
    LEGACY_LOCKED_OG_TEMPLE: process.env.LEGACY_LOCKED_OG_TEMPLE || '',
    TREASURY: process.env.TREASURY || '',
    TREASURY_MANAGEMENT: process.env.TREASURY_MANAGEMENT || '',
    TEMPLE_TEAM_FIXED_PAYMENTS: process.env.TEMPLE_TEAM_FIXED_PAYMENTS || '',
    TEMPLE_TEAM_EPOCH_2: process.env.TEMPLE_TEAM_EPOCH_2 || '',
    TEMPLE_TEAM_CONTIGENT_PAYMENTS:
      process.env.TEMPLE_TEAM_CONTIGENT_PAYMENTS || '',
    TEMPLE_V2_PAIR: process.env.TEMPLE_V2_PAIR || '',
    TEMPLE_V2_FEI_PAIR: process.env.TEMPLE_V2_FEI_PAIR || '',
    TEMPLE_V2_ROUTER: process.env.TEMPLE_V2_ROUTER || '',
    TEMPLE_AMM_OPS: process.env.TEMPLE_AMM_OPS || '',
    TEMPLE_CASHBACK: process.env.TEMPLE_CASHBACK || '',

    FAITH: process.env.FAITH || '',
    FAITH_AIRDROP: process.env.FAITH_AIRDROP || '',
    LOCKED_OG_TEMPLE: process.env.LOCKED_OG_TEMPLE || '',
    DEVOTION: process.env.DEVOTION || '',
    TEMPLE_IV_SWAP: process.env.TEMPLE_IV_SWAP || '',

    MULTISIG: '0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199', // Account #19
  },
};

/**
 * Current block timestamp
 */
export const blockTimestamp = async () => {
  return (
    await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
  ).timestamp;
};

/** number to attos (what all our contracts expect) */
export function toAtto(n: number): BigNumber {
  return ethers.utils.parseEther(n.toString());
}

/** number from attos (ie, human readable) */
export function fromAtto(n: BigNumber): number {
  return Number.parseFloat(ethers.utils.formatUnits(n, 18));
}

export async function mine(tx: Promise<ContractTransaction>) {
  console.log(`Mining transaction: ${(await tx).hash}`);
  await (await tx).wait();
}

/**
 * Typesafe helper that works on contract factories to create, deploy, wait till deploy completes
 * and output useful commands to setup etherscan with contract code
 */
export async function deployAndMine<
  T extends BaseContract,
  D extends (...args: any[]) => Promise<T>
>(
  name: string,
  factory: ContractFactory,
  deploy: D,
  ...args: Parameters<D>
): Promise<T> {
  if (factory.deploy !== deploy) {
    throw new Error("Contract factory and deploy method don't match");
  }

  const renderedArgs: string = args.map((a) => a.toString()).join(' ');

  console.log(
    `*******Deploying ${name} on ${network.name} with args ${renderedArgs}`
  );
  const contract = (await factory.deploy(...args)) as T;
  console.log(
    `Deployed... waiting for transaction to mine: ${contract.deployTransaction.hash}`
  );
  console.log();
  await contract.deployed();
  console.log('Contract deployed');
  console.log(`${name}=${contract.address}`);
  console.log(`export ${name}=${contract.address}`);
  console.log(
    `yarn hardhat verify --network ${network.name} ${contract.address} ${renderedArgs}`
  );
  console.log('********************\n');

  return contract;
}

/**
 * Check if process.env.MAINNET_ADDRESS_PRIVATE_KEY (required when doing deploy)
 */
export function expectAddressWithPrivateKey() {
  if (network.name == 'mainnet' && !process.env.MAINNET_ADDRESS_PRIVATE_KEY) {
    throw new Error(
      'Missing environment variable MAINNET_ADDRESS_PRIVATE_KEY. A mainnet address private key with eth is required to deploy/manage contracts'
    );
  }

  if (network.name == 'rinkeby' && !process.env.RINKEBY_ADDRESS_PRIVATE_KEY) {
    throw new Error(
      'Missing environment variable RINKEBY_ADDRESS_PRIVATE_KEY. A mainnet address private key with eth is required to deploy/manage contracts'
    );
  }
}

const expectedEnvvars: { [key: string]: string[] } = {
  mainnet: [
    'MAINNET_ADDRESS_PRIVATE_KEY',
    'MAINNET_RPC_URL',
    'MAINNET_GAS_IN_GWEI',
  ],
  rinkeby: ['RINKEBY_ADDRESS_PRIVATE_KEY', 'RINKEBY_RPC_URL'],
  matic: ['MATIC_ADDRESS_PRIVATE_KEY', 'MATIC_RPC_URL'],
  localhost: [],
};

/**
 * Check if the required environment variables exist
 */
export function ensureExpectedEnvvars() {
  let hasAllExpectedEnvVars = true;
  for (const envvarName of expectedEnvvars[network.name]) {
    if (!process.env[envvarName]) {
      console.error(`Missing environment variable ${envvarName}`);
      hasAllExpectedEnvVars = false;
    }
  }

  if (!hasAllExpectedEnvVars) {
    throw new Error(`Expected envvars missing`);
  }
}
