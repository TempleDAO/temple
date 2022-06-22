import { ethers, network } from "hardhat";
import { Signer, BigNumber, BigNumberish } from "ethers";
import { expect, should } from "chai";
import axios from 'axios';
import { blockTimestamp, shouldThrow, toAtto } from "./helpers";
import { DEPLOYED_CONTRACTS } from '../scripts/deploys/helpers';
import addresses from "./constants";
import { ERC20, ERC20__factory, Exposure, Exposure__factory, Faith, Faith__factory, IERC20, IERC20__factory,
  JoiningFee,
  JoiningFee__factory,
  TempleCoreStaxZaps, TempleCoreStaxZaps__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  TempleStableAMMRouter,
  TempleStableAMMRouter__factory,
  Vault, VaultedTemple, VaultedTemple__factory, VaultProxy, VaultProxy__factory, Vault__factory
} from "../typechain";

const { WETH, USDC, UNI, FRAX, ETH, OGT, FEI, BNB, FXS } = addresses.tokens;
const { BINANCE_ACCOUNT_8, WETH_WHALE, FRAX_WHALE, FXS_WHALE } = addresses.accounts;
const { ZEROEX_EXCHANGE_PROXY, TEMPLE_STABLE_ROUTER } = addresses.contracts;
const { MULTISIG, TEMPLE, TEMPLE_V2_ROUTER, FAITH, STAKING } = DEPLOYED_CONTRACTS.mainnet;

const ZEROEX_QUOTE_ENDPOINT = 'https://api.0x.org/swap/v1/quote?';

let templeZaps: TempleCoreStaxZaps;
let vaultProxy: VaultProxy;
let vault: Vault;
let templeExposure: Exposure;
let vaultedTemple: VaultedTemple;
let templeToken: TempleERC20Token;
let joiningFee: JoiningFee;
let fraxToken: ERC20;
let faith: Faith;
let templeRouter: TempleStableAMMRouter;
let owner: Signer;
let alice: Signer;
let binanceSigner: Signer;
let wethSigner: Signer;
let fraxSigner: Signer;
let ownerAddress: string;
let aliceAddress: string;

describe("Temple Stax Core Zaps", async () => {

  before(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.TESTS_MAINNET_RPC_URL,
            blockNumber: Number(process.env.TESTS_FORK_BLOCK_NUMBER),
          },
        },
      ],
    });
  });

  beforeEach(async () => {
    [owner, alice] = await ethers.getSigners();

    binanceSigner = await impersonateAddress(BINANCE_ACCOUNT_8);
    wethSigner = await impersonateAddress(WETH_WHALE);
    fraxSigner = await impersonateAddress(FRAX_WHALE);

    ownerAddress = await owner.getAddress();
    aliceAddress = await alice.getAddress();

    vaultProxy = await new VaultProxy__factory(owner).deploy(OGT, TEMPLE, STAKING, FAITH);
    templeZaps = await new TempleCoreStaxZaps__factory(owner).deploy(
      TEMPLE,
      FAITH,
      TEMPLE_V2_ROUTER,
      vaultProxy.address
    );
    templeRouter = TempleStableAMMRouter__factory.connect(TEMPLE_STABLE_ROUTER, owner);

    await templeZaps.setApprovedTargets([ZEROEX_EXCHANGE_PROXY, TEMPLE_V2_ROUTER], [true, true]);
    await templeZaps.setPermittableTokens([FRAX, FEI, USDC, UNI], [true, true, true, true]);
    await templeZaps.setTempleRouter(TEMPLE_STABLE_ROUTER);
    await templeZaps.setSupportedStables([FRAX, FEI], [true, true]);
  });

  describe("Admin", async () => {
    it("admin tests", async () => {
      await shouldThrow(templeZaps.connect(alice).setApprovedTargets([ZEROEX_EXCHANGE_PROXY, TEMPLE_STABLE_ROUTER], [true, true]), /Ownable: caller is not the owner/);
      await shouldThrow(templeZaps.connect(alice).toggleContractActive(), /Ownable: caller is not the owner/);
      await shouldThrow(templeZaps.connect(alice).setTempleRouter(TEMPLE_STABLE_ROUTER), /Ownable: caller is not the owner/);
      await shouldThrow(templeZaps.connect(alice).setPermittableTokens([FRAX], [true]), /Ownable: caller is not the owner/);
      await shouldThrow(templeZaps.connect(alice).setSupportedStables([FRAX], [true]), /Ownable: caller is not the owner/);
      await shouldThrow(templeZaps.connect(alice).recoverToken(FRAX, await alice.getAddress(), 100), /Ownable: caller is not the owner/);

      // happy paths
      await templeZaps.setApprovedTargets([ZEROEX_EXCHANGE_PROXY, TEMPLE_STABLE_ROUTER], [true, true]);
      await templeZaps.toggleContractActive();
      await templeZaps.setTempleRouter(TEMPLE_STABLE_ROUTER);
      await templeZaps.setPermittableTokens([FRAX], [true]);
      await templeZaps.setSupportedStables([FRAX], [true]);
    });

    it("sets approved targets", async () => {
      await shouldThrow(templeZaps.setPermittableTokens([ZEROEX_EXCHANGE_PROXY], [true, true]), /Invalid Input length/);
      await templeZaps.setApprovedTargets([ZEROEX_EXCHANGE_PROXY, TEMPLE_STABLE_ROUTER], [true, false]);
      expect(await templeZaps.approvedTargets(ZEROEX_EXCHANGE_PROXY)).to.eq(true);
      expect(await templeZaps.approvedTargets(TEMPLE_STABLE_ROUTER)).to.eq(false);
    });

    it("toggles contract active", async () => {
      const currentState = await templeZaps.paused();
      await templeZaps.toggleContractActive();
      expect(await templeZaps.paused()).to.eq(!currentState);
    });

    it("sets temple router", async () => {
      await templeZaps.setTempleRouter(TEMPLE_STABLE_ROUTER);
      expect(await templeZaps.templeRouter()).to.eq(TEMPLE_STABLE_ROUTER);
    });

    it("sets supported stables", async () => {
      await shouldThrow(templeZaps.setPermittableTokens([UNI, FRAX], [true]), /Invalid Input length/);
      await templeZaps.setSupportedStables([USDC, FRAX], [true, false]);
      expect(await templeZaps.supportedStables(USDC)).to.eq(true);
      expect(await templeZaps.supportedStables(FRAX)).to.eq(false);
    });

    it("sets permittable tokens", async () => {
      await shouldThrow(templeZaps.setPermittableTokens([UNI, FRAX], [true]), /Invalid Input length/);
      await templeZaps.setPermittableTokens([UNI, FRAX], [true, false]);
      expect(await templeZaps.permittableTokens(UNI)).to.eq(true);
      expect(await templeZaps.permittableTokens(FRAX)).to.eq(false);
    });

    it("recovers token", async () => {
      // transfer frax to zaps contract
      const frax = IERC20__factory.connect(FRAX, fraxSigner);
      await frax.transfer(templeZaps.address, 1000);
            
      // recover
      const checkSumedAddr = ethers.utils.getAddress(FRAX);
      await expect(templeZaps.recoverToken(FRAX, await owner.getAddress(), 1000))
          .to.emit(templeZaps, "TokenRecovered")
          .withArgs(checkSumedAddr, await owner.getAddress(), 1000);
      
      expect(await frax.balanceOf(await owner.getAddress())).eq(1000);
    });
  });

  describe("Temple Zaps", async () => {

    beforeEach(async () => {
      await templeZaps.setPermittableTokens([BNB, ETH, FXS], [true, true, true]);
    });

    it("should throw error for unsupported token", async () => {
      await shouldThrow(templeZaps.zapIn(
        OGT,
        100,
        10,
        FRAX,
        ZEROEX_EXCHANGE_PROXY,
        '0x'
      ), /Zaps unsupported for this token/);
    });

    it("should zap ETH to TEMPLE", async () => {
      const tokenAddr = ETH;
      console.log(tokenAddr);
      const tokenAmount = "5";
      const minTempleReceived = ethers.utils.parseUnits("1", 18).toString();

      await zapIn(
        alice,
        templeZaps,
        tokenAddr,
        tokenAmount,
        minTempleReceived
      );
    });

    it("should zap ERC20 tokens to TEMPLE", async () => {
      const tokenAddr = FXS;
      const tokenAmount = "5";
      const minTempleReceived = ethers.utils.parseUnits("1", 18).toString();

      // send some BNB
      const bnbWhale = await impersonateAddress(BINANCE_ACCOUNT_8);
      const bnbToken = IERC20__factory.connect(tokenAddr, bnbWhale);
      await bnbToken.transfer(await alice.getAddress(), ethers.utils.parseEther(tokenAmount));

      await zapIn(
        alice,
        templeZaps,
        tokenAddr,
        tokenAmount,
        minTempleReceived
      );
    });
  });

  describe("Core Zaps", async () => {
    beforeEach(async () => {
      templeToken = await airdropTemple(
        owner,
        [owner, alice],
        toAtto(100000)
      );
    
      joiningFee = await new JoiningFee__factory(owner).deploy(
          toAtto(1),
      );
    
      templeExposure = await new Exposure__factory(owner).deploy(
        "temple exposure",
        "TPL-VAULT-EXPOSURE",
        templeToken.address,
      )
    
      vaultedTemple = await new VaultedTemple__factory(owner).deploy(
        templeToken.address,
        templeExposure.address
      );
    
      await templeExposure.setLiqidator(vaultedTemple.address);
    
      vault = await new Vault__factory(owner).deploy(
          "Temple 1m Vault",
          "TV_1M",
          templeToken.address,
          templeExposure.address,
          vaultedTemple.address,
          60 * 10,
          60,
          { p: 1, q: 1},
          joiningFee.address,
          await blockTimestamp()
      );

      fraxToken = ERC20__factory.connect(FRAX, owner);

      const multiSig = await impersonateAddress(MULTISIG);
      faith = Faith__factory.connect(FAITH, multiSig);
      
      await templeExposure.setMinterState(vault.address, true);
      await templeExposure.setMinterState(await owner.getAddress(), true);
    
      await templeToken.connect(alice).increaseAllowance(vault.address, toAtto(1000000));

      await faith.addManager(await owner.getAddress());
      await faith.addManager(vaultProxy.address);
      await faith.addManager(templeZaps.address);

      await templeZaps.setPermittableTokens([TEMPLE, BNB, FXS], [true, true, true]);
    });

    it("should zap ERC20 tokens to Temple and deposit in vault", async () => {
      const tokenAddr = FXS;
      const tokenAmount = "5";
      const minTempleReceived = ethers.utils.parseUnits("1", 18).toString();

      // send some BNB
      //const bnbWhale = await impersonateAddress(BINANCE_ACCOUNT_8);
      const fxsWhale = await impersonateAddress(FXS_WHALE);
      const bnbToken = IERC20__factory.connect(tokenAddr, fxsWhale);
      await bnbToken.transfer(await alice.getAddress(), ethers.utils.parseEther(tokenAmount));

      await zapInVault(
        alice,
        templeZaps,
        tokenAddr,
        tokenAmount,
        minTempleReceived,
        vault.address
      );
    });

    it("temple+faith and deposit in vault", async () => {
      // fund contract with some temple
      const fundAmount = toAtto(1000);
      await templeToken.transfer(templeZaps.address, fundAmount);
      expect(await templeToken.balanceOf(templeZaps.address)).to.eq(fundAmount);

      const fromToken = ethers.utils.getAddress(templeToken.address);
      const fromAmount = toAtto(1000);
      const feePerTempleScaledPerHour = await joiningFee.calc(await vault.firstPeriodStartTimestamp(), await vault.periodDuration(), vault.address);
      const fee = fromAmount.mul(feePerTempleScaledPerHour).div(toAtto(1));

      await zapInTempleFaith(
        alice,
        fundAmount,
        fromAmount,
        fromAmount,
        fromToken,
        fee
      );
    });

    it("should zap to temple+faith and deposit in vault", async () => {
      const fundAmount = toAtto(1000);
      await templeToken.transfer(templeZaps.address, fundAmount);
      expect(await templeToken.balanceOf(templeZaps.address)).to.eq(fundAmount);

      const fromTokenAddress = ethers.utils.getAddress(FRAX);
      const fromAmount = toAtto(1000);

      // fund alice
      const aliceAddress = await alice.getAddress();
      await fraxToken.connect(fraxSigner).transfer(aliceAddress, fromAmount);
      await fraxToken.connect(alice).increaseAllowance(templeZaps.address, fromAmount);

      // use converted amount here as fromToken is not temple
      const pair = await templeRouter.tokenPair(fromTokenAddress);
      const expectedTemple = await templeRouter.swapExactStableForTempleQuote(pair, fromAmount);
      const feePerTempleScaledPerHour = await joiningFee.calc(await vault.firstPeriodStartTimestamp(), await vault.periodDuration(), vault.address);
      const fee = expectedTemple.mul(feePerTempleScaledPerHour).div(toAtto(1));

      await zapInTempleFaith(
        alice,
        fundAmount,
        fromAmount,
        expectedTemple,
        fromTokenAddress,
        fee
      );
    });
  });

  describe("Zap in LP", async () => {
    beforeEach(async () => {
      templeToken = await airdropTemple(
        owner,
        [owner, alice],
        toAtto(100000)
      );

      fraxToken = ERC20__factory.connect(FRAX, owner);

      // for LP zaps , temple has to be permitted too
      await templeZaps.setPermittableTokens([TEMPLE], [true]);
    
      await templeToken.connect(alice).increaseAllowance(templeZaps.address, toAtto(1000));
    });

    it("adds LP after zapping part temple", async () => {
      // using temple as from token
      const fromToken = TEMPLE;
      const fromAmount = ethers.utils.parseEther("100");

      const zapsTempleBalBefore = await templeToken.balanceOf(templeZaps.address);
      const zapsFraxBalBefore = await fraxToken.balanceOf(templeZaps.address);

      await expect(templeZaps.connect(alice).zapInLP(
        fromToken,
        fromAmount,
        FRAX,
        ZEROEX_EXCHANGE_PROXY,
        "0x"
      ))
      .to.emit(templeZaps, "ZappedInLP");
      

      // ensure no residual tokens
      expect(await fraxToken.balanceOf(templeZaps.address)).to.eq(zapsFraxBalBefore);
      expect(await templeToken.balanceOf(templeZaps.address)).to.eq(zapsTempleBalBefore);
    });
  });
  
});

async function zapInTempleFaith(
  signer: Signer,
  fundAmount: BigNumber,
  fromAmount: BigNumber,
  fromAmountInTemple: BigNumber,
  fromTokenAddress: string,
  fee: BigNumber
) {
  // get some faith for signer
  const signerAddress = await signer.getAddress();
  const faithAmount = 10000;
  await faith.gain(signerAddress, faithAmount);
  const signerFaithBalance = await faith.balances(signerAddress);
  expect(signerFaithBalance.usableFaith).to.eq(faithAmount);

  // zap temple+faith
  const fromToken = ERC20__factory.connect(fromTokenAddress, signer);
  const minTempleReceived = ethers.utils.parseUnits("1", 18).toString();

  // boosted temple
  const boostedAmount = await vaultProxy.getFaithMultiplier(faithAmount, fromAmountInTemple);

  await fromToken.connect(signer).increaseAllowance(templeZaps.address, fromAmountInTemple);
  await expect(templeZaps
    .connect(signer)
    .zapTempleFaithInVault(
      vault.address,
      fromToken.address,
      fromAmount,
      minTempleReceived,
      FRAX,
      ZEROEX_EXCHANGE_PROXY,
      "0x"
    ))
    .to.emit(templeZaps, "ZappedTemplePlusFaithInVault")
    .withArgs(signerAddress, fromToken.address, fromAmount, faithAmount, boostedAmount);
    
  expect(await templeToken.balanceOf(templeZaps.address)).to.eq(fundAmount.sub(boostedAmount.sub(fromAmountInTemple)));
  expect((await faith.balances(signerAddress)).usableFaith).to.eq(0);
  expect(await vault.balanceOf(signerAddress)).to.eq(boostedAmount.sub(fee));
  expect(await templeToken.balanceOf(vaultedTemple.address)).to.eq(boostedAmount);
}

async function airdropTemple(
  owner: Signer,
  airdropRecipients: Signer[],
  airdropAmount: BigNumberish
): Promise<TempleERC20Token> {
  const templeMultisig = await impersonateAddress(MULTISIG)
  const templeToken = TempleERC20Token__factory.connect(TEMPLE, templeMultisig);
  const templeTokenOwner = TempleERC20Token__factory.connect(TEMPLE, owner);

  await templeToken.addMinter(await owner.getAddress());
  for (const u of airdropRecipients) {
    await templeTokenOwner.mint(await u.getAddress(), airdropAmount)
  }

  return templeTokenOwner;
}

async function zapIn(
  signer: Signer,
  zaps: TempleCoreStaxZaps,
  tokenAddr: string,
  tokenAmount: string,
  minTempleReceived: string
) {
  const tokenContract = IERC20__factory.connect(tokenAddr, signer);
  const templeToken = IERC20__factory.connect(TEMPLE, signer);
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
  const balanceBefore = await getBalance(templeToken, signerAddress);
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
  
  const fraxPair = await templeRouter.tokenPair(FRAX);
  // Do zap
  const minExpectedTemple = await getExpectedTemple(
    signer,
    guaranteedPrice,
    tokenAmount,
    fraxPair
  );

  const zapsConnect = zaps.connect(signer);
  const overrides: { value?: BigNumber } = {};
  if (tokenAddr === ETH) {
    overrides.value = ethers.utils.parseEther(tokenAmount);
  }

  await expect(zapsConnect.zapIn(
    tokenAddr,
    sellAmount,
    minTempleReceived,
    FRAX,
    ZEROEX_EXCHANGE_PROXY,
    swapCallData,
    overrides
  ))
  .to.emit(zapsConnect, "ZappedIn");
  console.log(
    `Minimum expected Temple: ${ethers.utils.formatUnits(
      minExpectedTemple,
      18
    )}`
  );
  // Get Temple balance after zap
  const balanceAfter = await getBalance(templeToken, signerAddress);
  console.log(`Ending Temple: ${ethers.utils.formatUnits(balanceAfter, 18)}`);

  expect(balanceAfter.gte(minExpectedTemple)).to.be.true;
  expect(balanceAfter).to.gte(minExpectedTemple.add(balanceBefore));
}

async function zapInVault(
  signer: Signer,
  zaps: TempleCoreStaxZaps,
  tokenAddr: string,
  tokenAmount: string,
  minTempleReceived: string,
  vaultAddr: string
) {
  const tokenContract = IERC20__factory.connect(tokenAddr, signer);
  const templeToken = IERC20__factory.connect(TEMPLE, signer);

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
  const balanceBefore = await getBalance(templeToken, signerAddress);
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
  const zapsConnect = zaps.connect(signer);
  const overrides: { value?: BigNumber } = {};
  if (tokenAddr === ETH) {
    overrides.value = ethers.utils.parseEther(tokenAmount);
  }

  const sellAmountBN = BigNumber.from(sellAmount);
  const feePerTempleScaledPerHour = await joiningFee.calc(await vault.firstPeriodStartTimestamp(), await vault.periodDuration(), vault.address);
  const fee = sellAmountBN.mul(feePerTempleScaledPerHour).div(toAtto(1));
  // convert to approximate temple value for later checks
  const minExpectedTemple = await getExpectedTemple(
    signer,
    guaranteedPrice,
    tokenAmount,
    await templeRouter.tokenPair(FRAX)
  );

  const vaultExposureTokenBefore = await templeExposure.balanceOf(vault.address);
  const vaultedTempleAmountBefore = await templeToken.balanceOf(vaultedTemple.address);
  await expect(zapsConnect.zapInVault(
    tokenAddr,
    sellAmount,
    minExpectedTemple,
    FRAX,
    vaultAddr,
    ZEROEX_EXCHANGE_PROXY,
    swapCallData
  ))
  .to.emit(zapsConnect, "ZappedTempleInVault");

  expect(await templeExposure.balanceOf(vault.address)).to.gte(vaultExposureTokenBefore.add(minExpectedTemple));
  expect(await templeToken.balanceOf(vaultedTemple.address)).to.gte(vaultedTempleAmountBefore.add(minExpectedTemple));
  expect(await vault.balanceOf(signerAddress)).to.gte(minExpectedTemple.sub(fee));
  expect(await templeToken.balanceOf(vaultedTemple.address)).to.gte(minExpectedTemple);

  // Get Temple balance after zap
  const balanceAfter = await getBalance(templeToken, signerAddress);
  expect(balanceAfter).to.gte(balanceBefore);
  console.log(`Ending Temple: ${ethers.utils.formatUnits(balanceAfter, 18)}`);
}

async function impersonateAddress(address: string) {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  return ethers.provider.getSigner(address);
}

async function getExpectedTemple(
  signer: Signer,
  guaranteedPrice: string,
  tokenAmount: string,
  pair: string
): Promise<BigNumber> {
  const ammContract = TempleStableAMMRouter__factory.connect(TEMPLE_STABLE_ROUTER, signer);
  const minFraxReceived = parseFloat(guaranteedPrice) * parseFloat(tokenAmount);
  const minFraxReceivedWei = ethers.utils.parseUnits(
    minFraxReceived.toString(),
    18
  );
  console.log(`Min Frax Received in Wei ${minFraxReceivedWei}`);
  const quote = await ammContract.swapExactStableForTempleQuote(pair, minFraxReceivedWei);
  console.log(`Quote for Temple to receive ${quote}`);
  return quote;
}

async function getBalance(token: IERC20, owner: string) {
  return await token.balanceOf(owner);
};
