import { ethers, network } from "hardhat";
import { BaseContract, BigNumber, ContractFactory, ContractTransaction } from "ethers";

export interface DeployedContracts {
  FRAX: string,
  PRESALE_ALLOCATION: string;
  TEMPLE: string
  EXIT_QUEUE: string
  STAKING: string
  LOCKED_OG_TEMPLE: string,
  TREASURY: string,
  PRESALE: string,
  SANDALWOOD_TOKEN: string,
  TREASURY_MANAGEMENT: string,
  OPENING_CEREMONY: string,
  OPENING_CEREMONY_VERIFIER: string,
}

export interface PolygonContracts {
  SANDALWOOD_TOKEN: string,
  OPENING_CEREMONY_QUEST: string,
}

export const POLYGON_CONTRACTS: {[key: string]: PolygonContracts} = {
  matic: {
    SANDALWOOD_TOKEN: '0xe99e95ec6DCae4c85806F13CDf1351aE0FEf55Be', // bridged: 0x4FA80013F5d13DB10f2c5DC2987081cb48c7c069
    OPENING_CEREMONY_QUEST: '0x17d723436740F2852274192dA27F65116ECd011E'
  }
}

export const DEPLOYED_CONTRACTS: {[key: string]: DeployedContracts} = {
  rinkeby: {
    FRAX: '0x5eD8BD53B0c3fa3dEaBd345430B1A3a6A4e8BD7C',
    PRESALE_ALLOCATION: '0x321518CCaf0f815Eff4A219951269A93BA45A5f8',
    TEMPLE: '0x7fC7560Ee3b0a1262ab40B6bA7Bfa490AFD83192',
    EXIT_QUEUE: '0x4caA5F5e306f99d07DDB6c17ce9AE5Af3c9B0B1a',
    STAKING: '0x23cA32f59384a4B954Bb29932F499a4842F154Dd',
    LOCKED_OG_TEMPLE: '0x2Ad6671bCAd84A2a12BeB5da2d1C490aA00dcBEC',
    TREASURY: '0x0c8Ae2793F5ED0479084f92284BfF8f8E587F8BC',
    PRESALE: '0x8E861254C691FA1D4E25b966F064fAE395D9D630',
    SANDALWOOD_TOKEN: '0xA7377AbD44F62730271DE322F920037E86e9e5C8', // not bridged onto polygon
    TREASURY_MANAGEMENT: '',
    OPENING_CEREMONY: '',
    OPENING_CEREMONY_VERIFIER: '',
  },
  mainnet: {
    FRAX: '0x853d955acef822db058eb8505911ed77f175b99e',
    PRESALE_ALLOCATION: '0x6cf2A119f98A4B4A7FA4Fd08A1E72D7aF3ba72FE',
    TEMPLE: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
    EXIT_QUEUE: '0xfaeadcd9cb6870a5df09e403e4dcfcf1a6f20a0c',
    STAKING: '0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77',
    LOCKED_OG_TEMPLE: '0x879B843868dA248B1F2F53b4f8CC6e17e7E8b949',
    TREASURY: '0x22c2fE05f55F81Bf32310acD9a7C51c4d7b4e443',
    PRESALE: '0xDC9D4685847f1C8bDd4CE86BE6A83Fa09B6A08b1',
    SANDALWOOD_TOKEN: '0x4FA80013F5d13DB10f2c5DC2987081cb48c7c069', // bridged 0xe99e95ec6DCae4c85806F13CDf1351aE0FEf55Be
    TREASURY_MANAGEMENT: '0xb18F07b22845dF936310B63bdD04ce0E28e78C6F',
    OPENING_CEREMONY: '0xA2642dF0139faeBB1D45526a46d5c54B805Be02c',
    OPENING_CEREMONY_VERIFIER: '0x8ed9a9980E4C7e87eDf8DA13Fc2ba53802BBa117',
  },
  localhost: {
    FRAX: process.env.FRAX || '',
    PRESALE_ALLOCATION: process.env.PRESALE_ALLOCATION || '',
    TEMPLE: process.env.TEMPLE || '',
    EXIT_QUEUE: process.env.EXIT_QUEUE || '',
    STAKING: process.env.STAKING || '',
    LOCKED_OG_TEMPLE: process.env.LOCKED_OG_TEMPLE || '',
    TREASURY: process.env.TREASURY || '',
    PRESALE: process.env.PRESALE || '',
    SANDALWOOD_TOKEN: process.env.SANDALWOOD_TOKEN || '',
    TREASURY_MANAGEMENT: process.env.TREASURY_MANAGEMENT || '',
    OPENING_CEREMONY: process.env.OPENING_CEREMONY || '',
    OPENING_CEREMONY_VERIFIER: process.env.OPENING_CEREMONY_VERIFIER || '',
  }
}

/**
 * Current block timestamp
 */
export const blockTimestamp = async () => {
  return (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
}

/** number to attos (what all our contracts expect) */
export function toAtto(n: number): BigNumber {
  return ethers.utils.parseEther(n.toString());
}

/** number from attos (ie, human readable) */
export function fromAtto(n: BigNumber): number {
  return Number.parseFloat(ethers.utils.formatUnits(n, 18));
}

export async function mine(tx: Promise<ContractTransaction>) {
  await (await tx).wait();
}

/**
 * Typesafe helper that works on contract factories to create, deploy, wait till deploy completes
 * and output useful commands to setup etherscan with contract code
 */
export async function deployAndMine<T extends BaseContract, D extends (...args: any[]) => Promise<T>>(
                name: string,
                factory: ContractFactory,
                deploy: D,
                ...args: Parameters<D>): Promise<T> {

  if (factory.deploy !== deploy) {
    throw new Error("Contract factory and deploy method don't match");
  }

  const renderedArgs: string = args.map(a => a.toString()).join(' ');

  console.log(`*******Deploying ${name} on ${network.name} with args ${renderedArgs}`);
  const contract = await factory.deploy(...args) as T;
  console.log(`Deployed... waiting for transaction to mine`);
  console.log();
  await contract.deployed();
  console.log('Contract deployed');
  console.log(`${name}=${contract.address}`);
  console.log(`yarn hardhat verify --network ${network.name} ${contract.address} ${renderedArgs}`);
  console.log('********************\n');

  return contract;
}

/**
 * Check if process.env.MAINNET_ADDRESS_PRIVATE_KEY (required when doing deploy)
 */
export function expectAddressWithPrivateKey() {
  if (network.name == 'mainnet' && !process.env.MAINNET_ADDRESS_PRIVATE_KEY) {
    throw new Error("Missing environment variable MAINNET_ADDRESS_PRIVATE_KEY. A mainnet address private key with eth is required to deploy/manage contracts");
  }

  if (network.name == 'rinkeby' && !process.env.RINKEBY_ADDRESS_PRIVATE_KEY) {
    throw new Error("Missing environment variable RINKEBY_ADDRESS_PRIVATE_KEY. A mainnet address private key with eth is required to deploy/manage contracts");
  }
}
