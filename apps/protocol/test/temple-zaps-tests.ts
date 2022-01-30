import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import axios from 'axios';

import FakeERC20 from '../artifacts/contracts/fakes/FakeERC20.sol/FakeERC20.json';
import { TempleZaps, TempleZaps__factory } from '../typechain';
import { shouldThrow, blockTimestamp, getBalance } from './helpers';
import addresses from './libs/constants';

const BINANCE_ACCOUNT_8 = '0xF977814e90dA44bFA03b6295A0616a897441aceC';
const FRAX_WHALE = '0x820A9eb227BF770A9dd28829380d53B76eAf1209';
const ZEROEX_EXCHANGE_PROXY = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF';
const ZEROEX_QUOTE_ENDPOINT = 'https://api.0x.org/swap/v1/quote?';

const { OG_TEMPLE } = addresses.temple;
const { WETH, USDC, FRAX, ETH } = addresses.tokens;

let TEMPLE_ZAPS: TempleZaps;
let owner: Signer;
let alice: Signer;
let binanceSigner: Signer;
let fraxSigner: Signer;
let ownerAddress: string;
let aliceAddress: string;

describe('TempleZaps', async () => {
  beforeEach(async () => {
    [owner, alice] = await ethers.getSigners();
    binanceSigner = await impersonateAddress(BINANCE_ACCOUNT_8);
    fraxSigner = await impersonateAddress(FRAX_WHALE);

    TEMPLE_ZAPS = await new TempleZaps__factory(owner).deploy();
    ownerAddress = await owner.getAddress();
    aliceAddress = await alice.getAddress();
  });

  describe('Deployment', function () {
    it('should set the right owner', async function () {
      expect(await TEMPLE_ZAPS.owner()).to.equal(ownerAddress);
    });

    it('should allow owner to renounce', async function () {
      await TEMPLE_ZAPS.renounceOwnership();
      expect(await TEMPLE_ZAPS.owner()).to.equal(ethers.constants.AddressZero);
    });

    it('should allow owner to transfer ownership', async function () {
      await TEMPLE_ZAPS.transferOwnership(aliceAddress);
      expect(await TEMPLE_ZAPS.owner()).to.equal(aliceAddress);
    });

    it('should have 0x exchange proxy as an approved target', async function () {
      expect(await TEMPLE_ZAPS.approvedTargets(ZEROEX_EXCHANGE_PROXY)).to.be
        .true;
    });
  });

  describe('ZapIn', async () => {
    afterEach(async () => {
      await resetFork();
    });

    it('should zap ETH to OGTemple', async () => {
      const tokenAddr = ETH;
      const tokenAmount = '10';
      const minTempleReceived = ethers.utils.parseUnits('1', 18).toString();

      await zapIn(
        binanceSigner,
        TEMPLE_ZAPS,
        tokenAddr,
        tokenAmount,
        minTempleReceived
      );
    });

    it('should zap WETH to OGTemple', async () => {
      const tokenAddr = WETH;
      const tokenAmount = '10';
      const minTempleReceived = ethers.utils.parseUnits('1', 18).toString();

      await zapIn(
        binanceSigner,
        TEMPLE_ZAPS,
        tokenAddr,
        tokenAmount,
        minTempleReceived
      );
    });

    it('should zap USDC to OGTemple', async () => {
      const tokenAddr = USDC;
      const tokenAmount = '10000';
      const minTempleReceived = ethers.utils.parseUnits('1', 18).toString();

      await zapIn(
        binanceSigner,
        TEMPLE_ZAPS,
        tokenAddr,
        tokenAmount,
        minTempleReceived
      );
    });

    it('should zap FRAX to OGTemple', async () => {
      const tokenAddr = FRAX;
      const tokenAmount = '10000';
      const minTempleReceived = ethers.utils.parseUnits('1', 18).toString();

      await zapIn(
        fraxSigner,
        TEMPLE_ZAPS,
        tokenAddr,
        tokenAmount,
        minTempleReceived
      );
    });
  });
});

async function zapIn(
  signer: Signer,
  zaps: TempleZaps,
  tokenAddr: string,
  tokenAmount: string,
  minTempleReceived: string
) {
  const tokenContract = new ethers.Contract(tokenAddr, FakeERC20.abi, signer);

  let symbol;
  let decimals;
  let sellToken;
  if (tokenAddr === ETH) {
    symbol = 'ETH';
    decimals = 18;
    sellToken = 'ETH';
  } else {
    symbol = await tokenContract.symbol();
    decimals = await tokenContract.decimals();
    sellToken = tokenAddr;
  }

  // Get OGTemple balance before zap
  const signerAddress = await signer.getAddress();
  const balanceBefore = await getBalance(OG_TEMPLE, signerAddress);
  console.log(
    `Starting OGTemple: ${ethers.utils.formatUnits(balanceBefore, 18)}`
  );
  console.log(`Selling ${tokenAmount} ${symbol}`);

  // Approve token
  if (tokenAddr !== ETH) {
    await tokenContract.approve(
      zaps.address,
      ethers.utils.parseUnits('1000111', decimals)
    );
    const allowance = await tokenContract.allowance(
      signerAddress,
      zaps.address
    );
    console.log(`Allowance: ${ethers.utils.formatUnits(allowance, decimals)}`);
  }

  // Get quote from 0x API
  let swapCallData, price, guaranteedPrice, gas, estimatedGas;
  const sellAmount = ethers.utils.parseUnits(tokenAmount, decimals).toString();

  if (tokenAddr !== FRAX) {
    const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=${sellToken}&sellAmount=${sellAmount}&buyToken=${FRAX}`;
    const response = await axios.get(url);
    ({
      data: { data: swapCallData, price, guaranteedPrice, gas, estimatedGas },
    } = response);

    console.log(`Price of ${symbol} in FRAX: ${price}`);
    console.log(`Guaranteed price: ${guaranteedPrice}`);
  }

  // Do zap
  const zapsConnect = zaps.connect(signer);
  const overrides: { value?: BigNumber } = {};
  if (tokenAddr === ETH) {
    overrides.value = ethers.utils.parseEther(tokenAmount);
  }

  if (tokenAddr === FRAX) {
    await zapsConnect.zapInFRAX(sellAmount, minTempleReceived);
  } else {
    await zapsConnect.zapIn(
      tokenAddr,
      sellAmount,
      minTempleReceived,
      ZEROEX_EXCHANGE_PROXY,
      swapCallData,
      overrides
    );
  }

  // Get OGTemple balance after zap
  const balanceAfter = await getBalance(OG_TEMPLE, signerAddress);
  console.log(`Ending OGTemple: ${ethers.utils.formatUnits(balanceAfter, 18)}`);

  // Expect OGTemple balance to increase
  expect(balanceAfter.gt(balanceBefore)).to.be.true;
}

async function impersonateAddress(address: string) {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  return ethers.provider.getSigner(address);
}

async function resetFork() {
  await network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
          blockNumber: 14108863,
        },
      },
    ],
  });
}
