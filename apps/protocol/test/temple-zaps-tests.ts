import { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import axios from 'axios';
import { signDaiPermit, signERC2612Permit } from 'eth-permit';

import FakeERC20 from '../artifacts/contracts/fakes/FakeERC20.sol/FakeERC20.json';
import FakeUSDC from '../artifacts/contracts/fakes/FakeUSDC.sol/FiatTokenV2_1.json';

import TempleAMM from '../artifacts/contracts/amm/TempleFraxAMMRouter.sol/TempleFraxAMMRouter.json';
import TempleStaking from '../artifacts/contracts/TempleStaking.sol/TempleStaking.json';

import { TempleZaps, TempleZaps__factory } from '../typechain';
import { shouldThrow, getBalance } from './helpers';
import addresses from './libs/constants';

const BINANCE_ACCOUNT_8 = '0xF977814e90dA44bFA03b6295A0616a897441aceC';
const WETH_WHALE = '0x2497b0f470FAbc47B249A03575aD37D2f65A1A4a';
const FRAX_WHALE = '0x820A9eb227BF770A9dd28829380d53B76eAf1209';
const DAI_WHALE = '0x1e3D6eAb4BCF24bcD04721caA11C478a2e59852D';
const ZEROEX_EXCHANGE_PROXY = '0xDef1C0ded9bec7F1a1670819833240f027b25EfF';
const ZEROEX_QUOTE_ENDPOINT = 'https://api.0x.org/swap/v1/quote?';

const { OG_TEMPLE } = addresses.temple;
const { WETH, UNI, USDC, DAI, FRAX, ETH } = addresses.tokens;

const NOT_OWNER = /Ownable: caller is not the owner/;
const PAUSED = /Paused/;

let TEMPLE_ZAPS: TempleZaps;
let owner: Signer;
let alice: Signer;
let binanceSigner: Signer;
let wethSigner: Signer;
let fraxSigner: Signer;
let daiSigner: Signer;
let ownerAddress: string;
let aliceAddress: string;

describe('TempleZaps', async () => {
  beforeEach(async () => {
    [owner, alice] = await ethers.getSigners();

    binanceSigner = await impersonateAddress(BINANCE_ACCOUNT_8);
    wethSigner = await impersonateAddress(WETH_WHALE);
    fraxSigner = await impersonateAddress(FRAX_WHALE);
    daiSigner = await impersonateAddress(DAI_WHALE);

    ownerAddress = await owner.getAddress();
    aliceAddress = await alice.getAddress();

    TEMPLE_ZAPS = await new TempleZaps__factory(owner).deploy();
  });

  describe('Deployment', function () {
    it('should set the right owner', async () => {
      expect(await TEMPLE_ZAPS.owner()).to.equal(ownerAddress);
    });

    it('should have 0x exchange proxy as an approved target', async () => {
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
      const tokenAmount = '5';
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
        wethSigner,
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

    it('should revert when slippage is too high', async () => {
      const tokenAddr = ETH;
      const tokenAmount = '1';
      const minTempleReceived = ethers.utils.parseUnits('5000', 18).toString();

      await shouldThrow(
        zapIn(
          binanceSigner,
          TEMPLE_ZAPS,
          tokenAddr,
          tokenAmount,
          minTempleReceived
        ),
        /'TempleFraxAMMRouter: INSUFFICIENT_OUTPUT_AMOUNT\'/
      );
    });

    it('should zap with permit USDC to OGTemple', async () => {
      const tokenAddr = USDC;
      const tokenAmount = '5000';
      const minTempleReceived = ethers.utils.parseUnits('1', 18).toString();

      // send some USDC from binance8 to alice (impersonated accounts don't work with permit signing)
      const tokenContract = new ethers.Contract(
        tokenAddr,
        FakeERC20.abi,
        binanceSigner
      );

      const decimals = await tokenContract.decimals();
      const amount = ethers.utils.parseUnits(tokenAmount, decimals).toString();
      await tokenContract.approve(aliceAddress, amount);
      await tokenContract.transfer(aliceAddress, amount);

      await zapWithPermit(
        alice,
        TEMPLE_ZAPS,
        tokenAddr,
        tokenAmount,
        minTempleReceived
      );
    });

    it('should zap with permit DAI to OGTemple', async () => {
      const tokenAddr = DAI;
      const tokenAmount = '5000';
      const minTempleReceived = ethers.utils.parseUnits('1', 18).toString();

      const tokenContract = new ethers.Contract(
        tokenAddr,
        FakeERC20.abi,
        daiSigner
      );

      const decimals = await tokenContract.decimals();
      const amount = ethers.utils.parseUnits(tokenAmount, decimals).toString();
      await tokenContract.approve(aliceAddress, amount);
      await tokenContract.transfer(aliceAddress, amount);

      await zapWithPermit(
        alice,
        TEMPLE_ZAPS,
        tokenAddr,
        tokenAmount,
        minTempleReceived
      );
    });
  });

  describe('Security', async () => {
    describe('Authorization', async () => {
      it('only owner can call onlyOwner functions', async () => {
        const ownerConnect = TEMPLE_ZAPS.connect(owner);
        const aliceConnect = TEMPLE_ZAPS.connect(alice);

        const addrZero = ethers.constants.AddressZero;
        const targets = [addrZero];
        const isApproved = [true];

        await shouldThrow(aliceConnect.updateTemple(addrZero), NOT_OWNER);
        await shouldThrow(aliceConnect.updateStaking(addrZero), NOT_OWNER);
        await shouldThrow(aliceConnect.updateAMMRouter(addrZero), NOT_OWNER);
        await shouldThrow(
          aliceConnect.setApprovedTargets(targets, isApproved),
          NOT_OWNER
        );
        await shouldThrow(aliceConnect.toggleContractActive(), NOT_OWNER);

        await ownerConnect.updateTemple(addrZero);
        await ownerConnect.updateStaking(addrZero);
        await ownerConnect.updateAMMRouter(addrZero);
        await ownerConnect.setApprovedTargets(targets, isApproved);
        await ownerConnect.toggleContractActive();
      });

      it('should disable zapIn when paused', async () => {
        // Pause
        const ownerConnect = TEMPLE_ZAPS.connect(owner);
        await ownerConnect.toggleContractActive();

        // Zap in USDC
        const usdcAddr = USDC;
        const usdcAmount = '10000';
        const minTempleReceived = ethers.utils.parseUnits('1', 18).toString();
        await shouldThrow(
          zapIn(
            binanceSigner,
            TEMPLE_ZAPS,
            usdcAddr,
            usdcAmount,
            minTempleReceived
          ),
          PAUSED
        );

        // Zap in FRAX
        const fraxAddr = FRAX;
        const fraxAmount = '10000';
        await shouldThrow(
          zapIn(
            fraxSigner,
            TEMPLE_ZAPS,
            fraxAddr,
            fraxAmount,
            minTempleReceived
          ),
          PAUSED
        );

        // Zap should work after unpause
        await ownerConnect.toggleContractActive();
        await zapIn(
          binanceSigner,
          TEMPLE_ZAPS,
          usdcAddr,
          usdcAmount,
          minTempleReceived
        );
      });
    });

    describe('Management', async () => {
      it('should allow owner to renounce', async () => {
        await TEMPLE_ZAPS.renounceOwnership();
        expect(await TEMPLE_ZAPS.owner()).to.equal(
          ethers.constants.AddressZero
        );
      });

      it('should allow owner to transfer ownership', async () => {
        await TEMPLE_ZAPS.transferOwnership(aliceAddress);
        expect(await TEMPLE_ZAPS.owner()).to.equal(aliceAddress);
      });

      it('should update Temple contracts', async () => {
        const ownerConnect = TEMPLE_ZAPS.connect(owner);

        await ownerConnect.updateTemple(ethers.constants.AddressZero);
        expect(await TEMPLE_ZAPS.TEMPLE()).to.equal(
          ethers.constants.AddressZero
        );

        await ownerConnect.updateStaking(ethers.constants.AddressZero);
        expect(await TEMPLE_ZAPS.TEMPLE_STAKING()).to.equal(
          ethers.constants.AddressZero
        );

        await ownerConnect.updateAMMRouter(ethers.constants.AddressZero);
        expect(await TEMPLE_ZAPS.TEMPLE_FRAX_AMM_ROUTER()).to.equal(
          ethers.constants.AddressZero
        );
      });

      it('should set approved targets', async () => {
        const targets = [ethers.constants.AddressZero];
        const isApproved = [true];
        await TEMPLE_ZAPS.setApprovedTargets(targets, isApproved);
        expect(await TEMPLE_ZAPS.approvedTargets(targets[0])).to.be.true;
      });

      it('should set permittable tokens', async () => {
        await TEMPLE_ZAPS.setPermittableToken(WETH, true);
        expect(await TEMPLE_ZAPS.permittableTokens(WETH)).to.be.true;
        await TEMPLE_ZAPS.setPermittableToken(WETH, false);
        expect(await TEMPLE_ZAPS.permittableTokens(WETH)).to.be.false;
      });
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

  if (tokenAddr === FRAX) {
    guaranteedPrice = '0.99';
  } else {
    const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=${sellToken}&sellAmount=${sellAmount}&buyToken=${FRAX}`;
    const response = await axios.get(url);
    ({
      data: { data: swapCallData, price, guaranteedPrice, gas, estimatedGas },
    } = response);

    console.log(`Price of ${symbol} in FRAX: ${price}`);
    console.log(`Guaranteed price: ${guaranteedPrice}`);
  }

  // Do zap
  const minOGTemple = await getExpectedOGT(
    signer,
    guaranteedPrice,
    tokenAmount
  );

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
  console.log(`Minimum expected OGT: ${ethers.utils.formatUnits(minOGTemple, 18)}`);
  const balanceAfter = await getBalance(OG_TEMPLE, signerAddress);
  console.log(`Ending OGTemple: ${ethers.utils.formatUnits(balanceAfter, 18)}`);

  expect(balanceAfter.gte(minOGTemple)).to.be.true;
}

async function zapWithPermit(
  signer: Signer,
  zaps: TempleZaps,
  tokenAddr: string,
  tokenAmount: string,
  minTempleReceived: string
) {
  const tokenContract = new ethers.Contract(tokenAddr, FakeUSDC.abi, signer);
  const signerAddress = await signer.getAddress();

  const symbol = await tokenContract.symbol();
  const sellToken = tokenAddr;
  const decimals = await tokenContract.decimals();

  const zapsConnect = zaps.connect(signer);
  const permitDomain = {
    name: await tokenContract.name(),
    version: await tokenContract.version(),
    chainId: 1, // don't use (await ethers.provider.getNetwork()).chainId on forked mainnet
    verifyingContract: tokenAddr,
  };
  // console.log('permitDomain', permitDomain);
  const sellAmount = ethers.utils.parseUnits(tokenAmount, decimals).toString();

  const balanceBefore = await getBalance(OG_TEMPLE, signerAddress);
  console.log(
    `Starting OGTemple: ${ethers.utils.formatUnits(balanceBefore, 18)}`
  );

  // Get quote from 0x API
  let swapCallData, price, guaranteedPrice, gas, estimatedGas;

  const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=${sellToken}&sellAmount=${sellAmount}&buyToken=${FRAX}`;
  const response = await axios.get(url);
  ({
    data: { data: swapCallData, price, guaranteedPrice, gas, estimatedGas },
  } = response);

  console.log(`Price of ${symbol} in FRAX: ${price}`);
  console.log(`Guaranteed price: ${guaranteedPrice}`);

  const minOGTemple = await getExpectedOGT(
    signer,
    guaranteedPrice,
    tokenAmount
  );

  // Confirm allowance is 0 so we know permit actually increased allowance
  expect(
    await tokenContract.allowance(signerAddress, TEMPLE_ZAPS.address)
  ).to.be.equal(0);

  if (tokenAddr === DAI) {
    const { nonce, expiry, v, r, s } = await signDaiPermit(
      owner.provider,
      permitDomain,
      signerAddress,
      TEMPLE_ZAPS.address
    );

    await zapsConnect.zapInDAIWithPermit(
      sellAmount,
      minTempleReceived,
      ZEROEX_EXCHANGE_PROXY,
      swapCallData,
      nonce,
      expiry,
      v,
      r,
      s
    );
  } else {
    const { deadline, v, r, s } = await signERC2612Permit(
      owner.provider,
      permitDomain,
      signerAddress,
      TEMPLE_ZAPS.address,
      sellAmount
    );

    await zapsConnect.zapInWithPermit(
      tokenAddr,
      sellAmount,
      minTempleReceived,
      ZEROEX_EXCHANGE_PROXY,
      swapCallData,
      deadline,
      v,
      r,
      s
    );
  }

  console.log(`Minimum expected OGT: ${ethers.utils.formatUnits(minOGTemple, 18)}`);
  const balanceAfter = await getBalance(OG_TEMPLE, signerAddress);
  console.log(`Ending OGTemple: ${ethers.utils.formatUnits(balanceAfter, 18)}`);

  expect(balanceAfter.gte(minOGTemple)).to.be.true;
}

async function getExpectedOGT(
  signer: Signer,
  guaranteedPrice: string,
  tokenAmount: string
): Promise<BigNumber> {
  const ammContract = new ethers.Contract(
    '0x8A5058100E60e8F7C42305eb505B12785bbA3BcA',
    TempleAMM.abi,
    signer
  );
  const stakingContract = new ethers.Contract(
    '0x4D14b24EDb751221B3Ff08BBB8bd91D4b1c8bc77',
    TempleStaking.abi,
    signer
  );
  const scale = 1000;

  const minFraxReceived = parseFloat(guaranteedPrice) * parseFloat(tokenAmount);
  const minFraxReceivedWei = ethers.utils.parseUnits(
    minFraxReceived.toString(),
    18
  );
  const ammQuote = await ammContract.swapExactFraxForTempleQuote(
    minFraxReceivedWei
  );
  const factor = await stakingContract.getAccumulationFactor(scale);
  const expectedOGTempleWei = ammQuote.amountOutAMM.div(factor);

  return expectedOGTempleWei.mul(scale);
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
        },
      },
    ],
  });
}
