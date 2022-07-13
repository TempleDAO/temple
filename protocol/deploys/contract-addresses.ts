// TODO(butlerji): Delete/unify with contract list used by dApp

export interface DeployedContracts {
  // From environment
  FRAX: string,
  MULTISIG: string,

  // Temple Core
  TEMPLE: string
  OPS_MANAGER: string,
  OPS_MANAGER_LIB: string,
  JOINING_FEE: string,
  VAULT_PROXY: string,
  // XXX: Needs to include vaults/exposure/farming contracts created on chain

  // Temple AMM
  // XXX: Needs to include FEI pair
  TEMPLE_V2_FRAX_PAIR: string,
  TEMPLE_V2_FEI_PAIR: string,
  TEMPLE_V2_ROUTER: string,

  // Temple Admin
  TEMPLE_TEAM_FIXED_PAYMENTS: string,
  TEMPLE_TEAM_EPOCH_2: string,
  TEMPLE_TEAM_EPOCH_3: string,
  TEMPLE_TEAM_EPOCH_4: string,
}

export const DEPLOYED_CONTRACTS: {[key: string]: DeployedContracts} = {
  rinkeby: {
    // From network/environment
    FRAX: '0x5eD8BD53B0c3fa3dEaBd345430B1A3a6A4e8BD7C',

    TEMPLE: '0x359655dcB8A32479680Af81Eb38eA3Bb2B42Af54',

    TEMPLE_TEAM_FIXED_PAYMENTS: '',
    TEMPLE_TEAM_EPOCH_2: '',
    TEMPLE_TEAM_EPOCH_3: '',
    TEMPLE_TEAM_EPOCH_4: '',

    TEMPLE_V2_FRAX_PAIR: '0x57fd5b0CcC0Ad528050a2D5e3b3935c08F058Dca',
    TEMPLE_V2_FEI_PAIR: '', // TODO: Update
    TEMPLE_V2_ROUTER: '', // TOTO: Update with current router

    OPS_MANAGER_LIB: '0xCA3Af256aBe5B11989c8069e1892a4eed8C85c17',
    OPS_MANAGER: '0x0647b5CFC9e9B03629Db83E7Aa4d1E25283DD9Cb',
    JOINING_FEE: '0x28089129bFc5d0279468D08844969c7cbDc9fe78',
    VAULT_PROXY: '0x8adcc775251362B4E03e0437805BE3154C56b3F5',

    MULTISIG: '0x577BB87962b76e60d3d930c1B9Ddd6DFD64d24A2',
  },
  mainnet: {
    // From network/environment
    FRAX: '0x853d955acef822db058eb8505911ed77f175b99e',
    MULTISIG: "0x4D6175d58C5AceEf30F546C0d5A557efFa53A950",

    TEMPLE: '0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7',
    TEMPLE_TEAM_FIXED_PAYMENTS: '0xF7b10A0C780a3906D9A9F3d706EcD2624B6ED84e',
    TEMPLE_TEAM_EPOCH_2: '0xe0Aafcf26576a53Cbec99481607FB53384909C36',
    TEMPLE_TEAM_EPOCH_3: '0xf86c2dbd16f05e86bff72ce89b3c2915812e92d0',
    TEMPLE_TEAM_EPOCH_4: '0x07888e0a8929eb922Aee5930f7B0894BaB5D8120',
    TEMPLE_V2_FRAX_PAIR: '0x6021444f1706f15465bEe85463BCc7d7cC17Fc03',
    TEMPLE_V2_FEI_PAIR: '0xf994158766e0a4E64c26feCE675186f489EC9107',
    TEMPLE_V2_ROUTER: '0x98257c876ace5009e7b97843f8c71b3ae795c71e',

    OPS_MANAGER: '0x65fE8BaBF7DA367b2B45cBD748F0490713f84828',
    OPS_MANAGER_LIB: '0x248bA5985053ee399a76B5822AdeB12FA0ab1424',
    JOINING_FEE: '0x8A17403B929ed1B6B50ea880d9C93068a5105D4C',
    VAULT_PROXY: '0x6f5bB7cC4F3D6628d0095545552757AB377FE15C',
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
    TEMPLE_V2_FRAX_PAIR: process.env.TEMPLE_V2_FRAX_PAIR || '',
    TEMPLE_V2_FEI_PAIR: process.env.TEMPLE_V2_FRAX_PAIR || '',
    TEMPLE_V2_ROUTER: process.env.TEMPLE_V2_ROUTER || '',

    OPS_MANAGER: process.env.OPS_MANAGER || '',
    OPS_MANAGER_LIB: process.env.OPS_MANAGER_LIB || '',
    JOINING_FEE: process.env.JOINING_FEE || '',
    VAULT_PROXY: process.env.VAULT_PROXY || '',

    MULTISIG: '0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199', // Account #19
  }
}
