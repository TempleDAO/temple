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
  TempleZaps, TempleZaps__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  TempleStableAMMRouter,
  TempleStableAMMRouter__factory,
  Vault, VaultedTemple, VaultedTemple__factory, 
  VaultProxy, VaultProxy__factory, Vault__factory, 
  GenericZap__factory, GenericZap
} from "../typechain";
import { string } from "hardhat/internal/core/params/argumentTypes";

const { WETH, USDC, UNI, FRAX, ETH, OGT, FEI, BNB, FXS } = addresses.tokens;
const { BINANCE_ACCOUNT_8, WETH_WHALE, FRAX_WHALE, FXS_WHALE } = addresses.accounts;
const { ZEROEX_EXCHANGE_PROXY, TEMPLE_STABLE_ROUTER, UNISWAP_V2_ROUTER } = addresses.contracts;
const { MULTISIG, TEMPLE, TEMPLE_V2_ROUTER, FAITH, STAKING } = DEPLOYED_CONTRACTS.mainnet;

const ZEROEX_QUOTE_ENDPOINT = 'https://api.0x.org/swap/v1/quote?';
const defaultTokens = [
  FRAX, USDC, FEI, USDC, UNI,
  WETH, FXS, BNB
];

let genericZaps: GenericZap;
let templeZaps: TempleZaps;
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
let alan: Signer;
let binanceSigner: Signer;
let wethSigner: Signer;
let fraxSigner: Signer;
let ownerAddress: string;
let aliceAddress: string;


describe("Temple Stax Core Zaps", async () => {
// comment here
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
    [owner, alice, alan] = await ethers.getSigners();
    binanceSigner = await impersonateAddress(BINANCE_ACCOUNT_8);
    wethSigner = await impersonateAddress(WETH_WHALE);
    fraxSigner = await impersonateAddress(FRAX_WHALE);

    ownerAddress = await owner.getAddress();
    aliceAddress = await alice.getAddress();

    vaultProxy = await new VaultProxy__factory(owner).deploy(OGT, TEMPLE, STAKING, FAITH);
    genericZaps = await new GenericZap__factory(owner).deploy(UNISWAP_V2_ROUTER);
    templeZaps = await new TempleZaps__factory(owner).deploy(
      TEMPLE,
      FAITH,
      TEMPLE_V2_ROUTER,
      vaultProxy.address,
      genericZaps.address
    )
  
    templeRouter = TempleStableAMMRouter__factory.connect(TEMPLE_STABLE_ROUTER, owner);

    //await genericZaps.setApprovedTargets([FRAX, FEI], [ZEROEX_EXCHANGE_PROXY, TEMPLE_V2_ROUTER], [true, true]);
    await approveDefaultTokens(genericZaps);
  });

  describe("Admin", async () => {
    it("admin tests", async () => {
      await shouldThrow(genericZaps.connect(alice).setApprovedTargets([FRAX, TEMPLE], [ZEROEX_EXCHANGE_PROXY, TEMPLE_STABLE_ROUTER], [true, true]), /Ownable: caller is not the owner/);
      await shouldThrow(genericZaps.connect(alice).toggleContractActive(), /Ownable: caller is not the owner/);
      await shouldThrow(genericZaps.connect(alice).recoverToken(FRAX, await alice.getAddress(), 100), /Ownable: caller is not the owner/);
      await shouldThrow(genericZaps.connect(alice).setUniswapV2Router(templeRouter.address), /Ownable: caller is not the owner/);
      await shouldThrow(templeZaps.connect(alice).setZaps(templeRouter.address), /Ownable: caller is not the owner/);

      // happy paths
      await genericZaps.setApprovedTargets([FRAX, TEMPLE], [ZEROEX_EXCHANGE_PROXY, TEMPLE_STABLE_ROUTER], [true, true]);
      await genericZaps.toggleContractActive();
      await genericZaps.setUniswapV2Router(TEMPLE_STABLE_ROUTER);
      await templeZaps.setZaps(genericZaps.address);
    });

    it("sets approved targets", async () => {
      await shouldThrow(genericZaps.setApprovedTargets([FRAX], [ZEROEX_EXCHANGE_PROXY], [true, true]), /Invalid Input length/);
      await genericZaps.setApprovedTargets([FRAX, UNI], [ZEROEX_EXCHANGE_PROXY, TEMPLE_STABLE_ROUTER], [true, false]);
      expect(await genericZaps.approvedTargets(FRAX, ZEROEX_EXCHANGE_PROXY)).to.eq(true);
      expect(await genericZaps.approvedTargets(UNI, TEMPLE_STABLE_ROUTER)).to.eq(false);
    });

    it("toggles contract active", async () => {
      const currentState = await genericZaps.paused();
      await genericZaps.toggleContractActive();
      expect(await genericZaps.paused()).to.eq(!currentState);
    });

    it("sets temple router", async () => {
      await templeZaps.setTempleRouter(TEMPLE_STABLE_ROUTER);
      expect(await templeZaps.templeRouter()).to.eq(TEMPLE_STABLE_ROUTER);
    });

    it("sets supported stables", async () => {
      await shouldThrow(templeZaps.setSupportedStables([UNI, FRAX], [true]), /Invalid Input length/);
      await templeZaps.setSupportedStables([USDC, FRAX], [true, false]);
      expect(await templeZaps.supportedStables(USDC)).to.eq(true);
      expect(await templeZaps.supportedStables(FRAX)).to.eq(false);
    });

    it("recovers token", async () => {
      // transfer frax to zaps contract
      const frax = IERC20__factory.connect(FRAX, fraxSigner);
      await frax.transfer(genericZaps.address, 1000);
            
      // recover
      const checkSumedAddr = ethers.utils.getAddress(FRAX);
      await expect(genericZaps.recoverToken(FRAX, await owner.getAddress(), 1000))
          .to.emit(genericZaps, "TokenRecovered")
          .withArgs(checkSumedAddr, await owner.getAddress(), 1000);
      
      expect(await frax.balanceOf(await owner.getAddress())).eq(1000);
    });
  });

  describe.only("Temple Zaps", async () => {

    beforeEach(async () => {
      //await templeZaps.setPermittableTokens([BNB, ETH, FXS], [true, true, true]);
      //await genericZaps.approvedTargets([BNB, ETH, FXS], [ZEROEX_EXCHANGE_PROXY, UNISWAP_V2_ROUTER, ])
      await approveDefaultTokens(genericZaps);
      await templeZaps.setTempleRouter(TEMPLE_STABLE_ROUTER);
      await templeZaps.setSupportedStables([FRAX, FEI], [true, true]);

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
  
        //await templeZaps.setPermittableTokens([TEMPLE, BNB, FXS], [true, true, true]);
      });
    });

    it("should throw error for unapproved token", async () => {
      
      await shouldThrow(genericZaps.zapIn(
        OGT,
        100,
        FRAX,
        10,
        ZEROEX_EXCHANGE_PROXY,
        '0x'
      ), /Unsupported token\/target/);
    });

    it("should zap ETH to TEMPLE", async () => {
      const tokenAddr = ETH;
      console.log(tokenAddr);
      const tokenAmount = "5";
      const minTempleReceived = ethers.utils.parseUnits("1", 18).toString();

      // await zapIn(
      //   alice,
      //   templeZaps,
      //   tokenAddr,
      //   tokenAmount,
      //   minTempleReceived
      // );
    });

    it("should zap ERC20 tokens to TEMPLE", async () => {
      const tokenAddr = FXS;
      const tokenAmount = "5";
      const minTempleReceived = ethers.utils.parseUnits("1", 18).toString();

      // send some BNB
      const bnbWhale = await impersonateAddress(BINANCE_ACCOUNT_8);
      const bnbToken = IERC20__factory.connect(tokenAddr, bnbWhale);
      await bnbToken.transfer(await alice.getAddress(), ethers.utils.parseEther(tokenAmount));

      await zapTemple(
        alice,
        await alice.getAddress(),
        templeZaps,
        genericZaps,
        tokenAddr,
        tokenAmount
      );
    });

    it("should zap ERC20 tokens to TEMPLE for another recipient", async () => {
      const tokenAddr = FXS;
      const tokenAmount = "5";

      // send some BNB
      const bnbWhale = await impersonateAddress(BINANCE_ACCOUNT_8);
      const bnbToken = IERC20__factory.connect(tokenAddr, bnbWhale);
      await bnbToken.transfer(await alice.getAddress(), ethers.utils.parseEther(tokenAmount));

      await zapTemple(
        alice,
        await alan.getAddress(),
        templeZaps,
        genericZaps,
        tokenAddr,
        tokenAmount
      );
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
        vault.address
      );
    });
  });

  /*describe("Core Zaps", async () => {
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
  });*/
  
});

async function approveDefaultTokens(
  zaps: GenericZap
) {
  let tokens = [];
  let approvals = [];
  let approvedTargets = [];
  const targets = [ZEROEX_EXCHANGE_PROXY, UNISWAP_V2_ROUTER, TEMPLE_STABLE_ROUTER];
  for (const token of defaultTokens) {
    for (const target of targets) {
      tokens.push(token);
      approvedTargets.push(target);
      approvals.push(true);
    }
  }

  await zaps.setApprovedTargets(tokens, approvedTargets, approvals);
}

// async function zapInTempleFaith(
//   signer: Signer,
//   fundAmount: BigNumber,
//   fromAmount: BigNumber,
//   fromAmountInTemple: BigNumber,
//   fromTokenAddress: string,
//   fee: BigNumber
// ) {
//   // get some faith for signer
//   const signerAddress = await signer.getAddress();
//   const faithAmount = 10000;
//   await faith.gain(signerAddress, faithAmount);
//   const signerFaithBalance = await faith.balances(signerAddress);
//   expect(signerFaithBalance.usableFaith).to.eq(faithAmount);

//   // zap temple+faith
//   const fromToken = ERC20__factory.connect(fromTokenAddress, signer);
//   const minTempleReceived = ethers.utils.parseUnits("1", 18).toString();

//   // boosted temple
//   const boostedAmount = await vaultProxy.getFaithMultiplier(faithAmount, fromAmountInTemple);

//   await fromToken.connect(signer).increaseAllowance(templeZaps.address, fromAmountInTemple);
//   await expect(templeZaps
//     .connect(signer)
//     .zapTempleFaithInVault(
//       vault.address,
//       fromToken.address,
//       fromAmount,
//       minTempleReceived,
//       FRAX,
//       ZEROEX_EXCHANGE_PROXY,
//       "0x"
//     ))
//     .to.emit(templeZaps, "ZappedTemplePlusFaithInVault")
//     .withArgs(signerAddress, fromToken.address, fromAmount, faithAmount, boostedAmount);
    
//   expect(await templeToken.balanceOf(templeZaps.address)).to.eq(fundAmount.sub(boostedAmount.sub(fromAmountInTemple)));
//   expect((await faith.balances(signerAddress)).usableFaith).to.eq(0);
//   expect(await vault.balanceOf(signerAddress)).to.eq(boostedAmount.sub(fee));
//   expect(await templeToken.balanceOf(vaultedTemple.address)).to.eq(boostedAmount);
// }

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

/*async function zapInUniToken(
  signer: Signer,
  zaps: GenericZap,
  fromToken: string,
  fromAmount: string,
  toToken: string
) {
  const tokenContract = IERC20__factory.connect(tokenAddr, signer);

}*/

// zap temple using templezaps contract, which uses generic zaps
async function zapTemple(
  signer: Signer,
  zapInfor: string,
  templeZaps: TempleZaps,
  zaps: GenericZap,
  tokenAddr: string,
  tokenAmount: string,
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
  const balanceBefore = signerAddress == zapInfor ? await getBalance(templeToken, signerAddress) : await getBalance(templeToken, zapInfor);
  console.log(
    `Starting Temple: ${ethers.utils.formatUnits(balanceBefore, 18)}`
  );
  console.log(`Selling ${tokenAmount} ${symbol}`);

  // Approve token
  if (tokenAddr !== ETH) {
    await tokenContract.approve(
      templeZaps.address,
      ethers.utils.parseUnits('1000111', decimals)
    );
    const allowance = await tokenContract.allowance(
      signerAddress,
      templeZaps.address
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

  // todo: swap on temple zaps. probably update templezaps to use stable router after first swap
  const minFraxReceived = parseFloat(guaranteedPrice) * parseFloat(tokenAmount);
  const minFraxReceivedWei = ethers.utils.parseUnits(
    minFraxReceived.toString(),
    18
  );
  const fraxPair = await templeRouter.tokenPair(FRAX);
  // Do zap
  const minExpectedTemple = await getExpectedTemple(
    signer,
    guaranteedPrice,
    tokenAmount,
    fraxPair
  );

  const templeZapsConnect = templeZaps.connect(signer);
  const overrides: { value?: BigNumber } = {};
  if (tokenAddr === ETH) {
    overrides.value = ethers.utils.parseEther(tokenAmount);
  }
  const checkSumedTokenAddr = ethers.utils.getAddress(tokenAddr);
  const checkSumedFraxAddr = ethers.utils.getAddress(FRAX);
  if (signerAddress == zapInfor) {
    await expect(templeZapsConnect.zapInTemple(
      tokenAddr,
      sellAmount,
      minExpectedTemple,
      FRAX,
      minFraxReceivedWei,
      ZEROEX_EXCHANGE_PROXY,
      swapCallData,
      overrides
    ))
    .to.emit(zaps, "ZappedIn")
    //.withArgs(templeZaps.address, checkSumedTokenAddr, sellAmount, checkSumedFraxAddr, minFraxReceivedWei);
  } else {
    await expect(templeZapsConnect.zapInTempleFor(
      tokenAddr,
      sellAmount,
      minExpectedTemple,
      FRAX,
      minFraxReceivedWei,
      zapInfor,
      ZEROEX_EXCHANGE_PROXY,
      swapCallData,
      overrides
    ))
    .to.emit(zaps, "ZappedIn")
  }
  
  console.log(
    `Minimum expected Temple: ${ethers.utils.formatUnits(
      minExpectedTemple,
      18
    )}`
  );

  /// check amounts
  const balanceAfter = await getBalance(templeToken, zapInfor);
  console.log(`Ending Temple: ${ethers.utils.formatUnits(balanceAfter, 18)}`);

  expect(balanceAfter.gte(minExpectedTemple)).to.be.true;
  expect(balanceAfter).to.gte(minExpectedTemple.add(balanceBefore));
}

async function zapIn(
  signer: Signer,
  zaps: GenericZap,
  tokenAddr: string,
  tokenAmount: string,
  toTokenAddr: string,
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
  zaps: TempleZaps,
  tokenAddr: string,
  tokenAmount: string,
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
  const minFraxReceived = parseFloat(guaranteedPrice) * parseFloat(tokenAmount);
  const minFraxReceivedWei = ethers.utils.parseUnits(
    minFraxReceived.toString(),
    18
  );
  const vaultExposureTokenBefore = await templeExposure.balanceOf(vault.address);
  const vaultedTempleAmountBefore = await templeToken.balanceOf(vaultedTemple.address);
  await expect(zapsConnect.zapInVault(
    tokenAddr,
    sellAmount,
    minExpectedTemple,
    FRAX,
    minFraxReceivedWei,
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
