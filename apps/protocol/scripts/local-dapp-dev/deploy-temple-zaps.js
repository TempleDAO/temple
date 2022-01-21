const { ethers } = require('hardhat');
const axios = require('axios');
const erc20ABI = require('./ERC20Abi.json');

const LINK = '0x514910771af9ca656af840dff83e8264ecf986ca';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const FRAX = '0x853d955acef822db058eb8505911ed77f175b99e';
const OG_TEMPLE = '0x654590F810f01B51dc7B86915D4632977e49EA33';

const ZEROEX_EXCHANGE_PROXY = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF';
const ZEROEX_QUOTE_ENDPOINT = 'https://api.0x.org/swap/v1/quote?';

const BINANCE_ACCOUNT_8 = '0xF977814e90dA44bFA03b6295A0616a897441aceC';

async function main() {
  // const signers = await ethers.getSigners();
  const binanceSigner = await impersonateAddress(BINANCE_ACCOUNT_8);

  const TempleZaps = await ethers.getContractFactory('TempleZaps');
  const zaps = await TempleZaps.deploy();
  await zaps.deployed();

  console.log('TempleZaps deployed to:', zaps.address);

  console.log('========= Zapping Tokens =========');
  const token = LINK;
  const tokenAmount = '1000';
  await zapToken(binanceSigner, zaps, token, tokenAmount);

  console.log('\n========= Zapping ETH =========');
  const ethAmount = '1.0';
  await zapETH(binanceSigner, zaps, ethAmount);
}

async function zapToken(signer, zaps, token, tokenAmount) {
  const tokenContract = new ethers.Contract(token, erc20ABI, signer);
  const decimals = await tokenContract.decimals();
  const symbol = await tokenContract.symbol();

  const sellAmount = ethers.utils.parseUnits(tokenAmount, decimals).toString();
  const minTempleReceived = ethers.utils.parseUnits('1', 18).toString();

  // Get starting OGTemple balance
  const balanceBefore = await getOGTBalance(signer);
  console.log(`Selling ${tokenAmount} ${symbol}`);
  console.log(
    'OGTemple balance before:',
    ethers.utils.formatUnits(balanceBefore, 18)
  );

  // Approve token
  await tokenContract.approve(
    zaps.address,
    ethers.utils.parseUnits('1000111', decimals)
  );

  // Confirm allowance was set
  const allowance = await tokenContract.allowance(signer.address, zaps.address);
  console.log('Allowance:', ethers.utils.formatUnits(allowance, decimals));

  // Get quote from 0x API
  const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=${token}&sellAmount=${sellAmount}&buyToken=${FRAX}`;
  const response = await axios.get(url);
  const {
    data: { data: swapCallData, price, guaranteedPrice, gas, estimatedGas },
  } = response;

  console.log('Price in FRAX:', price);
  console.log('Guaranteed price:', guaranteedPrice);
  console.log('Estimated swap gas limit:', gas);
  console.log('Estimated swap gas usage:', estimatedGas);

  // Do zap
  const zapsConnect = zaps.connect(signer);
  await zapsConnect.ZapIn(
    token,
    sellAmount,
    minTempleReceived,
    ZEROEX_EXCHANGE_PROXY,
    swapCallData
  );

  // Check OGTemple balance
  const balanceAfter = await getOGTBalance(signer);
  console.log(
    'OGTemple balance after:',
    ethers.utils.formatUnits(balanceAfter, 18)
  );
}

async function zapETH(signer, zaps, ethAmount) {
  const sellAmount = ethers.utils.parseEther(ethAmount).toString();
  const minTempleReceived = ethers.utils.parseUnits('1', 18).toString();

  // Get starting OGTemple balance
  const balanceBefore = await getOGTBalance(signer);
  console.log(`Selling ${ethAmount} ETH`);
  console.log(
    'OGTemple balance before:',
    ethers.utils.formatUnits(balanceBefore, 18)
  );

  // Get quote from 0x API
  const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=ETH&sellAmount=${sellAmount}&buyToken=${FRAX}`;
  const response = await axios.get(url);
  const {
    data: { data: swapCallData, price, guaranteedPrice, gas, estimatedGas },
  } = response;

  console.log('Price in FRAX:', price);
  console.log('Guaranteed price:', guaranteedPrice);
  console.log('Estimated swap gas limit:', gas);
  console.log('Estimated swap gas usage:', estimatedGas);

  // Do zap
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

  // Check OGTemple balance
  const balanceAfter = await getOGTBalance(signer);
  console.log(
    'OGTemple balance after:',
    ethers.utils.formatUnits(balanceAfter, 18)
  );
}

async function getOGTBalance(signer) {
  const ogTemple = new ethers.Contract(OG_TEMPLE, erc20ABI, signer);
  const balanceBefore = await ogTemple.balanceOf(signer.address);
  return balanceBefore;
}

async function impersonateAddress(address) {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  const signer = await ethers.provider.getSigner(address);
  signer.address = signer._address;
  return signer;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
