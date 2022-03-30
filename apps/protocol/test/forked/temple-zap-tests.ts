import { config, expect } from 'chai';
import { ethers, network } from 'hardhat';
import { BigNumber, Signer } from 'ethers';
import axios from 'axios';
import { signERC2612Permit } from 'eth-permit';

import FakeERC20 from '../../artifacts/contracts/fakes/FakeERC20.sol/FakeERC20.json';
import FakeERC20Permit from '../../artifacts/contracts/fakes/FakeERC20Permit.sol/ERC20PermitMock.json';

import TempleAMM from '../../artifacts/contracts/amm/TempleFraxAMMRouter.sol/TempleFraxAMMRouter.json';

import { TempleZaps, TempleZaps__factory } from '../../typechain';
import { shouldThrow, getBalance } from '../unit/helpers';
import addresses from '../unit/libs/constants';
import { DEPLOYED_CONTRACTS } from '../../scripts/deploys/helpers';

const ZEROEX_QUOTE_ENDPOINT = 'https://api.0x.org/swap/v1/quote?';

const { WETH, USDC, UNI, FRAX, ETH } = addresses.tokens;
const { BINANCE_ACCOUNT_8, WETH_WHALE, FRAX_WHALE } = addresses.accounts;
const { ZEROEX_EXCHANGE_PROXY } = addresses.contracts;
const { MULTISIG, TEMPLE, TEMPLE_V2_ROUTER } = DEPLOYED_CONTRACTS.mainnet;

const NOT_OWNER = /Ownable: caller is not the owner/;
const PAUSED = /Paused/;
const TO_ADDRESS_ZERO = /TZ: to address zero/;

let TEMPLE_ZAPS: TempleZaps;
let owner: Signer;
let alice: Signer;
let binanceSigner: Signer;
let wethSigner: Signer;
let fraxSigner: Signer;
let ownerAddress: string;
let aliceAddress: string;

config.truncateThreshold = 0;

describe('TempleZaps', async () => {
  beforeEach(async () => {
    [owner, alice] = await ethers.getSigners();

    binanceSigner = await impersonateAddress(BINANCE_ACCOUNT_8);
    wethSigner = await impersonateAddress(WETH_WHALE);
    fraxSigner = await impersonateAddress(FRAX_WHALE);

    ownerAddress = await owner.getAddress();
    aliceAddress = await alice.getAddress();

    TEMPLE_ZAPS = await new TempleZaps__factory(owner).deploy(
      TEMPLE,
      TEMPLE_V2_ROUTER
    );
    await TEMPLE_ZAPS.setApprovedTargets([ZEROEX_EXCHANGE_PROXY], [true]);
    await TEMPLE_ZAPS.setPermittableTokens([USDC, UNI], [true, true]);
  });

  describe('Deployment', function () {
    it('should set the right owner', async () => {
      expect(await TEMPLE_ZAPS.owner()).to.equal(ownerAddress);
    });

    it('should have 0x exchange proxy as an approved target', async () => {
      expect(await TEMPLE_ZAPS.approvedTargets(ZEROEX_EXCHANGE_PROXY)).to.be
        .true;
    });

    it('should set temple addresses', async () => {
      expect(await (await TEMPLE_ZAPS.TEMPLE()).toLowerCase()).to.equal(TEMPLE.toLowerCase());
      expect(await (await TEMPLE_ZAPS.TEMPLE_FRAX_AMM_ROUTER()).toLowerCase()).to.equal(
        TEMPLE_V2_ROUTER.toLowerCase()
      );
    });

    it('should set approved targets', async () => {
      expect(await TEMPLE_ZAPS.approvedTargets(ZEROEX_EXCHANGE_PROXY)).to.be
        .true;
    });

    it('should set permittable tokens', async () => {
      expect(await TEMPLE_ZAPS.permittableTokens(USDC)).to.be.true;
      expect(await TEMPLE_ZAPS.permittableTokens(UNI)).to.be.true;
    });
  });

  describe('ZapIn', async () => {
    afterEach(async () => {
      await resetFork();
    });

    it('should zap ETH to TEMPLE', async () => {
      const tokenAddr = ETH;
      console.log(tokenAddr)
      const tokenAmount = '5';
      const minTempleReceived = ethers.utils.parseUnits('1', 18).toString();

      await zapIn(
        alice,
        TEMPLE_ZAPS,
        tokenAddr,
        tokenAmount,
        minTempleReceived
      );
    });

    it('should zap WETH to TEMPLE', async () => {
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

    it('should zap USDC to TEMPLE', async () => {
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

    it('should zap FRAX to TEMPLE', async () => {
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
      const minTempleReceived = ethers.utils.parseUnits('50000', 18).toString();

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

    // Disabled until we implement permits (or OpenZeppelin take their EIP2612 out of draft)
    xit('should zap with permit USDC to TEMPLE', async () => {
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
  });

  describe('Security', async () => {
    describe('Authorization', async () => {
      it('only owner can call onlyOwner functions', async () => {
        const ownerConnect = TEMPLE_ZAPS.connect(owner);
        const aliceConnect = TEMPLE_ZAPS.connect(alice);

        const targets = [MULTISIG];
        const isApproved = [true];

        await shouldThrow(aliceConnect.updateTemple(MULTISIG), NOT_OWNER);
        await shouldThrow(aliceConnect.updateAMMRouter(MULTISIG), NOT_OWNER);
        await shouldThrow(
          aliceConnect.setApprovedTargets(targets, isApproved),
          NOT_OWNER
        );
        await shouldThrow(
          aliceConnect.setPermittableTokens(targets, isApproved),
          NOT_OWNER
        );
        await shouldThrow(aliceConnect.toggleContractActive(), NOT_OWNER);

        await ownerConnect.updateTemple(MULTISIG);
        await ownerConnect.updateAMMRouter(MULTISIG);
        await ownerConnect.setApprovedTargets(targets, isApproved);
        await ownerConnect.setPermittableTokens(targets, isApproved);
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

        await shouldThrow(
          ownerConnect.updateTemple(ethers.constants.AddressZero),
          TO_ADDRESS_ZERO
        );
        await shouldThrow(
          ownerConnect.updateAMMRouter(ethers.constants.AddressZero),
          TO_ADDRESS_ZERO
        );

        await ownerConnect.updateTemple(MULTISIG);
        expect(await TEMPLE_ZAPS.TEMPLE()).to.equal(MULTISIG);
        await expectTempleTokenUpdateEvent(MULTISIG);

        await ownerConnect.updateAMMRouter(MULTISIG);
        expect(await TEMPLE_ZAPS.TEMPLE_FRAX_AMM_ROUTER()).to.equal(MULTISIG);
        await expectAMMAddressUpdateEvent(MULTISIG);
      });

      it('should set approved targets', async () => {
        const targets = [ethers.constants.AddressZero];
        const isApproved = [true];
        await TEMPLE_ZAPS.setApprovedTargets(targets, isApproved);
        expect(await TEMPLE_ZAPS.approvedTargets(targets[0])).to.be.true;
      });

      it('should set permittable tokens', async () => {
        await TEMPLE_ZAPS.setPermittableTokens([WETH], [true]);
        expect(await TEMPLE_ZAPS.permittableTokens(WETH)).to.be.true;
        await TEMPLE_ZAPS.setPermittableTokens([WETH], [false]);
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

  // Get TEMPLE balance before zap
  const signerAddress = await signer.getAddress();
  const balanceBefore = await getBalance(TEMPLE, signerAddress);
  console.log(
    `Starting Temple: ${ethers.utils.formatUnits(balanceBefore, 18)}`
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
    swapCallData = '0x';
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
  const minExpectedTemple = await getExpectedTemple(
    signer,
    guaranteedPrice,
    tokenAmount
  );

  const zapsConnect = zaps.connect(signer);
  const overrides: { value?: BigNumber } = {};
  if (tokenAddr === ETH) {
    overrides.value = ethers.utils.parseEther(tokenAmount);
  }

  await zapsConnect.zapIn(
    tokenAddr,
    sellAmount,
    minTempleReceived,
    Math.floor(Date.now() / 1000) + 1200, // deadline of 20 minutes from now
    ZEROEX_EXCHANGE_PROXY,
    swapCallData,
    overrides
  );

  console.log(
    `Minimum expected Temple: ${ethers.utils.formatUnits(
      minExpectedTemple,
      18
    )}`
  );
  // Get Temple balance after zap
  const balanceAfter = await getBalance(TEMPLE, signerAddress);
  console.log(`Ending Temple: ${ethers.utils.formatUnits(balanceAfter, 18)}`);

  expect(balanceAfter.gte(minExpectedTemple)).to.be.true;
  await expectZappedInEvent(signerAddress, balanceBefore, balanceAfter);
}

async function zapWithPermit(
  signer: Signer,
  zaps: TempleZaps,
  tokenAddr: string,
  tokenAmount: string,
  minTempleReceived: string
) {
  const tokenContract = new ethers.Contract(
    tokenAddr,
    FakeERC20Permit.abi,
    signer
  );
  const signerAddress = await signer.getAddress();

  const symbol = await tokenContract.symbol();
  const sellToken = tokenAddr;
  const decimals = await tokenContract.decimals();

  const zapsConnect = zaps.connect(signer);
  const permitDomain = {
    name: await tokenContract.name(),
    version: tokenAddr === USDC ? '2' : '1',
    chainId: 1, // don't use (await ethers.provider.getNetwork()).chainId on forked mainnet
    verifyingContract: tokenAddr,
  };
  // console.log('permitDomain', permitDomain);
  const sellAmount = ethers.utils.parseUnits(tokenAmount, decimals).toString();

  const balanceBefore = await getBalance(TEMPLE, signerAddress);
  console.log(
    `Starting Temple: ${ethers.utils.formatUnits(balanceBefore, 18)}`
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

  const minExpectedTemple = await getExpectedTemple(
    signer,
    guaranteedPrice,
    tokenAmount
  );

  // Confirm allowance is 0 so we know permit actually increased allowance
  expect(
    await tokenContract.allowance(signerAddress, TEMPLE_ZAPS.address)
  ).to.be.equal(0);

  const { deadline, v, r, s } = await signERC2612Permit(
    owner.provider,
    permitDomain,
    signerAddress,
    TEMPLE_ZAPS.address,
    sellAmount
  );

  // Will need to uncomment this when we release zap with permits
  /*await zapsConnect.zapInWithPermit(
    tokenAddr,
    sellAmount,
    minTempleReceived,
    Math.floor(Date.now() / 1000) + 1200, // amm deadline of 20 minutes from now
    ZEROEX_EXCHANGE_PROXY,
    swapCallData,
    deadline,
    v,
    r,
    s
  );*/

  console.log(
    `Minimum expected Temple: ${ethers.utils.formatUnits(
      minExpectedTemple,
      18
    )}`
  );
  const balanceAfter = await getBalance(TEMPLE, signerAddress);
  console.log(`Ending Temple: ${ethers.utils.formatUnits(balanceAfter, 18)}`);

  expect(balanceAfter.gte(minExpectedTemple)).to.be.true;
  await expectZappedInEvent(signerAddress, balanceBefore, balanceAfter);
}

async function expectZappedInEvent(
  signerAddress: string,
  balanceBefore: BigNumber,
  balanceAfter: BigNumber
) {
  const zappedInEvent = await TEMPLE_ZAPS.queryFilter(
    TEMPLE_ZAPS.filters.zappedIn()
  );
  const event = zappedInEvent[0];
  expect(event.args.sender).to.equal(signerAddress);
  expect(event.args.amountReceived).to.equal(balanceAfter.sub(balanceBefore));
}

async function expectTempleTokenUpdateEvent(tokenAddr: string) {
  const templeTokenAddressSetEvent = await TEMPLE_ZAPS.queryFilter(
    TEMPLE_ZAPS.filters.templeTokenAddressSet()
  );
  const event = templeTokenAddressSetEvent[0];
  expect(event.args.newAddress).to.equal(tokenAddr);
}

async function expectAMMAddressUpdateEvent(ammAddress: string) {
  const templeAMMAddressSetEvent = await TEMPLE_ZAPS.queryFilter(
    TEMPLE_ZAPS.filters.templeAMMAddressSet()
  );
  const event = templeAMMAddressSetEvent[0];
  expect(event.args.newAddress).to.equal(ammAddress);
}

async function getExpectedTemple(
  signer: Signer,
  guaranteedPrice: string,
  tokenAmount: string
): Promise<BigNumber> {
  const ammContract = new ethers.Contract(
    TEMPLE_V2_ROUTER,
    TempleAMM.abi,
    signer
  );

  const minFraxReceived = parseFloat(guaranteedPrice) * parseFloat(tokenAmount);
  const minFraxReceivedWei = ethers.utils.parseUnits(
    minFraxReceived.toString(),
    18
  );
  const quote = await ammContract.swapExactFraxForTempleQuote(
    minFraxReceivedWei
  );
  return quote.amountOutAMM;
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