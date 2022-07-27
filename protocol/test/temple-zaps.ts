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
  GenericZap__factory, GenericZap, 
  UniswapV2Pair, UniswapV2Router02NoEth,
  UniswapV2Router02NoEth__factory, UniswapV2Pair__factory,
  ICurvePool__factory, ICurvePool, ICurveFactory__factory, ZapBaseV23__factory, IUniswapV2Pair__factory
} from "../typechain";
import { string } from "hardhat/internal/core/params/argumentTypes";

const { WETH, USDC, UNI, FRAX, ETH, OGT, FEI, BNB, FXS, BAL } = addresses.tokens;
const { BINANCE_ACCOUNT_8, WETH_WHALE, FRAX_WHALE, FXS_WHALE } = addresses.accounts;
const { ZEROEX_EXCHANGE_PROXY, TEMPLE_STABLE_ROUTER, UNISWAP_V2_ROUTER, CURVE_FACTORY, TEMPLE_FRAX_PAIR } = addresses.contracts;
const { MULTISIG, TEMPLE, TEMPLE_V2_ROUTER, FAITH, STAKING } = DEPLOYED_CONTRACTS.mainnet;

const ZEROEX_QUOTE_ENDPOINT = 'https://api.0x.org/swap/v1/quote?';
const defaultTokens = [
  FRAX, USDC, FEI, USDC, UNI,
  WETH, FXS, BNB, BAL
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


// describe("Temple Stax Core Zaps", async () => {
//   before(async () => {
//     await network.provider.request({
//       method: "hardhat_reset",
//       params: [
//         {
//           forking: {
//             jsonRpcUrl: process.env.TESTS_MAINNET_RPC_URL,
//             blockNumber: Number(process.env.TESTS_FORK_BLOCK_NUMBER),
//           },
//         },
//       ],
//     });
//   });

//   beforeEach(async () => {
//     [owner, alice, alan] = await ethers.getSigners();
//     binanceSigner = await impersonateAddress(BINANCE_ACCOUNT_8);
//     wethSigner = await impersonateAddress(WETH_WHALE);
//     fraxSigner = await impersonateAddress(FRAX_WHALE);

//     ownerAddress = await owner.getAddress();
//     aliceAddress = await alice.getAddress();

//     vaultProxy = await new VaultProxy__factory(owner).deploy(OGT, TEMPLE, STAKING, FAITH);
//     genericZaps = await new GenericZap__factory(owner).deploy(UNISWAP_V2_ROUTER);
//     templeZaps = await new TempleZaps__factory(owner).deploy(
//       TEMPLE,
//       FAITH,
//       TEMPLE_V2_ROUTER,
//       vaultProxy.address,
//       genericZaps.address
//     )
  
//     templeRouter = TempleStableAMMRouter__factory.connect(TEMPLE_STABLE_ROUTER, owner);

//     //await genericZaps.setApprovedTargets([FRAX, FEI], [ZEROEX_EXCHANGE_PROXY, TEMPLE_V2_ROUTER], [true, true]);
//     await approveDefaultTokens(genericZaps);
//   });

//   describe("Admin", async () => {
//     it("admin tests", async () => {
//       await shouldThrow(genericZaps.connect(alice).setApprovedTargets([FRAX, TEMPLE], [ZEROEX_EXCHANGE_PROXY, TEMPLE_STABLE_ROUTER], [true, true]), /Ownable: caller is not the owner/);
//       await shouldThrow(genericZaps.connect(alice).toggleContractActive(), /Ownable: caller is not the owner/);
//       await shouldThrow(genericZaps.connect(alice).recoverToken(FRAX, await alice.getAddress(), 100), /Ownable: caller is not the owner/);
//       await shouldThrow(genericZaps.connect(alice).setUniswapV2Router(templeRouter.address), /Ownable: caller is not the owner/);
//       await shouldThrow(templeZaps.connect(alice).setZaps(templeRouter.address), /Ownable: caller is not the owner/);

//       // happy paths
//       await genericZaps.setApprovedTargets([FRAX, TEMPLE], [ZEROEX_EXCHANGE_PROXY, TEMPLE_STABLE_ROUTER], [true, true]);
//       await genericZaps.toggleContractActive();
//       await genericZaps.setUniswapV2Router(TEMPLE_STABLE_ROUTER);
//       await templeZaps.setZaps(genericZaps.address);
//     });

//     it("sets approved targets", async () => {
//       await shouldThrow(genericZaps.setApprovedTargets([FRAX], [ZEROEX_EXCHANGE_PROXY], [true, true]), /Invalid Input length/);
//       await genericZaps.setApprovedTargets([FRAX, UNI], [ZEROEX_EXCHANGE_PROXY, TEMPLE_STABLE_ROUTER], [true, false]);
//       expect(await genericZaps.approvedTargets(FRAX, ZEROEX_EXCHANGE_PROXY)).to.eq(true);
//       expect(await genericZaps.approvedTargets(UNI, TEMPLE_STABLE_ROUTER)).to.eq(false);
//     });

//     it("toggles contract active", async () => {
//       const currentState = await genericZaps.paused();
//       await genericZaps.toggleContractActive();
//       expect(await genericZaps.paused()).to.eq(!currentState);
//     });

//     it("sets temple router", async () => {
//       await templeZaps.setTempleRouter(TEMPLE_STABLE_ROUTER);
//       expect(await templeZaps.templeRouter()).to.eq(TEMPLE_STABLE_ROUTER);
//     });

//     it("sets supported stables", async () => {
//       await shouldThrow(templeZaps.setSupportedStables([UNI, FRAX], [true]), /Invalid Input length/);
//       await templeZaps.setSupportedStables([USDC, FRAX], [true, false]);
//       expect(await templeZaps.supportedStables(USDC)).to.eq(true);
//       expect(await templeZaps.supportedStables(FRAX)).to.eq(false);
//     });

//     it("recovers token", async () => {
//       // transfer frax to zaps contract
//       const frax = IERC20__factory.connect(FRAX, fraxSigner);
//       await frax.transfer(genericZaps.address, 1000);
            
//       // recover
//       const checkSumedAddr = ethers.utils.getAddress(FRAX);
//       await expect(genericZaps.recoverToken(FRAX, await owner.getAddress(), 1000))
//           .to.emit(genericZaps, "TokenRecovered")
//           .withArgs(checkSumedAddr, await owner.getAddress(), 1000);
      
//       expect(await frax.balanceOf(await owner.getAddress())).eq(1000);
//     });
//   });

//   describe("Temple Zaps", async () => {

//     beforeEach(async () => {
//       await approveDefaultTokens(genericZaps);
//       await templeZaps.setTempleRouter(TEMPLE_STABLE_ROUTER);
//       await templeZaps.setSupportedStables([FRAX, FEI], [true, true]);

//       //beforeEach(async () => {
//         templeToken = await airdropTemple(
//           owner,
//           [owner, alice],
//           toAtto(100000)
//         );
      
//         joiningFee = await new JoiningFee__factory(owner).deploy(
//             toAtto(1),
//         );
      
//         templeExposure = await new Exposure__factory(owner).deploy(
//           "temple exposure",
//           "TPL-VAULT-EXPOSURE",
//           templeToken.address,
//         )
      
//         vaultedTemple = await new VaultedTemple__factory(owner).deploy(
//           templeToken.address,
//           templeExposure.address
//         );
      
//         await templeExposure.setLiqidator(vaultedTemple.address);
      
//         vault = await new Vault__factory(owner).deploy(
//             "Temple 1m Vault",
//             "TV_1M",
//             templeToken.address,
//             templeExposure.address,
//             vaultedTemple.address,
//             60 * 10,
//             60,
//             { p: 1, q: 1},
//             joiningFee.address,
//             await blockTimestamp()
//         );
//         fraxToken = ERC20__factory.connect(FRAX, owner);
  
//         const multiSig = await impersonateAddress(MULTISIG);
//         faith = Faith__factory.connect(FAITH, multiSig);
        
//         await templeExposure.setMinterState(vault.address, true);
//         await templeExposure.setMinterState(await owner.getAddress(), true);
      
//         await templeToken.connect(alice).increaseAllowance(vault.address, toAtto(1000000));
  
//         await faith.addManager(await owner.getAddress());
//         await faith.addManager(vaultProxy.address);
//         await faith.addManager(templeZaps.address);

//         // supported stables
//         await templeZaps.setSupportedStables([FRAX, FEI], [true, true]);
//       //});
//     });

//     it("should throw error for unapproved token", async () => {
      
//       await shouldThrow(genericZaps.zapIn(
//         OGT,
//         100,
//         FRAX,
//         10,
//         ZEROEX_EXCHANGE_PROXY,
//         '0x'
//       ), /Unsupported token\/target/);
//     });

//     it("should zap ETH to TEMPLE", async () => {
//       const tokenAddr = ETH;
//       console.log(tokenAddr);
//       const tokenAmount = "5";
//       const minTempleReceived = ethers.utils.parseUnits("1", 18).toString();

//       // await zapIn(
//       //   alice,
//       //   templeZaps,
//       //   tokenAddr,
//       //   tokenAmount,
//       //   minTempleReceived
//       // );
//     });

//     it("should zap ERC20 tokens to TEMPLE", async () => {
//       const tokenAddr = FXS;
//       const tokenAmount = "5";

//       // send some tokens
//       const whale = await impersonateAddress(BINANCE_ACCOUNT_8);
//       const tokenContract = IERC20__factory.connect(tokenAddr, whale);
//       await tokenContract.transfer(await alice.getAddress(), ethers.utils.parseEther(tokenAmount));

//       await zapTemple(
//         alice,
//         await alice.getAddress(),
//         templeZaps,
//         genericZaps,
//         tokenAddr,
//         tokenAmount
//       );
//     });

//     it("should zap ERC20 tokens to TEMPLE for another recipient", async () => {
//       const tokenAddr = FXS;
//       const tokenAmount = "5";

//       // send some FXS
//       const bnbWhale = await impersonateAddress(BINANCE_ACCOUNT_8);
//       const fxsToken = IERC20__factory.connect(tokenAddr, bnbWhale);
//       await fxsToken.transfer(await alice.getAddress(), ethers.utils.parseEther(tokenAmount));

//       await zapTemple(
//         alice,
//         await alan.getAddress(),
//         templeZaps,
//         genericZaps,
//         tokenAddr,
//         tokenAmount
//       );
//     });

//     it("should zap ERC20 tokens to Temple and deposit in vault", async () => {
//       const tokenAddr = FXS;
//       const tokenAmount = "5";

//       // send some BNB
//       //const bnbWhale = await impersonateAddress(BINANCE_ACCOUNT_8);
//       const fxsWhale = await impersonateAddress(FXS_WHALE);
//       const bnbToken = IERC20__factory.connect(tokenAddr, fxsWhale);
//       await bnbToken.transfer(await alice.getAddress(), ethers.utils.parseEther(tokenAmount));
//       await templeZaps.setSupportedStables([FRAX, FEI], [true, true]);
//       await zapInVault(
//         alice,
//         templeZaps,
//         tokenAddr,
//         tokenAmount,
//         vault.address
//       );
//     });

//     it("temple+faith and deposit in vault", async () => {
//       // fund contract with some temple
//       const fundAmount = toAtto(1000);
//       await templeToken.transfer(templeZaps.address, fundAmount);
//       expect(await templeToken.balanceOf(templeZaps.address)).to.eq(fundAmount);

//       const fromToken = ethers.utils.getAddress(templeToken.address);
//       //const fromAmount = toAtto(1000);
//       const fromAmount = "1000";
//       const fromAmountParsed = ethers.utils.parseEther(fromAmount);
//       const feePerTempleScaledPerHour = await joiningFee.calc(await vault.firstPeriodStartTimestamp(), await vault.periodDuration(), vault.address);
//       const fee = fromAmountParsed.mul(feePerTempleScaledPerHour).div(toAtto(1));
//       await faith.addManager(templeZaps.address);
//       await zapInTempleFaith(
//         alice,
//         await alice.getAddress(),
//         fundAmount,
//         fromAmount,
//         fromToken,
//         fee
//       );
//     });

//     it("should zap token to temple+faith and deposit in vault", async () => {
//       // fund contract with some temple
//       const fundAmount = toAtto(1000);
//       await templeToken.transfer(templeZaps.address, fundAmount);
//       expect(await templeToken.balanceOf(templeZaps.address)).to.eq(fundAmount);

//       const tokenAddr = ethers.utils.getAddress(FXS);
//       const tokenAmount = "50";

//       // send some FXS
//       const bnbWhale = await impersonateAddress(BINANCE_ACCOUNT_8);
//       const fxsToken = IERC20__factory.connect(tokenAddr, bnbWhale);
//       await fxsToken.transfer(await alice.getAddress(), ethers.utils.parseEther(tokenAmount));

//       const fromAmountParsed = ethers.utils.parseEther(tokenAmount);
//       const feePerTempleScaledPerHour = await joiningFee.calc(await vault.firstPeriodStartTimestamp(), await vault.periodDuration(), vault.address);
//       const fee = fromAmountParsed.mul(feePerTempleScaledPerHour).div(toAtto(1));
//       await faith.addManager(templeZaps.address);

//       await zapInTempleFaith(
//         alice,
//         await alice.getAddress(),
//         fundAmount,
//         tokenAmount,
//         tokenAddr,
//         fee
//       );
//     });

//     it.only("zaps token and adds temple LP", async () => {
//       const tokenAddr = ethers.utils.getAddress(FXS);
//       const tokenAmount = "1";

//       // send some tokens
//       const whale = await impersonateAddress(BINANCE_ACCOUNT_8);
//       const tokenContract = IERC20__factory.connect(tokenAddr, whale);
//       await tokenContract.transfer(await alice.getAddress(), ethers.utils.parseEther(tokenAmount));

//       await templeZaps.connect(owner).setSupportedStables([FRAX, FEI], [true, true]);
//       console.log("s frax", await templeZaps.supportedStables(FRAX));
//       console.log("s fei", await templeZaps.supportedStables(FEI));
//       await zapInTempleLP(
//         alice,
//         templeZaps,
//         genericZaps,
//         TEMPLE_FRAX_PAIR,
//         tokenAddr,
//         tokenAmount,
//         await alice.getAddress(),
//         false
//       );
//     });
//   });

//   describe("Generic Zaps", async () => {
    
//     const tokenAddr = ethers.utils.getAddress(FXS);
//     const tokenAmount = "50";
//     beforeEach( async () => {
//       // send some FXS
//       const bnbWhale = await impersonateAddress(BINANCE_ACCOUNT_8);
//       const fxsToken = IERC20__factory.connect(tokenAddr, bnbWhale);
//       await fxsToken.transfer(await alice.getAddress(), ethers.utils.parseEther(tokenAmount));
//     });

//     it("zaps in erc20 tokens to erc20 tokens", async () => {
//       console.log(`Alice, Owner ; ${await alice.getAddress()} ${await owner.getAddress()}`);
//       await zapIn(
//         alice,
//         await alice.getAddress(),
//         genericZaps,
//         tokenAddr,
//         tokenAmount,
//         UNI
//       );
//     });

//     it("zaps in erc20 tokens to erc20 tokens for other user", async () => {
//       console.log(`Alice, Owner ; ${await alice.getAddress()} ${await owner.getAddress()}`);
//       await zapIn(
//         alice,
//         await alan.getAddress(),
//         genericZaps,
//         tokenAddr,
//         tokenAmount,
//         UNI
//       );
//     });

//     it("zaps in uniswap v2 LP", async () => {
//       const router = UniswapV2Router02NoEth__factory.connect(UNISWAP_V2_ROUTER, alice);
//       const fxsFraxPairAddress = "0xE1573B9D29e2183B1AF0e743Dc2754979A40D237";
//       const pair = UniswapV2Pair__factory.connect(fxsFraxPairAddress, alice);
      
//       console.log("token 0", await pair.token0());
//       await zapInLPUniV2(
//         alice,
//         genericZaps,
//         router,
//         pair,
//         tokenAddr,
//         tokenAmount,
//         await alice.getAddress(),
//         false,
//         false
//       );
//     });

//     it("zaps in uniswap v2 LP, transferring residual", async () => {
//       const router = UniswapV2Router02NoEth__factory.connect(UNISWAP_V2_ROUTER, alice);
//       const fxsFraxPairAddress = "0xE1573B9D29e2183B1AF0e743Dc2754979A40D237";
//       const pair = UniswapV2Pair__factory.connect(fxsFraxPairAddress, alice);
      
//       await zapInLPUniV2(
//         alice,
//         genericZaps,
//         router,
//         pair,
//         tokenAddr,
//         tokenAmount,
//         await alice.getAddress(),
//         false,
//         true
//       );
//     });

//     it("zaps in uniswap v2 LP for another user, transferring residual", async () => {
//       const router = UniswapV2Router02NoEth__factory.connect(UNISWAP_V2_ROUTER, alice);
//       const fxsFraxPairAddress = "0xE1573B9D29e2183B1AF0e743Dc2754979A40D237";
//       const pair = UniswapV2Pair__factory.connect(fxsFraxPairAddress, alice);
      
//       await zapInLPUniV2(
//         alice,
//         genericZaps,
//         router,
//         pair,
//         tokenAddr,
//         tokenAmount,
//         await alan.getAddress(),
//         false,
//         true
//       );
//     });

//     it("zaps in curve LP", async () => {
//       const fxsCvxFxsPool = "0xd658A338613198204DCa1143Ac3F01A722b5d94A";
//       const cvxFxs = "0xFEEf77d3f69374f66429C91d732A244f074bdf74";
//       const pool = ICurvePool__factory.connect(fxsCvxFxsPool, alice);

//       // const fraxUsdcPool = "0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2";
//       // const pool = ICurvePool__factory.connect(fraxUsdcPool, alice);

//       // const fxsSdFxsPool = "0x8c524635d52bd7b1Bd55E062303177a7d916C046";
//       // const sdFxs = "0x402F878BDd1f5C66FdAF0fabaBcF74741B68ac36";
//       //const pool = ICurvePool__factory.connect(fxsSdFxsPool, alice);
//       const poolAddress = pool.address;

//       await genericZaps.setApprovedTargets([FXS, cvxFxs], [poolAddress, poolAddress], [true, true]);
//       // await genericZaps.setApprovedTargets([FXS, sdFxs], [poolAddress, poolAddress], [true, true]);
//       await zapInLPCurvePool(
//         alice,
//         genericZaps,
//         pool,
//         tokenAddr,
//         tokenAmount,
//         await alice.getAddress(),
//         true,
//         false
//       );
//     });

//     it("zaps in curve LP for another user", async () => {
//       const fxsCvxFxsPool = "0xd658A338613198204DCa1143Ac3F01A722b5d94A";
//       const cvxFxs = "0xFEEf77d3f69374f66429C91d732A244f074bdf74";
//       const pool = ICurvePool__factory.connect(fxsCvxFxsPool, alice);
//       const poolAddress = pool.address;
//       await genericZaps.setApprovedTargets([FXS, cvxFxs], [poolAddress, poolAddress], [true, true]);
//       await zapInLPCurvePool(
//         alice,
//         genericZaps,
//         pool,
//         tokenAddr,
//         tokenAmount,
//         await alan.getAddress(),
//         true,
//         false
//       );
//     });

//     it("zaps in balancer LP", async () => {
      
//     });
//   });
// });

// async function approveDefaultTokens(
//   zaps: GenericZap
// ) {
//   let tokens = [];
//   let approvals = [];
//   let approvedTargets = [];
//   const targets = [ZEROEX_EXCHANGE_PROXY, UNISWAP_V2_ROUTER, TEMPLE_STABLE_ROUTER];
//   for (const token of defaultTokens) {
//     for (const target of targets) {
//       tokens.push(token);
//       approvedTargets.push(target);
//       approvals.push(true);
//     }
//   }
//   await zaps.setApprovedTargets(tokens, approvedTargets, approvals);
// }

// async function zapInTempleLP(
//   signer: Signer,
//   zaps: TempleZaps,
//   gZaps: GenericZap,
//   pair: string,
//   fromToken: string,
//   fromAmount: string,
//   zapInFor: string,
//   transferResidual: boolean
// ) {
//   // init vars
//   const signerAddress = await signer.getAddress();
//   const fromTokenContract = IERC20__factory.connect(fromToken, signer);
//   const pairContract = IUniswapV2Pair__factory.connect(pair, signer);
//   let fromTokenDecimals;
//   let sellToken;
//   let symbol;
//   if (fromToken === ETH) {
//     symbol = 'ETH';
//     fromTokenDecimals = 18;
//     sellToken = 'ETH';
//   } else {
//     symbol = await fromTokenContract.symbol();
//     fromTokenDecimals = await fromTokenContract.decimals();
//     sellToken = fromToken;
//   }
//   const fromAmountBN = ethers.utils.parseUnits(fromAmount, fromTokenDecimals);
//   // approve zaps
//   if (fromToken !== ETH) {
//     await fromTokenContract.approve(
//       zaps.address,
//       ethers.utils.parseUnits('1000111', fromTokenDecimals)
//     );
//     const allowance = await fromTokenContract.allowance(
//       signerAddress,
//       zaps.address
//     );
//     console.log(`Allowance: ${ethers.utils.formatUnits(allowance, fromTokenDecimals)}`);
//   }
//   const token0 = await pairContract.token0();
//   const token1 = await pairContract.token1();
//   const sellAmount = fromAmountBN.toString();
//   let swapCallData, price, guaranteedPrice, gas, estimatedGas;
//   let otherToken;
//   let lpSwapMinAmountOut;
//   let remainder;
//   let reserveA, reserveB, ts;
//   let amountAMin, amountBMin;
//   let toToken = token0; // defaulted
//   const tokenCheckSummed = ethers.utils.getAddress(fromToken);
//   // if token is neither token0 nor token1, get swap data
//   if (tokenCheckSummed != token0 && tokenCheckSummed != token1) {
//     // use stable
//     toToken = equalAddresses(token0, TEMPLE) ? token1 : token0;
//     const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=${sellToken}&sellAmount=${sellAmount}&buyToken=${toToken}`;
//     const response = await axios.get(url);
//     ({
//       data: { data: swapCallData, price, guaranteedPrice, gas, estimatedGas },
//     } = response);
//     console.log(response);
//     console.log(JSON.stringify(response.data.orders));
//     console.log(`Price of ${symbol} in ${toToken}: ${price}`);
//     console.log(`Guaranteed price: ${guaranteedPrice}`);

//     // use a smaller min buy Amount
//     const ABI = [
//       "function sellToUniswap(address[],uint256,uint256,bool)"
//     ]; // special case for test pool (meta)
//     const iface = new ethers.utils.Interface(ABI);
//     const r = iface.decodeFunctionData("sellToUniswap", swapCallData);
//     //console.log("interface things");
//     //console.log(r);
//     // make min amount 1 to check if it still fails
//     const newData = iface.encodeFunctionData("sellToUniswap", [r[0], r[1], 1, r[3]]);
//     swapCallData = newData;
//     console.log("new swap calldata ", swapCallData);
//     // calculate min amount out for stable
//     const toTokenContract = IERC20__factory.connect(toToken, signer);
//     const toTokenDecimals = await toTokenContract.decimals();
//     const minTokenReceived = parseFloat(guaranteedPrice) * parseFloat(fromAmount);
//     const minTokenReceivedWei = ethers.utils.parseUnits(
//       minTokenReceived.toString(),
//       toTokenDecimals
//     );
//     [reserveA, reserveB, ts] = await pairContract.getReserves();
//     const reserveIn = equalAddresses(token0, TEMPLE) ? reserveB : reserveA;
//     const swapInAmount = await gZaps.getSwapInAmount(reserveIn, minTokenReceivedWei);
//     remainder = minTokenReceivedWei.sub(swapInAmount);
//     lpSwapMinAmountOut = await templeRouter.swapExactStableForTempleQuote(pair, swapInAmount);
//   } else {
//     [reserveA, reserveB, ts] = await pairContract.getReserves();
//     // fromToken could be either stable or temple
//     let reserveIn;
//     if (equalAddresses(tokenCheckSummed, TEMPLE)) {
//       reserveIn = equalAddresses(token0, TEMPLE) ? reserveA : reserveB;
//       const swapInAmount = await gZaps.getSwapInAmount(reserveIn, fromAmountBN);
//       remainder = fromAmountBN.sub(swapInAmount);
//       let priceBelowIv;
//       [priceBelowIv, lpSwapMinAmountOut] = await templeRouter.swapExactTempleForStableQuote(pair, swapInAmount);
//     } else {
//       reserveIn = equalAddresses(token0, TEMPLE) ? reserveB : reserveA;
//       const swapInAmount = await gZaps.getSwapInAmount(reserveIn, fromAmountBN);
//       remainder = fromAmountBN.sub(swapInAmount);
//       lpSwapMinAmountOut = await templeRouter.swapExactStableForTempleQuote(pair, swapInAmount);
//     }
//     //toToken = fromToken;
//     swapCallData = "0x";
//   }

//   // so now liquidity addition will be for remainder(stable) + lpSwapMinAmountOut(temple)
//   const amountADesired = equalAddresses(token0, TEMPLE) ? lpSwapMinAmountOut : remainder;
//   const amountBDesired = equalAddresses(token0, TEMPLE) ? remainder : lpSwapMinAmountOut;
//   [amountAMin, amountBMin] = await gZaps.addLiquidityGetMinAmounts(amountADesired, amountBDesired, pair);
//   const stableToken = equalAddresses(token0, TEMPLE) ? token1 : token0;
//   console.log("token0, temple", token0, TEMPLE, token1);
//   console.log("signer", signerAddress);
//   console.log("approval", await fromTokenContract.allowance(signerAddress, zaps.address));
//   const params = {
//     amountAMin,
//     amountBMin,
//     lpSwapMinAmountOut,
//     stableToken,
//     transferResidual
//   }
//   //console.log("stable token ", stableToken);
//   const zapsConnect = zaps.connect(signer);
//   const overrides: { value?: BigNumber } = {};
//   if (fromToken === ETH) {
//     overrides.value = ethers.utils.parseEther(fromAmount);
//   }
//   console.log(`${fromToken} ${fromAmountBN} ${ZEROEX_EXCHANGE_PROXY} ${JSON.stringify(params)} ${swapCallData}`)
//   if (signerAddress == zapInFor) {
//     await zapsConnect.zapInTempleLP(
//       fromToken,
//       fromAmountBN,
//       ZEROEX_EXCHANGE_PROXY,
//       params,
//       swapCallData,
//       overrides
//     )
//   } else {

//   }
// }

// function equalAddresses(
//   addressA: string,
//   addressB: string
// ): boolean {
//   return ethers.utils.getAddress(addressA) == ethers.utils.getAddress(addressB);
// }

// async function zapInLPCurvePool(
//   signer: Signer,
//   zaps: GenericZap,
//   pool: ICurvePool,
//   fromToken: string,
//   fromAmount: string,
//   zapInFor: string,
//   useAltFunction: boolean,
//   isOneSidedLiquidityAddition: boolean
// ) {
//   // init vars
//   const signerAddress = await signer.getAddress();
//   const token0 = await pool.coins(0);
//   const token1 = await pool.coins(1);
//   const poolToken0Contract = IERC20__factory.connect(token0, signer);
//   const poolToken1Contract = IERC20__factory.connect(token1, signer);
//   const curveFactory = ICurveFactory__factory.connect(CURVE_FACTORY, signer);
//   const fromTokenContract = IERC20__factory.connect(fromToken, signer);
//   let fromTokenDecimals;
//   let sellToken;
//   let symbol;
//   if (fromToken === ETH) {
//     symbol = 'ETH';
//     fromTokenDecimals = 18;
//     sellToken = 'ETH';
//   } else {
//     symbol = await fromTokenContract.symbol();
//     fromTokenDecimals = await fromTokenContract.decimals();
//     sellToken = fromToken;
//   }
//   const fromAmountBN = ethers.utils.parseUnits(fromAmount, fromTokenDecimals);
//   // approve zaps
//   if (fromToken !== ETH) {
//     await fromTokenContract.approve(
//       zaps.address,
//       ethers.utils.parseUnits('1000111', fromTokenDecimals)
//     );
//     const allowance = await fromTokenContract.allowance(
//       signerAddress,
//       zaps.address
//     );
//     console.log(`Allowance: ${ethers.utils.formatUnits(allowance, fromTokenDecimals)}`);
//   }
//   const sellAmount = fromAmountBN.toString();
//   let swapCallData, price, guaranteedPrice, gas, estimatedGas;
//   let firstSwapMinAmountOut;
//   let otherToken;
//   let toToken = token0; // defaulted
//   let poolSwapMinAmountOut;
//   let poolSwapData = "0x";
//   let dy;
//   const nCoins = await curveFactory.get_n_coins(pool.address);
//   let amounts = new Array(nCoins).fill(BigNumber.from(0));
//   const tokenCheckSummed = ethers.utils.getAddress(fromToken);
//   // if token is neither token0 nor token1, get swap data
//   if (tokenCheckSummed != token0 && tokenCheckSummed != token1) {
//     toToken = token0 == WETH ? token1 : token0;
//     const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=${sellToken}&sellAmount=${sellAmount}&buyToken=${toToken}`;
//     const response = await axios.get(url);
//     ({
//       data: { data: swapCallData, price, guaranteedPrice, gas, estimatedGas },
//     } = response);

//     console.log(`Price of ${symbol} in ${toToken}: ${price}`);
//     console.log(`Guaranteed price: ${guaranteedPrice}`);

//     // calculate min amount out
//     const toTokenContract = IERC20__factory.connect(toToken, signer);
//     const toTokenDecimals = await toTokenContract.decimals();
//     const minTokenReceived = parseFloat(guaranteedPrice) * parseFloat(fromAmount);
//     const minTokenReceivedWei = ethers.utils.parseUnits(
//       minTokenReceived.toString(),
//       toTokenDecimals
//     );
//     firstSwapMinAmountOut = minTokenReceivedWei;
//     otherToken = toToken == token0 ? token1 : token0;
    
//   } else {
//     //
//     toToken = fromToken;
//     swapCallData = "0x";
//     firstSwapMinAmountOut = fromAmountBN;
//     otherToken = tokenCheckSummed == token0 ? token1: token0;
//   }
//   // compose swap data
//   //add_liquidity(amounts, _minCurveAmountOut, address(this))
//   // add_liquidity(uint256[n_coins] calldata _amounts, uint256 _min_mint_amount, address destination)
//   const ABI = [
//     "function add_liquidity(uint256[],uint256,bool,address)",
//     "function exchange(uint256,uint256,uint256,uint256,bool,address)"
//   ]; // special case for test pool (meta)
//   const iface = new ethers.utils.Interface(ABI);

//   if (isOneSidedLiquidityAddition) {
//     if (toToken == token0) {
//       dy = await pool.get_dy(0, 1, firstSwapMinAmountOut);
//       // amounts[0] = firstSwapMinAmountOut;
//     } else {
//       dy = await pool.get_dy(1, 0, firstSwapMinAmountOut);
//       // amounts[1] = firstSwapMinAmountOut;
//     }
//     poolSwapData = "0x";
//   } else {
//     let indexes = [];
//     let toSwapIn = firstSwapMinAmountOut;
//     const leftover = toSwapIn.div(2);
//     toSwapIn = toSwapIn.sub(leftover);
//     if (toToken == token0) {
//       dy = await pool.get_dy(0, 1, toSwapIn);
//       // amounts[0] = leftover;
//       // amounts[1] = dy;
//       indexes =[0, 1];
//     } else {
//       dy = await pool.get_dy(1, 0, toSwapIn);
//       // amounts[0] = dy;
//       // amounts[1] = leftover;
//       indexes = [1, 0];
//     }
//     poolSwapData = iface.encodeFunctionData("exchange", [indexes[0], indexes[1], toSwapIn, dy, false, zaps.address]);
//   }
  
//   // const minMintAmount = await pool.calc_token_amount(amounts, true);
//   const minLiquidityOut = 1;
//   // const mintAmount = await pool.add_liquidity(amounts, minMintAmount, zapInFor);
//   //poolSwapData = pool.interface.encodeFunctionData("add_liquidity", [amounts, minMintAmount, zapInFor]);
//   //poolSwapData = iface.encodeFunctionData("add_liquidity", [amounts, minMintAmount, false, zapInFor]);
//   //poolSwapData = pool.interface.encodeFunctionData("exchange", [])

//   poolSwapMinAmountOut = dy;

//   const zapLiqRequest = {
//     firstSwapMinAmountOut,
//     useAltFunction,
//     poolSwapMinAmountOut,
//     isOneSidedLiquidityAddition,
//     otherToken,
//     minLiquidityOut,
//     poolSwapData
//   }

//   const zapsConnect = zaps.connect(signer);
//   const overrides: { value?: BigNumber } = {};
//   if (fromToken === ETH) {
//     overrides.value = ethers.utils.parseEther(fromAmount);
//   }

//   if (signerAddress == zapInFor) {
//     await expect(zapsConnect.zapLiquidityCurvePool(
//       fromToken,
//       fromAmountBN,
//       pool.address,
//       ZEROEX_EXCHANGE_PROXY,
//       swapCallData,
//       zapLiqRequest,
//       overrides
//     ))
//     .to.emit(zaps, "ZappedLPCurve");
//   } else {
//     await expect(zapsConnect.zapLiquidityCurvePoolFor(
//       fromToken,
//       fromAmountBN,
//       pool.address,
//       zapInFor,
//       ZEROEX_EXCHANGE_PROXY,
//       swapCallData,
//       zapLiqRequest,
//       overrides
//     ))
//     .to.emit(zaps, "ZappedLPCurve");
//   }

//   // checks

// }

// async function zapInLPUniV2(
//   signer: Signer,
//   zaps: GenericZap,
//   router: UniswapV2Router02NoEth,
//   pair: UniswapV2Pair,
//   fromToken: string,
//   fromAmount: string,
//   zapInFor: string,
//   useAltFunction: boolean,
//   shouldTransferResidual: boolean
// ) {
//   // init vars
//   const signerAddress = await signer.getAddress();
//   const token0 = await pair.token0();
//   const token1 = await pair.token1();
//   const pairToken0Contract = IERC20__factory.connect(token0, signer);
//   const pairToken1Contract = IERC20__factory.connect(token1, signer);
//   const fromTokenContract = IERC20__factory.connect(fromToken, signer);
//   let fromTokenDecimals;
//   let sellToken;
//   let symbol;
//   if (fromToken === ETH) {
//     symbol = 'ETH';
//     fromTokenDecimals = 18;
//     sellToken = 'ETH';
//   } else {
//     symbol = await fromTokenContract.symbol();
//     fromTokenDecimals = await fromTokenContract.decimals();
//     sellToken = fromToken;
//   }
//   const fromAmountBN = ethers.utils.parseUnits(fromAmount, fromTokenDecimals);
//   // approve zaps
//   if (fromToken !== ETH) {
//     await fromTokenContract.approve(
//       zaps.address,
//       ethers.utils.parseUnits('1000111', fromTokenDecimals)
//     );
//     const allowance = await fromTokenContract.allowance(
//       signerAddress,
//       zaps.address
//     );
//     console.log(`Allowance: ${ethers.utils.formatUnits(allowance, fromTokenDecimals)}`);
//   }
//   const sellAmount = fromAmountBN.toString();
//   let swapCallData, price, guaranteedPrice, gas, estimatedGas;
//   let firstSwapMinAmountOut;
//   let otherToken;
//   let poolSwapMinAmountOut;
//   let amountToSwapIn;
//   let reserveIn, reserveOut; 
//   const isOneSidedLiquidityAddition = false;
//   const poolSwapData = "0x";
//   // if token is neither token0 nor token1, get swap data
//   const tokenCheckSummed = ethers.utils.getAddress(fromToken);
//   if (tokenCheckSummed != token0 && tokenCheckSummed != token1) {
//     const toToken = token0 == WETH ? token1 : token0;
//     const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=${sellToken}&sellAmount=${sellAmount}&buyToken=${toToken}`;
//     const response = await axios.get(url);
//     ({
//       data: { data: swapCallData, price, guaranteedPrice, gas, estimatedGas },
//     } = response);

//     console.log(`Price of ${symbol} in ${toToken}: ${price}`);
//     console.log(`Guaranteed price: ${guaranteedPrice}`);

//     // calculate min amount out
//     const toTokenContract = IERC20__factory.connect(toToken, signer);
//     const toTokenDecimals = await toTokenContract.decimals();
//     const minTokenReceived = parseFloat(guaranteedPrice) * parseFloat(fromAmount);
//     const minTokenReceivedWei = ethers.utils.parseUnits(
//       minTokenReceived.toString(),
//       toTokenDecimals
//     );
//     firstSwapMinAmountOut = minTokenReceivedWei;
//     otherToken = toToken == token0 ? token1 : token0;
//     const reserveData = await pair.getReserves();
//     // approximation as amount could be more than min amount. swap
//     if (toToken == token0) {
//       amountToSwapIn = await zaps.getSwapInAmount(reserveData[0], firstSwapMinAmountOut);
//       reserveIn = reserveData[0];
//       reserveOut = reserveData[1];
//     } else {
//       amountToSwapIn = await zaps.getSwapInAmount(reserveData[1], firstSwapMinAmountOut);
//       reserveIn = reserveData[1];
//       reserveOut = reserveData[0];
//     }
//     // use swap in amount to get tokens out
//     poolSwapMinAmountOut = await router.getAmountOut(amountToSwapIn, reserveIn, reserveOut);
//   } else {
//     swapCallData = "0x";
//     firstSwapMinAmountOut = fromAmountBN;
//     otherToken = tokenCheckSummed == token0 ? token1: token0;
//     const reserveData = await pair.getReserves();
//     // approximation as amount could be more than min amount
//     if (tokenCheckSummed == token0) {
//       amountToSwapIn = await zaps.getSwapInAmount(reserveData[0], firstSwapMinAmountOut);
//       reserveIn = reserveData[0];
//       reserveOut = reserveData[1];
//     } else {
//       amountToSwapIn = await zaps.getSwapInAmount(reserveData[1], firstSwapMinAmountOut);
//       reserveIn = reserveData[1];
//       reserveOut = reserveData[0];
//     }
//     poolSwapMinAmountOut = await router.getAmountOut(amountToSwapIn, reserveIn, reserveOut);
//   }
//   const minLiquidityOut = 1;
//   const zapLiqRequest = {
//     firstSwapMinAmountOut,
//     useAltFunction,
//     poolSwapMinAmountOut,
//     isOneSidedLiquidityAddition,
//     otherToken,
//     minLiquidityOut,
//     poolSwapData
//   }

//   const zapsConnect = zaps.connect(signer);
//   const overrides: { value?: BigNumber } = {};
//   if (fromToken === ETH) {
//     overrides.value = ethers.utils.parseEther(fromAmount);
//   }

//   const liquidityBefore = await pair.balanceOf(zapInFor);
//   const tokenBalanceBefore = await fromTokenContract.balanceOf(zapInFor);
//   const pairToken0BalanceBefore = await pairToken0Contract.balanceOf(zapInFor);
//   const pairToken1BalanceBefore = await pairToken1Contract.balanceOf(zapInFor);
//   const signerTokenBalanceBefore = await fromTokenContract.balanceOf(signerAddress);
//   const zapsTokenBalanceBefore = await fromTokenContract.balanceOf(zaps.address);
//   const zapsPairToken0BalanceBefore = await pairToken0Contract.balanceOf(zaps.address);
//   const zapsPairToken1BalanceBefore = await pairToken1Contract.balanceOf(zaps.address);
//   if (signerAddress == zapInFor) {
//     await expect(zapsConnect.zapLiquidityUniV2(
//       fromToken,
//       fromAmountBN,
//       pair.address,
//       shouldTransferResidual,
//       ZEROEX_EXCHANGE_PROXY,
//       swapCallData,
//       zapLiqRequest,
//       overrides
//     ))
//     .to.emit(zaps, "ZappedLPUniV2");
//   } else {
//     await expect(zapsConnect.zapLiquidityUniV2For(
//       fromToken,
//       fromAmountBN,
//       pair.address,
//       zapInFor,
//       shouldTransferResidual,
//       ZEROEX_EXCHANGE_PROXY,
//       swapCallData,
//       zapLiqRequest,
//       overrides
//     ))
//     .to.emit(zaps, "ZappedLPUniV2");
//   }

//   // checks
//   const liquidityAfter = await pair.balanceOf(zapInFor);
//   const signerTokenBalanceAfter = await fromTokenContract.balanceOf(signerAddress);
//   expect(liquidityAfter.sub(liquidityBefore)).to.gt(0);

//   // ensure no residual tokens
//   if (shouldTransferResidual) {
//     expect(signerTokenBalanceBefore.sub(signerTokenBalanceAfter)).to.lte(fromAmountBN);

//     const zapsTokenBalanceAfter = await fromTokenContract.balanceOf(zaps.address);
//     const zapsPairToken0BalanceAfter = await (IERC20__factory.connect(token0, signer)).balanceOf(zaps.address);
//     const zapsPairToken1BalanceAfter = await (IERC20__factory.connect(token1, signer)).balanceOf(zaps.address);
//     // const pairToken0BalanceAfter = await pairToken0Contract.balanceOf(zapInFor);
//     // const pairToken1BalanceAfter = await pairToken1Contract.balanceOf(zapInFor);
//     expect(zapsTokenBalanceAfter.sub(zapsTokenBalanceBefore)).to.eq(0);
//     expect(zapsPairToken0BalanceAfter.sub(zapsPairToken0BalanceBefore)).to.eq(0);
//     expect(zapsPairToken1BalanceAfter).to.eq(zapsPairToken1BalanceBefore);
//     // user residuals received
//     //expect(pairToken0BalanceAfter).to.gte(pairToken0BalanceBefore);
//     //expect(pairToken1BalanceAfter).to.gte(pairToken1BalanceBefore);
//   } else {
//     expect(signerTokenBalanceBefore.sub(signerTokenBalanceAfter)).to.eq(fromAmountBN);
//   }
// }

// async function zapInTempleFaith(
//   signer: Signer,
//   zapInfor: string,
//   fundAmount: BigNumber,
//   fromAmount: string,
//   fromTokenAddress: string,
//   fee: BigNumber
// ) {
//   const tokenContract = IERC20__factory.connect(fromTokenAddress, signer);
//   let symbol;
//   let decimals;
//   let sellToken;
//   if (fromTokenAddress === ETH) {
//     symbol = 'ETH';
//     decimals = 18;
//     sellToken = 'ETH';
//   } else {
//     symbol = await tokenContract.symbol();
//     decimals = await tokenContract.decimals();
//     sellToken = fromTokenAddress;
//   }
//   // get some faith for signer
//   const signerAddress = await signer.getAddress();
//   const faithAmount = 10000;
//   await faith.gain(signerAddress, faithAmount);
//   const signerFaithBalance = await faith.balances(signerAddress);
//   expect(signerFaithBalance.usableFaith).to.eq(faithAmount);

//   // zap temple+faith
//   const fromToken = ERC20__factory.connect(fromTokenAddress, signer);
//   const templeToken = IERC20__factory.connect(TEMPLE, signer);
//   //const minTempleReceived = ethers.utils.parseUnits("1", 18).toString();

//   // Get TEMPLE balance before zap
//   //const signerAddress = await signer.getAddress();
//   const balanceBefore = signerAddress == zapInfor ? await getBalance(templeToken, signerAddress) : await getBalance(templeToken, zapInfor);
//   console.log(
//     `Starting Temple: ${ethers.utils.formatUnits(balanceBefore, 18)}`
//   );
//   console.log(`Selling ${fromAmount} ${symbol}`);

//   // Approve token
//   if (fromTokenAddress !== ETH) {
//     await tokenContract.approve(
//       templeZaps.address,
//       ethers.utils.parseUnits('1000111', decimals)
//     );
//     const allowance = await tokenContract.allowance(
//       signerAddress,
//       templeZaps.address
//     );
//     console.log(`Allowance: ${ethers.utils.formatUnits(allowance, decimals)}`);
//   }

//   // Get quote from 0x API
//   let swapCallData, price, guaranteedPrice, gas, estimatedGas;
//   const sellAmount = ethers.utils.parseUnits(fromAmount, decimals).toString();

//   // todo: if token is temple, no need to swap data
//   let minFraxReceived = 0;
//   let minFraxReceivedWei = BigNumber.from(0);
//   let minExpectedTemple = BigNumber.from(0);
//   const fraxPair = await templeRouter.tokenPair(FRAX);
//   if (fromTokenAddress === FRAX) {
//     guaranteedPrice = '0.99';
//     swapCallData = '0x';
//     minExpectedTemple = await getExpectedTemple(
//       signer,
//       guaranteedPrice,
//       fromAmount,
//       fraxPair
//     );
//   } else if (fromTokenAddress == TEMPLE) {
//     minExpectedTemple = ethers.utils.parseEther(fromAmount);
//     swapCallData = "0x";
//   } else {
//     const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=${sellToken}&sellAmount=${sellAmount}&buyToken=${FRAX}`;
//     const response = await axios.get(url);
//     ({
//       data: { data: swapCallData, price, guaranteedPrice, gas, estimatedGas },
//     } = response);

//     console.log(`Price of ${symbol} in FRAX: ${price}`);
//     console.log(`Guaranteed price: ${guaranteedPrice}`);

//     minFraxReceived = parseFloat(guaranteedPrice) * parseFloat(fromAmount);
//     minFraxReceivedWei = ethers.utils.parseUnits(
//       minFraxReceived.toString(),
//       18
//     );
//     minExpectedTemple = await getExpectedTemple(
//       signer,
//       guaranteedPrice,
//       fromAmount,
//       fraxPair
//     );
//   }

//   // boosted temple
//   // const boostedAmount = await vaultProxy.getFaithMultiplier(faithAmount, fromAmountInTemple);
//   const boostedAmount = await vaultProxy.getFaithMultiplier(faithAmount, minExpectedTemple);
//   console.log(`boosted amount ${boostedAmount} ${faithAmount}`)
//   await fromToken.connect(signer).increaseAllowance(templeZaps.address, sellAmount);
//   await expect(templeZaps
//     .connect(signer)
//     .zapTempleFaithInVault(
//       vault.address,
//       fromToken.address,
//       sellAmount,
//       minExpectedTemple,
//       FRAX,
//       minFraxReceivedWei,
//       ZEROEX_EXCHANGE_PROXY,
//       swapCallData
//     ))
//     .to.emit(templeZaps, "ZappedTemplePlusFaithInVault")
//     //.withArgs(signerAddress, fromToken.address, sellAmount, faithAmount, boostedAmount);
    
//   //expect(await templeToken.balanceOf(templeZaps.address)).to.eq(fundAmount.sub(boostedAmount.sub(fromAmountInTemple)));
//   expect((await faith.balances(signerAddress)).usableFaith).to.eq(0);
//   expect(await vault.balanceOf(signerAddress)).to.gte(boostedAmount.sub(fee));
//   expect(await templeToken.balanceOf(vaultedTemple.address)).to.gte(boostedAmount);
// }

// async function airdropTemple(
//   owner: Signer,
//   airdropRecipients: Signer[],
//   airdropAmount: BigNumberish
// ): Promise<TempleERC20Token> {
//   const templeMultisig = await impersonateAddress(MULTISIG)
//   const templeToken = TempleERC20Token__factory.connect(TEMPLE, templeMultisig);
//   const templeTokenOwner = TempleERC20Token__factory.connect(TEMPLE, owner);

//   await templeToken.addMinter(await owner.getAddress());
//   for (const u of airdropRecipients) {
//     await templeTokenOwner.mint(await u.getAddress(), airdropAmount)
//   }

//   return templeTokenOwner;
// }

// // zap temple using templezaps contract, which uses generic zaps
// async function zapTemple(
//   signer: Signer,
//   zapInfor: string,
//   templeZaps: TempleZaps,
//   zaps: GenericZap,
//   tokenAddr: string,
//   tokenAmount: string,
// ) {
//   const tokenContract = IERC20__factory.connect(tokenAddr, signer);
//   const templeToken = IERC20__factory.connect(TEMPLE, signer);
//   let symbol;
//   let decimals;
//   let sellToken;
//   if (tokenAddr === ETH) {
//     symbol = 'ETH';
//     decimals = 18;
//     sellToken = 'ETH';
//   } else {
//     symbol = await tokenContract.symbol();
//     decimals = await tokenContract.decimals();
//     sellToken = tokenAddr;
//   }

//   // Get TEMPLE balance before zap
//   const signerAddress = await signer.getAddress();
//   const balanceBefore = signerAddress == zapInfor ? await getBalance(templeToken, signerAddress) : await getBalance(templeToken, zapInfor);
//   console.log(
//     `Starting Temple: ${ethers.utils.formatUnits(balanceBefore, 18)}`
//   );
//   console.log(`Selling ${tokenAmount} ${symbol}`);

//   // Approve token
//   if (tokenAddr !== ETH) {
//     await tokenContract.approve(
//       templeZaps.address,
//       ethers.utils.parseUnits('1000111', decimals)
//     );
//     const allowance = await tokenContract.allowance(
//       signerAddress,
//       templeZaps.address
//     );
//     console.log(`Allowance: ${ethers.utils.formatUnits(allowance, decimals)}`);
//   }

//   // Get quote from 0x API
//   let swapCallData, price, guaranteedPrice, gas, estimatedGas;
//   const sellAmount = ethers.utils.parseUnits(tokenAmount, decimals).toString();

//   if (tokenAddr === FRAX) {
//     guaranteedPrice = '0.99';
//     swapCallData = '0x';
//   } else {
//     const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=${sellToken}&sellAmount=${sellAmount}&buyToken=${FRAX}`;
//     const response = await axios.get(url);
//     ({
//       data: { data: swapCallData, price, guaranteedPrice, gas, estimatedGas },
//     } = response);

//     console.log(`Price of ${symbol} in FRAX: ${price}`);
//     console.log(`Guaranteed price: ${guaranteedPrice}`);
//   }

//   // todo: swap on temple zaps. probably update templezaps to use stable router after first swap
//   const minFraxReceived = parseFloat(guaranteedPrice) * parseFloat(tokenAmount);
//   const minFraxReceivedWei = ethers.utils.parseUnits(
//     minFraxReceived.toString(),
//     18
//   );
//   const fraxPair = await templeRouter.tokenPair(FRAX);
//   // Do zap
//   const minExpectedTemple = await getExpectedTemple(
//     signer,
//     guaranteedPrice,
//     tokenAmount,
//     fraxPair
//   );

//   const templeZapsConnect = templeZaps.connect(signer);
//   const overrides: { value?: BigNumber } = {};
//   if (tokenAddr === ETH) {
//     overrides.value = ethers.utils.parseEther(tokenAmount);
//   }
//   const checkSumedTokenAddr = ethers.utils.getAddress(tokenAddr);
//   const checkSumedFraxAddr = ethers.utils.getAddress(FRAX);
//   if (signerAddress == zapInfor) {
//     await expect(templeZapsConnect.zapInTemple(
//       tokenAddr,
//       sellAmount,
//       minExpectedTemple,
//       FRAX,
//       minFraxReceivedWei,
//       ZEROEX_EXCHANGE_PROXY,
//       swapCallData,
//       overrides
//     ))
//     .to.emit(zaps, "ZappedIn")
//     //.withArgs(templeZaps.address, checkSumedTokenAddr, sellAmount, checkSumedFraxAddr, minFraxReceivedWei);
//   } else {
//     await expect(templeZapsConnect.zapInTempleFor(
//       tokenAddr,
//       sellAmount,
//       minExpectedTemple,
//       FRAX,
//       minFraxReceivedWei,
//       zapInfor,
//       ZEROEX_EXCHANGE_PROXY,
//       swapCallData,
//       overrides
//     ))
//     .to.emit(zaps, "ZappedIn")
//   }
  
//   console.log(
//     `Minimum expected Temple: ${ethers.utils.formatUnits(
//       minExpectedTemple,
//       18
//     )}`
//   );

//   /// check amounts
//   const balanceAfter = await getBalance(templeToken, zapInfor);
//   console.log(`Ending Temple: ${ethers.utils.formatUnits(balanceAfter, 18)}`);

//   expect(balanceAfter.gte(minExpectedTemple)).to.be.true;
//   expect(balanceAfter).to.gte(minExpectedTemple.add(balanceBefore));
// }

// async function zapIn(
//   signer: Signer,
//   zapInfor: string,
//   zaps: GenericZap,
//   tokenAddr: string,
//   tokenAmount: string,
//   toTokenAddr: string
// ) {
//   const tokenContract = IERC20__factory.connect(tokenAddr, signer);
//   const toTokenContract = IERC20__factory.connect(toTokenAddr, signer);
//   let symbol;
//   let decimals;
//   let sellToken;
//   if (tokenAddr === ETH) {
//     symbol = 'ETH';
//     decimals = 18;
//     sellToken = 'ETH';
//   } else {
//     symbol = await tokenContract.symbol();
//     decimals = await tokenContract.decimals();
//     sellToken = tokenAddr;
//   }

//   // Get TEMPLE balance before zap
//   const signerAddress = await signer.getAddress();
//   //const balanceBefore = await getBalance(tokenContract, signerAddress);
//   const balanceBefore = signerAddress == zapInfor ? 
//     await getBalance(toTokenContract, signerAddress) : await getBalance(toTokenContract, zapInfor);
//   console.log(
//     `Starting Token Balance: ${ethers.utils.formatUnits(balanceBefore, 18)}`
//   );
//   console.log(`Selling ${tokenAmount} ${symbol}`);

//   // Approve token
//   if (tokenAddr !== ETH) {
//     await tokenContract.approve(
//       zaps.address,
//       ethers.utils.parseUnits('1000111', decimals)
//     );
//     const allowance = await tokenContract.allowance(
//       signerAddress,
//       zaps.address
//     );
//     console.log(`Allowance: ${ethers.utils.formatUnits(allowance, decimals)}`);
//   }

//   // Get quote from 0x API
//   let swapCallData, price, guaranteedPrice, gas, estimatedGas;
//   const sellAmount = ethers.utils.parseUnits(tokenAmount, decimals).toString();
//   const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=${sellToken}&sellAmount=${sellAmount}&buyToken=${toTokenAddr}`;
//   const response = await axios.get(url);
//   ({
//     data: { data: swapCallData, price, guaranteedPrice, gas, estimatedGas },
//   } = response);

//   console.log(`Price of ${symbol} in ${toTokenAddr}: ${price}`);
//   console.log(`Guaranteed price: ${guaranteedPrice}`);

//   const zapsConnect = zaps.connect(signer);
//   const overrides: { value?: BigNumber } = {};
//   if (tokenAddr === ETH) {
//     overrides.value = ethers.utils.parseEther(tokenAmount);
//   }

//   const minTokenReceived = parseFloat(guaranteedPrice) * parseFloat(tokenAmount);
//   const minTokenReceivedWei = ethers.utils.parseUnits(
//     minTokenReceived.toString(),
//     18
//   );
//   console.log(`Min token received wei: ${minTokenReceivedWei}`);
  
//   if (signerAddress == zapInfor) {
//     await expect(zapsConnect.zapIn(
//       tokenAddr,
//       sellAmount,
//       toTokenAddr,
//       minTokenReceivedWei,
//       ZEROEX_EXCHANGE_PROXY,
//       swapCallData,
//       overrides
//     ))
//     .to.emit(zapsConnect, "ZappedIn");
//   } else {
//     await expect(zapsConnect.zapInFor(
//       tokenAddr,
//       sellAmount,
//       toTokenAddr,
//       minTokenReceivedWei,
//       zapInfor,
//       ZEROEX_EXCHANGE_PROXY,
//       swapCallData,
//       overrides
//     ))
//     .to.emit(zapsConnect, "ZappedIn");
//   }

//   // Get balance after zap
//   const balanceAfter = await getBalance(toTokenContract, signerAddress);
//   console.log(`Ending toToken balance: ${ethers.utils.formatUnits(balanceAfter, 18)}`);

//   expect(balanceAfter.gte(minTokenReceivedWei)).to.be.true;
//   expect(balanceAfter).to.gte(minTokenReceivedWei.add(balanceBefore));
// }

// async function zapInVault(
//   signer: Signer,
//   zaps: TempleZaps,
//   tokenAddr: string,
//   tokenAmount: string,
//   vaultAddr: string
// ) {
//   const tokenContract = IERC20__factory.connect(tokenAddr, signer);
//   const templeToken = IERC20__factory.connect(TEMPLE, signer);

//   let symbol;
//   let decimals;
//   let sellToken;
//   if (tokenAddr === ETH) {
//     symbol = 'ETH';
//     decimals = 18;
//     sellToken = 'ETH';
//   } else {
//     symbol = await tokenContract.symbol();
//     decimals = await tokenContract.decimals();
//     sellToken = tokenAddr;
//   }

//   // Get TEMPLE balance before zap
//   const signerAddress = await signer.getAddress();
//   const balanceBefore = await getBalance(templeToken, signerAddress);
//   console.log(
//     `Starting Temple: ${ethers.utils.formatUnits(balanceBefore, 18)}`
//   );
//   console.log(`Selling ${tokenAmount} ${symbol}`);

//   // Approve token
//   if (tokenAddr !== ETH) {
//     await tokenContract.approve(
//       zaps.address,
//       ethers.utils.parseUnits('1000111', decimals)
//     );
//     const allowance = await tokenContract.allowance(
//       signerAddress,
//       zaps.address
//     );
//     console.log(`Allowance: ${ethers.utils.formatUnits(allowance, decimals)}`);
//   }
  
//   // Get quote from 0x API
//   let swapCallData, price, guaranteedPrice, gas, estimatedGas;
//   const sellAmount = ethers.utils.parseUnits(tokenAmount, decimals).toString();

//   if (tokenAddr === FRAX) {
//     guaranteedPrice = '0.99';
//     swapCallData = '0x';
//   } else {
//     const url = `${ZEROEX_QUOTE_ENDPOINT}sellToken=${sellToken}&sellAmount=${sellAmount}&buyToken=${FRAX}`;
//     const response = await axios.get(url);
//     ({
//       data: { data: swapCallData, price, guaranteedPrice, gas, estimatedGas },
//     } = response);

//     console.log(`Price of ${symbol} in FRAX: ${price}`);
//     console.log(`Guaranteed price: ${guaranteedPrice}`);
//   }

//   // Do zap
//   const zapsConnect = zaps.connect(signer);
//   const overrides: { value?: BigNumber } = {};
//   if (tokenAddr === ETH) {
//     overrides.value = ethers.utils.parseEther(tokenAmount);
//   }

//   const sellAmountBN = BigNumber.from(sellAmount);
//   const feePerTempleScaledPerHour = await joiningFee.calc(await vault.firstPeriodStartTimestamp(), await vault.periodDuration(), vault.address);
//   ///////
//   const fee = sellAmountBN.mul(feePerTempleScaledPerHour).div(toAtto(1));
//   // convert to approximate temple value for later checks
//   const minExpectedTemple = await getExpectedTemple(
//     signer,
//     guaranteedPrice,
//     tokenAmount,
//     await templeRouter.tokenPair(FRAX)
//   );
//   const minFraxReceived = parseFloat(guaranteedPrice) * parseFloat(tokenAmount);
//   const minFraxReceivedWei = ethers.utils.parseUnits(
//     minFraxReceived.toString(),
//     18
//   );
//   const vaultExposureTokenBefore = await templeExposure.balanceOf(vault.address);
//   const vaultedTempleAmountBefore = await templeToken.balanceOf(vaultedTemple.address);
//   await zaps.setSupportedStables([FRAX, FEI], [true, true]);
//   await expect(zapsConnect.zapInVault(
//     tokenAddr,
//     sellAmount,
//     minExpectedTemple,
//     FRAX,
//     minFraxReceivedWei,
//     vaultAddr,
//     ZEROEX_EXCHANGE_PROXY,
//     swapCallData
//   ))
//   .to.emit(zapsConnect, "ZappedTempleInVault");

//   expect(await templeExposure.balanceOf(vault.address)).to.gte(vaultExposureTokenBefore.add(minExpectedTemple));
//   expect(await templeToken.balanceOf(vaultedTemple.address)).to.gte(vaultedTempleAmountBefore.add(minExpectedTemple));
//   expect(await vault.balanceOf(signerAddress)).to.gte(minExpectedTemple.sub(fee));
//   expect(await templeToken.balanceOf(vaultedTemple.address)).to.gte(minExpectedTemple);

//   // Get Temple balance after zap
//   const balanceAfter = await getBalance(templeToken, signerAddress);
//   expect(balanceAfter).to.gte(balanceBefore);
//   console.log(`Ending Temple: ${ethers.utils.formatUnits(balanceAfter, 18)}`);
// }

// async function impersonateAddress(address: string) {
//   await network.provider.request({
//     method: 'hardhat_impersonateAccount',
//     params: [address],
//   });
//   return ethers.provider.getSigner(address);
// }

// async function getExpectedTemple(
//   signer: Signer,
//   guaranteedPrice: string,
//   tokenAmount: string,
//   pair: string
// ): Promise<BigNumber> {
//   const ammContract = TempleStableAMMRouter__factory.connect(TEMPLE_STABLE_ROUTER, signer);
//   const minFraxReceived = parseFloat(guaranteedPrice) * parseFloat(tokenAmount);
//   const minFraxReceivedWei = ethers.utils.parseUnits(
//     minFraxReceived.toString(),
//     18
//   );
//   console.log(`Min Frax Received in Wei ${minFraxReceivedWei}`);
//   const quote = await ammContract.swapExactStableForTempleQuote(pair, minFraxReceivedWei);
//   console.log(`Quote for Temple to receive ${quote}`);
//   return quote;
// }

// async function getBalance(token: IERC20, owner: string) {
//   return await token.balanceOf(owner);
// };
