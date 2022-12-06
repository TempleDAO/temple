import { ethers, network } from 'hardhat';
import {
  BaseContract,
  BigNumber,
  ContractFactory,
  ContractTransaction,
  Signer,
} from 'ethers';
import axios from 'axios';

export interface DeployedContracts {
  // From environment
  FRAX: string;
  MULTISIG: string;

  // Temple Core
  TEMPLE: string;
  OPS_MANAGER: string;
  OPS_MANAGER_LIB: string;
  JOINING_FEE: string;
  VAULT_PROXY: string;
  VAULT_EARLY_WITHDRAW: string;
  TREASURY_IV: string;
  // XXX: Needs to include vaults/exposure/farming contracts created on chain

  // Temple AMM
  TEMPLE_V2_FRAX_PAIR: string;
  TEMPLE_V2_FEI_PAIR: string;
  TEMPLE_V2_ROUTER: string;

  // Temple Admin
  TEMPLE_TEAM_FIXED_PAYMENTS: string;
  TEMPLE_TEAM_EPOCH_2: string;
  TEMPLE_TEAM_EPOCH_3: string;
  TEMPLE_TEAM_EPOCH_4: string;
  TEMPLE_TEAM_EPOCH_5: string;
  TEMPLE_TEAM_EPOCH_6: string;
  TEMPLE_TEAM_EPOCH_7: string;
  TEMPLE_TEAM_EPOCH_8: string;
  TEMPLE_TEAM_EPOCH_9: string;

  TEMPLE_TEAM_PAYMENTS_IMPLEMENTATION: string;
  TEMPLE_TEAM_PAYMENTS_FACTORY: string;

  // Temple Zaps
  GENERIC_ZAPS: string;
  TEMPLE_ZAPS: string;

  // RAMOS
  RAMOS: string;
  RAMOS_POOL_HELPER: string;
  RAMOS_AURA_STAKING: string;
}

export const DEPLOYED_CONTRACTS: { [key: string]: DeployedContracts } = {
  rinkeby: {
    // From network/environment
    FRAX: '0x5eD8BD53B0c3fa3dEaBd345430B1A3a6A4e8BD7C',

    TEMPLE: '0x359655dcB8A32479680Af81Eb38eA3Bb2B42Af54',

    TEMPLE_TEAM_FIXED_PAYMENTS: '',
    TEMPLE_TEAM_EPOCH_2: '',
    TEMPLE_TEAM_EPOCH_3: '',
    TEMPLE_TEAM_EPOCH_4: '',
    TEMPLE_TEAM_EPOCH_5: '',
    TEMPLE_TEAM_EPOCH_6: '',
    TEMPLE_TEAM_EPOCH_7: '',
    TEMPLE_TEAM_EPOCH_8: '',
    TEMPLE_TEAM_EPOCH_9: '',
    TEMPLE_TEAM_PAYMENTS_IMPLEMENTATION: '',
    TEMPLE_TEAM_PAYMENTS_FACTORY: '',

    TEMPLE_V2_FRAX_PAIR: '0x57fd5b0CcC0Ad528050a2D5e3b3935c08F058Dca',
    TEMPLE_V2_FEI_PAIR: '', // TODO: Update
    TEMPLE_V2_ROUTER: '', // TOTO: Update with current router

    OPS_MANAGER_LIB: '0xCA3Af256aBe5B11989c8069e1892a4eed8C85c17',
    OPS_MANAGER: '0x0647b5CFC9e9B03629Db83E7Aa4d1E25283DD9Cb',
    JOINING_FEE: '0x28089129bFc5d0279468D08844969c7cbDc9fe78',
    VAULT_PROXY: '0x8adcc775251362B4E03e0437805BE3154C56b3F5',
    VAULT_EARLY_WITHDRAW: '',
    TREASURY_IV: '',

    MULTISIG: '0x577BB87962b76e60d3d930c1B9Ddd6DFD64d24A2',
    GENERIC_ZAPS: '',
    TEMPLE_ZAPS: '',

    RAMOS: '',
    RAMOS_POOL_HELPER: '',
    RAMOS_AURA_STAKING: '',
  },
  goerli: {
    // No longer active/unused

    // From network/environment
    FRAX: '0x73651AD693531F9937528009cC204a4d9b696a68',
    //DAI: 0x8c9e6c40d3402480ace624730524facc5482798c
    //FEI: 0xa1e7CdD887d6fac4861b5663984A9Ba72cFF9522

    // Active contrats
    TEMPLE: '0x5631d8eA427129e15bDa68F0F9227C149bD29Dcf',
    // currently not configured, need to swap treasury owner via
    // multisig. Test on rinkeby before doing the same on mainnet
    TEMPLE_TEAM_FIXED_PAYMENTS: '',
    TEMPLE_TEAM_EPOCH_2: '',
    TEMPLE_TEAM_EPOCH_3: '',
    TEMPLE_TEAM_EPOCH_4: '',
    TEMPLE_TEAM_EPOCH_5: '',
    TEMPLE_TEAM_EPOCH_6: '',
    TEMPLE_TEAM_EPOCH_7: '',
    TEMPLE_TEAM_EPOCH_8: '',
    TEMPLE_TEAM_EPOCH_9: '',
    TEMPLE_TEAM_PAYMENTS_IMPLEMENTATION: '',
    TEMPLE_TEAM_PAYMENTS_FACTORY: '',

    TEMPLE_V2_FRAX_PAIR: '0x85dA8c4312742522519911052Fa2B4aC302E4d6c', // Frax Pair
    TEMPLE_V2_FEI_PAIR: '0xD83834165E2b130341d58dd5A43460B7f4C491BD', // TODO: Update
    TEMPLE_V2_ROUTER: '0x7a19509307648b0bf00dd7349F2dDaE716B9a998',

    OPS_MANAGER_LIB: '0x5274078067Df0E474071f49A649DCbcd6E0787e3',
    OPS_MANAGER: '0x542891Faf336d69E440De80145Df21510dCa6a78',
    JOINING_FEE: '0x848355A31D7cc2aA73C3E4Df152a17ECa0A5CEaF',
    VAULT_PROXY: '0xb0043346da58ce01EaE3246664Cb5984f75adC1b',
    VAULT_EARLY_WITHDRAW: '0x7Edb6ea1A90318E9D2B3Ae03e5617A5AAFd7b249',
    TREASURY_IV: '0x5B0eeE1336cD3f5136D3DaF6970236365b9E9cd7',

    MULTISIG: '0x3a320fF715dCBbF097e15257B7051dd08fdfb7A2',
    GENERIC_ZAPS: '',
    TEMPLE_ZAPS: '',

    RAMOS: '0x02783CE28C5B3B015340938A11Aa79BB9f26f1Bc',
    RAMOS_POOL_HELPER: '0xe3346D1923A9935A581FEa891b027eabF7B35250',
    RAMOS_AURA_STAKING: '',
  },
  mainnet: {
    // From network/environment
    FRAX: '0x853d955acef822db058eb8505911ed77f175b99e',
    MULTISIG: '0x4D6175d58C5AceEf30F546C0d5A557efFa53A950',

    TEMPLE: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
    TEMPLE_TEAM_FIXED_PAYMENTS: '0xF7b10A0C780a3906D9A9F3d706EcD2624B6ED84e',
    TEMPLE_TEAM_EPOCH_2: '0xe0Aafcf26576a53Cbec99481607FB53384909C36',
    TEMPLE_TEAM_EPOCH_3: '0xf86c2dbd16f05e86bff72ce89b3c2915812e92d0',
    TEMPLE_TEAM_EPOCH_4: '0x07888e0a8929eb922Aee5930f7B0894BaB5D8120',
    TEMPLE_TEAM_EPOCH_5: '0x32fbd318e0c029bfa6c6088196f184ca2e3fbdd1',
    TEMPLE_TEAM_EPOCH_6: '0x91ad65e053ae98b4fbab84fc38b7bddd17c32cda',
    TEMPLE_TEAM_EPOCH_7: '0x8cded928006feb238617fa5f7b04abeefcde36bf',
    TEMPLE_TEAM_EPOCH_8: '0x008eCB3E53024628a5A8BbE0b142329791ad6f51',
    TEMPLE_TEAM_EPOCH_9: '0x5461d7Cd3eEB184a83c5a1678335D72ccaf04818',

    TEMPLE_TEAM_PAYMENTS_IMPLEMENTATION: '',
    TEMPLE_TEAM_PAYMENTS_FACTORY: '',

    TEMPLE_V2_FRAX_PAIR: '0x6021444f1706f15465bEe85463BCc7d7cC17Fc03',
    TEMPLE_V2_FEI_PAIR: '0xf994158766e0a4E64c26feCE675186f489EC9107',
    TEMPLE_V2_ROUTER: '0x98257c876ace5009e7b97843f8c71b3ae795c71e',

    OPS_MANAGER: '0x65fE8BaBF7DA367b2B45cBD748F0490713f84828',
    OPS_MANAGER_LIB: '0x248bA5985053ee399a76B5822AdeB12FA0ab1424',
    JOINING_FEE: '0x8A17403B929ed1B6B50ea880d9C93068a5105D4C',
    VAULT_PROXY: '0x6f5bB7cC4F3D6628d0095545552757AB377FE15C',
    VAULT_EARLY_WITHDRAW: '0x7C6f1b4891ff8CAcCeC97DbbD9Df3b773d88A03E',
    TREASURY_IV: '0xae8a796bd9437Bd266664e8e9B8428B25A7D2477',
    GENERIC_ZAPS: '0x388d3C524724541800FD74041136caB40FD4DAfE',
    TEMPLE_ZAPS: '0xb7C30F132DBbBbB1C2b81d9D66a010FB7c72Ff9c',

    RAMOS: '',
    RAMOS_POOL_HELPER: '',
    RAMOS_AURA_STAKING: '',
  },
  localhost: {
    // From network/environment (setup when 00-localhost-env.ts script is run)
    FRAX: process.env.FRAX || '',

    // Active contrats
    TEMPLE: process.env.TEMPLE || '',
    TEMPLE_TEAM_FIXED_PAYMENTS: process.env.TEMPLE_TEAM_FIXED_PAYMENTS || '',
    TEMPLE_TEAM_EPOCH_2: process.env.TEMPLE_TEAM_EPOCH_2 || '',
    TEMPLE_TEAM_EPOCH_3: process.env.TEMPLE_TEAM_EPOCH_3 || '',
    TEMPLE_TEAM_EPOCH_4: process.env.TEMPLE_TEAM_EPOCH_4 || '',
    TEMPLE_TEAM_EPOCH_5: process.env.TEMPLE_TEAM_EPOCH_5 || '',
    TEMPLE_TEAM_EPOCH_6: process.env.TEMPLE_TEAM_EPOCH_6 || '',
    TEMPLE_TEAM_EPOCH_7: process.env.TEMPLE_TEAM_EPOCH_7 || '',
    TEMPLE_TEAM_EPOCH_8: process.env.TEMPLE_TEAM_EPOCH_8 || '',
    TEMPLE_TEAM_EPOCH_9: process.env.TEMPLE_TEAM_EPOCH_9 || '',
    TEMPLE_TEAM_PAYMENTS_IMPLEMENTATION:
      process.env.TEMPLE_TEAM_PAYMENTS_IMPLEMENTATION || '',
    TEMPLE_TEAM_PAYMENTS_FACTORY:
      process.env.TEMPLE_TEAM_PAYMENTS_FACTORY || '',
    TEMPLE_V2_FRAX_PAIR: process.env.TEMPLE_V2_FRAX_PAIR || '',
    TEMPLE_V2_FEI_PAIR: process.env.TEMPLE_V2_FEI_PAIR || '',
    TEMPLE_V2_ROUTER: process.env.TEMPLE_V2_ROUTER || '',

    OPS_MANAGER: process.env.OPS_MANAGER || '',
    OPS_MANAGER_LIB: process.env.OPS_MANAGER_LIB || '',
    JOINING_FEE: process.env.JOINING_FEE || '',
    VAULT_PROXY: process.env.VAULT_PROXY || '',
    VAULT_EARLY_WITHDRAW: process.env.VAULT_EARLY_WITHDRAW || '',
    TREASURY_IV: process.env.TREASURY_IV || '',

    GENERIC_ZAPS: process.env.GENERIC_ZAPS || '',
    TEMPLE_ZAPS: process.env.TEMPLE_ZAPS || '',

    RAMOS: '',
    RAMOS_POOL_HELPER: '',
    RAMOS_AURA_STAKING: '',

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

  // If we are on hardhat chain
  if (network.config.chainId === 4 && process.env.ETHERSCAN_API_KEY) {
  // Wait for a few blocks to be mined before verifying
  await contract.deployTransaction.wait(6)
  // Verify the contract on Etherscan
  const response = await axios.post(
    `https://api.etherscan.io/api?module=contract&action=verifysourcecode&apikey=${process.env.ETHERSCAN_API_KEY}`,
    {
      contractaddress: contract.address,
      sourceCode: (contract as any).deployedBytecode,
      contractname: name,
      compilerversion: 'v0.7.0+commit.9e61f92b',
      optimizationUsed: 1,
      runs: 200,
      constructorArguements: renderedArgs,
    }
  );

  if (response.data.status === '1') {
    console.log(`Successfully verified contract on Etherscan: ${contract.address}`);
  } else {
    console.error(`Failed to verify contract on Etherscan: ${response.data.message}`);
  }

}

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
  goerli: ['GOERLI_ADDRESS_PRIVATE_KEY', 'GOERLI_RPC_URL'],
  matic: ['MATIC_ADDRESS_PRIVATE_KEY', 'MATIC_RPC_URL'],
  gnosis: ['GNOSIS_ADDRESS_PRIVATE_KEY', 'GNOSIS_RPC_URL'],
  gnosisChiado: ['GNOSIS_CHIADO_ADDRESS_PRIVATE_KEY', 'GNOSIS_CHIADO_RPC_URL'],
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

// Impersonate an address and run fn(signer), then stop impersonating.
export async function impersonateSigner(address: string): Promise<Signer> {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  return await ethers.getSigner(address);
}

// Wait until network gas price is below maxGasPrice, returns current gas price
export async function waitForMaxGas(
  maxGasPrice: BigNumber
): Promise<BigNumber> {
  let { gasPrice: currentGasPrice } = await ethers.provider.getFeeData();
  if (!currentGasPrice) throw new Error('No current gas price');
  while (currentGasPrice.gt(maxGasPrice)) {
    console.log(
      `Current gas price ${ethers.utils.formatUnits(
        currentGasPrice,
        'gwei'
      )} is higher than max gas price ${ethers.utils.formatUnits(
        maxGasPrice,
        'gwei'
      )}. Waiting for 30 seconds...`
    );
    await new Promise((resolve) => setTimeout(resolve, 30000));
    // Refresh current gas price
    currentGasPrice = await ethers.provider.getGasPrice();
    if (!currentGasPrice) throw new Error('No current gas price');
  }
  return currentGasPrice;
}
