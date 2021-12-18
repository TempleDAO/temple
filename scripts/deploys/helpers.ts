import { ethers, network } from "hardhat";
import { BaseContract, BigNumber, ContractFactory, ContractTransaction } from "ethers";

export interface DeployedContracts {
  FRAX: string,
  PRESALE_ALLOCATION: string;
  TEMPLE: string
  OLD_EXIT_QUEUE: string
  EXIT_QUEUE: string
  STAKING: string
  LOCKED_OG_TEMPLE: string,
  TREASURY: string,
  PRESALE: string,
  SANDALWOOD_TOKEN: string,
  TREASURY_MANAGEMENT: string,
  OPENING_CEREMONY: string,
  OPENING_CEREMONY_VERIFIER: string,

  TEMPLE_TEAM_FIXED_PAYMENTS: string,
  TEMPLE_TEAM_CONTIGENT_PAYMENTS: string,
  TEMPLE_V2_PAIR: string,
  TEMPLE_V2_ROUTER: string,
  TEMPLE_AMM_OPS: string,
  AMM_WHITELIST: string,
  TEMPLE_CASHBACK: string,
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
    // No longer active/unused
    PRESALE_ALLOCATION: '0x321518CCaf0f815Eff4A219951269A93BA45A5f8',
    PRESALE: '0x8E861254C691FA1D4E25b966F064fAE395D9D630',
    SANDALWOOD_TOKEN: '0xA7377AbD44F62730271DE322F920037E86e9e5C8', // not bridged onto polygon
    OPENING_CEREMONY: '0x16e3cD38C1ddf24E758B2f3a69a8042d96c220b1',
    OPENING_CEREMONY_VERIFIER: '0x91828143801899e82D1eD6B0Be92ebe61B1D299E',
    OLD_EXIT_QUEUE: '0x4caA5F5e306f99d07DDB6c17ce9AE5Af3c9B0B1a',

    // From network/environment
    FRAX: '0x5eD8BD53B0c3fa3dEaBd345430B1A3a6A4e8BD7C',

    // Active contrats
    TEMPLE: '0x7fC7560Ee3b0a1262ab40B6bA7Bfa490AFD83192',
    EXIT_QUEUE: '0x2B072d8239F363ffae2334609BA397F38Ef0D736',
    STAKING: '0x23cA32f59384a4B954Bb29932F499a4842F154Dd',
    LOCKED_OG_TEMPLE: '0x2Ad6671bCAd84A2a12BeB5da2d1C490aA00dcBEC',
    TREASURY: '0x0c8Ae2793F5ED0479084f92284BfF8f8E587F8BC',
    TREASURY_MANAGEMENT: '0x7b7672E1d3ca66c32876842A9E89A04D06F8AB6d',
    TEMPLE_TEAM_FIXED_PAYMENTS: '0x7a770591f202D18e893DeC115f16DAE9d28686a8',
    TEMPLE_TEAM_CONTIGENT_PAYMENTS: '0xB909238BcBF965CE0114bDE814F2A584F69c0445',
    TEMPLE_V2_PAIR: '0xA9BA3038EBb98097d2f0B746024E1A38c26E8ab6',
    TEMPLE_V2_ROUTER: '0x7a6b37DB5dF68f6F2FeE99CFA9214C136394EE93',
    TEMPLE_AMM_OPS: '',
    AMM_WHITELIST: '0x92f00dd3CDac7d3375b8b7879899b0663De0C76f',
    TEMPLE_CASHBACK: '0x043AF20EE047D40C474f7294fCC3338A5B0067c9',
  },
  mainnet: {
    // No longer active/unused
    PRESALE_ALLOCATION: '0x6cf2A119f98A4B4A7FA4Fd08A1E72D7aF3ba72FE',
    PRESALE: '0xDC9D4685847f1C8bDd4CE86BE6A83Fa09B6A08b1',
    SANDALWOOD_TOKEN: '0x4FA80013F5d13DB10f2c5DC2987081cb48c7c069', // bridged 0xe99e95ec6DCae4c85806F13CDf1351aE0FEf55Be
    OPENING_CEREMONY: '0xA2642dF0139faeBB1D45526a46d5c54B805Be02c',
    OPENING_CEREMONY_VERIFIER: '0x8ed9a9980E4C7e87eDf8DA13Fc2ba53802BBa117',
    OLD_EXIT_QUEUE: '0xfaeadcd9cb6870a5df09e403e4dcfcf1a6f20a0c',

    // From network/environment
    FRAX: '0x853d955acef822db058eb8505911ed77f175b99e',

    // Active contrats
    TEMPLE: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
    EXIT_QUEUE: '0x967591888A5e8aED9D2A920fE4cC726e83d2bca9',
    STAKING: '0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77',
    LOCKED_OG_TEMPLE: '0x879B843868dA248B1F2F53b4f8CC6e17e7E8b949',
    TREASURY: '0x22c2fE05f55F81Bf32310acD9a7C51c4d7b4e443',
    TREASURY_MANAGEMENT: '0x49bCb2574d2857a9e13fc97ab2e986253b2d6255',
    TEMPLE_TEAM_FIXED_PAYMENTS: '',
    TEMPLE_TEAM_CONTIGENT_PAYMENTS: '',
    TEMPLE_V2_PAIR: '0x6021444f1706f15465bEe85463BCc7d7cC17Fc03',
    TEMPLE_V2_ROUTER: '0x04768037329a05Bcb59515243668Bd2d3da0cBb9',
    TEMPLE_AMM_OPS: '0x1aA6A5d7e889043b317c7A3203F41493dBb785E3',
    AMM_WHITELIST: '0x4fb817e3e4A8C0D69B71e56273861115FFA4E2FF',
    TEMPLE_CASHBACK: '0x72e9fa8eD38ddbdA4b044E95A206EDaA509FdF72',
  },
  localhost: {
    // No longer active/unused
    PRESALE_ALLOCATION: process.env.PRESALE_ALLOCATION || '',
    PRESALE: process.env.PRESALE || '',
    SANDALWOOD_TOKEN: process.env.SANDALWOOD_TOKEN || '',
    OPENING_CEREMONY: process.env.OPENING_CEREMONY || '',
    OPENING_CEREMONY_VERIFIER: process.env.OPENING_CEREMONY_VERIFIER || '',
    OLD_EXIT_QUEUE: process.env.OLD_EXIT_QUEUE || '',

    // From network/environment (setup when 00-localhost-env.ts script is run)
    FRAX: process.env.FRAX || '',

    // Active contrats
    TEMPLE: process.env.TEMPLE || '',
    EXIT_QUEUE: process.env.EXIT_QUEUE || '',
    STAKING: process.env.STAKING || '',
    LOCKED_OG_TEMPLE: process.env.LOCKED_OG_TEMPLE || '',
    TREASURY: process.env.TREASURY || '',
    TREASURY_MANAGEMENT: process.env.TREASURY_MANAGEMENT || '',
    TEMPLE_TEAM_FIXED_PAYMENTS: process.env.TEMPLE_TEAM_FIXED_PAYMENTS || '',
    TEMPLE_TEAM_CONTIGENT_PAYMENTS: process.env.TEMPLE_TEAM_CONTIGENT_PAYMENTS || '',
    TEMPLE_V2_PAIR: process.env.TEMPLE_V2_PAIR || '',
    TEMPLE_V2_ROUTER: process.env.TEMPLE_V2_ROUTER || '',
    TEMPLE_AMM_OPS: process.env.TEMPLE_AMM_OPS || '',
    AMM_WHITELIST: process.env.AMM_WHITELIST || '',
    TEMPLE_CASHBACK: process.env.TEMPLE_CASHBACK || '',
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
  console.log(`export ${name}=${contract.address}`);
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
