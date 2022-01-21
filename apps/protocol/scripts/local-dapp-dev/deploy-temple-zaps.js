const { ethers } = require('hardhat');
const axios = require('axios');

const LINK = '0x514910771af9ca656af840dff83e8264ecf986ca';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const FRAX = '0x853d955acef822db058eb8505911ed77f175b99e';
const OG_TEMPLE = '0x654590F810f01B51dc7B86915D4632977e49EA33';

const ZEROEX_EXCHANGE_PROXY = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF';
const ZEROEX_QUOTE_ENDPOINT = 'https://api.0x.org/swap/v1/quote?';

const erc20Abi = [
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [
      {
        name: '',
        type: 'string',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_spender',
        type: 'address',
      },
      {
        name: '_value',
        type: 'uint256',
      },
    ],
    name: 'approve',
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [
      {
        name: '',
        type: 'uint256',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_from',
        type: 'address',
      },
      {
        name: '_to',
        type: 'address',
      },
      {
        name: '_value',
        type: 'uint256',
      },
    ],
    name: 'transferFrom',
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [
      {
        name: '',
        type: 'uint8',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      {
        name: '_owner',
        type: 'address',
      },
    ],
    name: 'balanceOf',
    outputs: [
      {
        name: 'balance',
        type: 'uint256',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [
      {
        name: '',
        type: 'string',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      {
        name: '_to',
        type: 'address',
      },
      {
        name: '_value',
        type: 'uint256',
      },
    ],
    name: 'transfer',
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      {
        name: '_owner',
        type: 'address',
      },
      {
        name: '_spender',
        type: 'address',
      },
    ],
    name: 'allowance',
    outputs: [
      {
        name: '',
        type: 'uint256',
      },
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
  {
    payable: true,
    stateMutability: 'payable',
    type: 'fallback',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'owner',
        type: 'address',
      },
      {
        indexed: true,
        name: 'spender',
        type: 'address',
      },
      {
        indexed: false,
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'Approval',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        name: 'from',
        type: 'address',
      },
      {
        indexed: true,
        name: 'to',
        type: 'address',
      },
      {
        indexed: false,
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'Transfer',
    type: 'event',
  },
];

async function main() {
  const signers = await ethers.getSigners();

  const TempleZaps = await ethers.getContractFactory('TempleZaps');
  const zaps = await TempleZaps.deploy();
  await zaps.deployed();

  console.log('TempleZaps deployed to:', zaps.address);

  // TODO: Fix approval? - SafeERC20: low-level call failed
  // await zapToken(LINK, signers[0], zaps);
  await zapETH(signers[0], zaps);
}

async function zapToken(token, signer, zaps) {
  const provider = ethers.getDefaultProvider();

  const sellAmount = ethers.utils.parseUnits('1000', 18).toString();
  const minTempleReceived = ethers.utils.parseUnits('1', 18).toString();

  const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=${token}&sellAmount=${sellAmount}&buyToken=${FRAX}`;
  const response = await axios.get(url);
  const {
    data: { data: swapCallData },
  } = response;

  const tokenContract = new ethers.Contract(token, erc20Abi, provider);
  const tokenConnect = tokenContract.connect(signer);
  await tokenConnect.approve(zaps.address, ethers.utils.parseUnits('2000', 18));

  const approvedAmount = await tokenConnect.allowance(
    signer.address,
    zaps.address
  );
  console.log(
    `Approved ${zaps.address} for ${ethers.utils.formatUnits(
      approvedAmount,
      18
    )}`
  );

  const zapsConnect = zaps.connect(signer);
  await zapsConnect.ZapIn(
    token,
    sellAmount,
    minTempleReceived,
    ZEROEX_EXCHANGE_PROXY,
    swapCallData
  );
}

async function zapETH(signer, zaps) {
  const ethAmount = '1.0';
  const sellAmount = ethers.utils.parseEther(ethAmount).toString();
  const minTempleReceived = ethers.utils.parseUnits('1000', 18).toString();

  const ogTemple = new ethers.Contract(OG_TEMPLE, erc20Abi, signer);
  const balanceBefore = await ogTemple.balanceOf(signer.address);
  console.log(
    'OGTemple balance before:',
    ethers.utils.formatUnits(balanceBefore, 18)
  );

  const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=ETH&sellAmount=${sellAmount}&buyToken=${FRAX}`;
  const response = await axios.get(url);
  const {
    data: { data: swapCallData },
  } = response;

  const overrides = {
    value: ethers.utils.parseEther(ethAmount),
  };

  const zapsConnect = zaps.connect(signer);
  await zapsConnect.ZapIn(
    ethers.constants.AddressZero,
    sellAmount,
    minTempleReceived,
    ZEROEX_EXCHANGE_PROXY,
    swapCallData,
    overrides
  );

  const balanceAfter = await ogTemple.balanceOf(signer.address);
  console.log(
    'OGTemple balance after:',
    ethers.utils.formatUnits(balanceAfter, 18)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
