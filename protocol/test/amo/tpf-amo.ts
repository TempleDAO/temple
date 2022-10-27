import { ethers, network } from "hardhat";
import { expect, should } from "chai";
import { toAtto, shouldThrow, mineForwardSeconds } from "../helpers";
import { BigNumber, Signer } from "ethers";
import addresses from "../constants";
import { 
  TPFAMO,
  TPFAMO__factory,
  IERC20__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  IERC20,
  IBalancerVault,
  IBalancerVault__factory,
  IBalancerHelpers,
  IBalancerHelpers__factory,
  AuraStaking__factory,
  AuraStaking,
  ITempleERC20Token,
  IWeightPool2Tokens,
  IWeightPool2Tokens__factory
} from "../../typechain";
import { DEPLOYED_CONTRACTS } from '../../scripts/deploys/helpers';

const { MULTISIG, TEMPLE, TEMPLE_V2_ROUTER } = DEPLOYED_CONTRACTS.mainnet;
const { BALANCER_VAULT } = addresses.contracts;
const { FRAX_WHALE, BINANCE_ACCOUNT_8 } = addresses.accounts;
const { FRAX } = addresses.tokens;
const { DAI } = addresses.tokens;
const AURA_DEPOSIT_TOKEN = "0x1aF1cdC500A56230DF8A7Cf8099511A16D6e349e"; 
const TEMPLE_DAI_LP_TOKEN = "0x1b65fe4881800b91d4277ba738b567cbb200a60d";
const PID = 38;
const REWARDS = "0xB665b3020bBE8a9020951e9a74194c1BFda5C5c4";
const AURA_BOOSTER = "0x7818A1DA7BD1E64c199029E86Ba244a9798eEE10";
const BALANCER_POOL_ID = "0x1b65fe4881800b91d4277ba738b567cbb200a60d0002000000000000000002cc";
const BALANCER_HELPERS = "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E";
const ONE_ETH = ethers.utils.parseEther("1");
const TEMPLE_WHALE = "0xf6C75d85Ef66d57339f859247C38f8F47133BD39";
const BLOCKNUMBER = 15834933;

let amo: TPFAMO;
let amoStaking: AuraStaking;
let owner: Signer;
let alan: Signer;
let operator: Signer;
let templeMultisig: Signer;
let fraxWhale: Signer;
let templeWhale: Signer;
let daiWhale: Signer;
let ownerAddress: string;
let alanAddress: string;
let operatorAddress: string;
let templeToken: TempleERC20Token;
let fraxToken: IERC20;
let daiToken: IERC20;
let bptToken: IERC20;
let depositToken: IERC20;
let balancerVault: IBalancerVault;
let balancerHelpers: IBalancerHelpers;
let weightedPool2Tokens: IWeightPool2Tokens;

describe.only("Temple Price Floor AMO", async () => {
    

    before( async () => {
        await resetFork(BLOCKNUMBER);
        [owner, alan, operator] = await ethers.getSigners();
        templeMultisig = await impersonateAddress(MULTISIG);
        templeWhale = await impersonateAddress(TEMPLE_WHALE);
        fraxWhale = await impersonateAddress(FRAX_WHALE);
        daiWhale = await impersonateAddress(BINANCE_ACCOUNT_8)
    
        ownerAddress = await owner.getAddress();
        alanAddress = await alan.getAddress();
        operatorAddress = await operator.getAddress();

        templeToken = TempleERC20Token__factory.connect(TEMPLE, templeWhale);
        fraxToken = IERC20__factory.connect(FRAX, fraxWhale);
        daiToken = IERC20__factory.connect(DAI, daiWhale);
        bptToken = IERC20__factory.connect(TEMPLE_DAI_LP_TOKEN, owner);
        depositToken = IERC20__factory.connect(AURA_DEPOSIT_TOKEN, owner);

        balancerVault = IBalancerVault__factory.connect(BALANCER_VAULT, owner);
        balancerHelpers = IBalancerHelpers__factory.connect(BALANCER_HELPERS, owner);
        weightedPool2Tokens = IWeightPool2Tokens__factory.connect(TEMPLE_DAI_LP_TOKEN, owner);

        amoStaking = await new AuraStaking__factory(owner).deploy(
            ownerAddress,
            TEMPLE_DAI_LP_TOKEN,
            AURA_BOOSTER,
            AURA_DEPOSIT_TOKEN
        );
    
        amo = await new TPFAMO__factory(owner).deploy(
            BALANCER_VAULT,
            TEMPLE,
            DAI,
            TEMPLE_DAI_LP_TOKEN,
            amoStaking.address,
            AURA_BOOSTER,
            200
        );

        // set params
        await amo.setBalancerPoolId(BALANCER_POOL_ID);
        await amo.setAuraBooster(AURA_BOOSTER);
        await amoStaking.setAuraPoolInfo(PID, AURA_DEPOSIT_TOKEN, REWARDS);
        await amo.setOperator(ownerAddress);
        await amo.setCoolDown(1800); // 30 mins
        await amo.setTemplePriceFloorRatio(9700);
        await amo.setRebalanceRateChangeNumerator(300); // 3%
        const cappedAmounts = {
            temple: BigNumber.from(ONE_ETH).mul(10),
            bpt: BigNumber.from(ONE_ETH).mul(10),
            stable: BigNumber.from(ONE_ETH).mul(10)
        }
        await amo.setCappedRebalanceAmounts(cappedAmounts);
        await amo.setPostRebalanceSlippage(100, 100); // 1%
        await amo.setLastRebalanceAmounts(ONE_ETH, ONE_ETH, ONE_ETH); // start with 1 eth
        await amo.setTempleIndexInBalancerPool();
        await templeToken.transfer(MULTISIG, ethers.utils.parseEther("100"));

        // add amo as TEMPLE minter
        await templeToken.connect(templeMultisig).addMinter(amo.address);
    });

    describe("Admin", async () => {
        it("admin setter methods", async () => {
            const joinPoolRequest = {
                assets: [],
                maxAmountsIn: [],
                userData: "0x",
                fromInternalBalance: false
            }
            const exitPoolRequest = {
                assets: [],
                minAmountsOut: [],
                userData: "0x",
                toInternalBalance: false
            }
            // fails
            const connectAMO = amo.connect(alan);
            await shouldThrow(connectAMO.setBalancerPoolId(BALANCER_POOL_ID), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setOperator(alanAddress), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setCoolDown(1800), /Ownable: caller is not the owner/); // 30 mins
            await shouldThrow(connectAMO.setTemplePriceFloorRatio(9700), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setRebalanceRateChangeNumerator(300), /Ownable: caller is not the owner/); // 3%
            const cappedAmounts = {
                temple: BigNumber.from(ONE_ETH).mul(10),
                bpt: BigNumber.from(ONE_ETH).mul(10),
                stable: BigNumber.from(ONE_ETH).mul(10)
            }
            await shouldThrow(connectAMO.setCappedRebalanceAmounts(cappedAmounts), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setPostRebalanceSlippage(100, 100), /Ownable: caller is not the owner/); // 1%
            await shouldThrow(connectAMO.setLastRebalanceAmounts(ONE_ETH, ONE_ETH, ONE_ETH), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.togglePause(), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.recoverToken(TEMPLE , alanAddress, 100), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.rebalanceDown(ONE_ETH, 1, true), /NotOperatorOrOwner/);
            await shouldThrow(connectAMO.rebalanceUp(ONE_ETH, 1),/NotOperatorOrOwner/);
            await shouldThrow(connectAMO.depositStable(100, 1), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.withdrawstable(100, 1), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.depositAndStake(100), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.depositAllAndStake(), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.withdraw(100, true, true), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.withdrawAll(true, true), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.withdrawAllAndUnwrap(true, true), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.withdrawAndUnwrap(100, true, true), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.addLiquidity(joinPoolRequest, 1, true), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.removeLiquidity(exitPoolRequest, 100), /Ownable: caller is not the owner/);

            // passes
            await amo.setCappedRebalanceAmounts(cappedAmounts);
            await amo.setPostRebalanceSlippage(100, 100);
            await amo.togglePause();
            await amo.setLastRebalanceAmounts(ONE_ETH, ONE_ETH, ONE_ETH);
            await amo.setBalancerPoolId(BALANCER_POOL_ID);
            await amo.setOperator(ownerAddress);
            await amo.setCoolDown(1800);
            await amo.setTemplePriceFloorRatio(9700);
            await amo.setRebalanceRateChangeNumerator(300);
        });

        it("sets balancer pool Id", async () => {
            await expect(amo.setBalancerPoolId(BALANCER_POOL_ID))
                .to.emit(amo, "SetBalancerPoolId").withArgs(BALANCER_POOL_ID);
            expect(await amo.balancerPoolId()).to.eq(BALANCER_POOL_ID);
        });

        it("sets operator", async () => {
            await expect(amo.setOperator(operatorAddress))
                .to.emit(amo, "SetOperator").withArgs(operatorAddress);
            expect(await amo.operator()).to.eq(operatorAddress);
        });

        it("sets aura pool info", async () => {
            await expect(amoStaking.setAuraPoolInfo(PID, AURA_DEPOSIT_TOKEN, REWARDS))
                .to.emit(amoStaking, "SetAuraPoolInfo").withArgs(PID, AURA_DEPOSIT_TOKEN, REWARDS);
            const auraPoolInfo = await amoStaking.auraPoolInfo();
            expect(auraPoolInfo.rewards).to.eq(REWARDS);
            expect(auraPoolInfo.pId).to.eq(PID);
            expect(auraPoolInfo.token).to.eq(AURA_DEPOSIT_TOKEN);
        });

        it("sets aura booster", async () => {
            await expect(amo.setAuraBooster(AURA_BOOSTER))
                .to.emit(amo, "SetAuraBooster").withArgs(AURA_BOOSTER);
            expect(await amo.booster()).to.eq(AURA_BOOSTER);
        });

        it("sets cooldown", async () => {
            const secs = 1800;
            await expect(amo.setCoolDown(secs))
                .to.emit(amo, "SetCooldown").withArgs(secs);
            //expect(await amo()).to.eq(secs);
        });

        it("sets TPF ratio", async () => {
            const numerator = 9_700;
            const denominator = 10_000;
            await expect(amo.setTemplePriceFloorRatio(numerator))
                .to.emit(amo, "SetTemplePriceFloorRatio").withArgs(numerator, denominator);
            const tpf = await amo.templePriceFloorRatio();
            expect(tpf.numerator).to.eq(numerator);
            expect(tpf.denominator).to.eq(denominator);
        });

        it("sets rebalance rate change for successive rebalances", async () => {
            const change = 300; // 3%
            // test wrong values
            //await expect(amo.setRebalanceRateChangeNumerator(10_000)).to.be.revertedWithCustomError(amo, "InvalidBPSValue");
            //await expect(amo.setRebalanceRateChangeNumerator(0)).to.be.revertedWithCustomError(amo, "InvalidBPSValue");

            // correct setting
            await expect(amo.setRebalanceRateChangeNumerator(change))
                .to.emit(amo, "SetRebalanceRateChange").withArgs(change);
        });

        it("pause/unpause", async () => {
            // can call
            await amo.setOperator(operatorAddress);
            // pause
            const paused = await amo.paused();
            if (paused) {
                await amo.togglePause();
            }
            await expect(amo.togglePause()).to.emit(amo, "SetPauseState").withArgs(true);
            mineForwardSeconds(10_000);
            await shouldThrow(amo.rebalanceDown(100, 1, true), /Paused/);

            // unpause
            await expect(amo.togglePause()).to.emit(amo, "SetPauseState").withArgs(false);
            amo.rebalanceDown(ONE_ETH, 1, true);
        });

        it("sets capped rebalance amount", async () => {
            const cappedAmounts = {
                temple: BigNumber.from(222),
                bpt: BigNumber.from(111),
                stable: BigNumber.from(333)
            }
            await amo.setCappedRebalanceAmounts(cappedAmounts);
            const setCappedAmounts = await amo.cappedRebalanceAmounts();
            expect(setCappedAmounts.temple).to.eq(222);
            expect(setCappedAmounts.bpt).to.eq(111);
            expect(setCappedAmounts.stable).to.eq(333);
        });

        it("sets post rebalance slippage", async () => {
            await expect(amo.setPostRebalanceSlippage(100, 100)).to.emit(amo, "SetPostRebalanceSlippage").withArgs(100, 100);
        });

        it("sets last rebalance amounts", async () => {
            await amo.setLastRebalanceAmounts(ONE_ETH, ONE_ETH, ONE_ETH);
        });

        it("recovers tokens", async () => {
            // transfer frax to zaps contract
            await fraxToken.transfer(amo.address, 1000);

            console.log(await fraxToken.balanceOf(amo.address));
                    
            // recover token
            const checksummedFrax = ethers.utils.getAddress(FRAX);
            await expect(amo.recoverToken(FRAX, ownerAddress, 1000))
                .to.emit(amo, "RecoveredToken")
                .withArgs(checksummedFrax, ownerAddress, 1000);
            
            expect(await fraxToken.balanceOf(ownerAddress)).eq(1000);
        });
    });

    describe.only("Liquidity Add/Remove", async () => {
        it("sets temple index of balancer pool", async () => {
            const data = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
            let index = 0;
            for (let i=0; i<data.tokens.length; i++) {
                if (ethers.utils.getAddress(data.tokens[i]) == ethers.utils.getAddress(TEMPLE)) {
                    index = i;
                    break;
                }
            }
            await amo.setTempleIndexInBalancerPool();
            const contractReturnedIndex = await amo.templeBalancerPoolIndex();
            expect(contractReturnedIndex).to.eq(index);
        });

        it("adds liquidity using contract TEMPLE", async () => {
            // create join request
            let tokens: string[];
            let balances: BigNumber[];
            [tokens, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
            const maxAmountsIn = [toAtto(1000), toAtto(990)];
            const userData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]", "uint256"], [1, maxAmountsIn, 1]);
            const joinPoolRequest = {
                assets: tokens,
                maxAmountsIn,
                userData,
                fromInternalBalance: false
            }
            let bptOut: BigNumber;
            let amountsIn: BigNumber[];
            let tx; let txx; let hash;
            [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, amo.address, amo.address, joinPoolRequest);
            console.log(bptOut, amountsIn);

            // fail validation on unequal length
            let failJoinPoolRequest = {
                assets: tokens,
                maxAmountsIn: [1],
                userData,
                fromInternalBalance: false
            }
            await shouldThrow(amo.addLiquidity(failJoinPoolRequest, bptOut, true), /InvalidBalancerVaultRequest/);
            // fail on wrong fromInternalBalance value
            let failJoinPoolRequest2 = {
                assets: tokens,
                maxAmountsIn,
                userData,
                fromInternalBalance: true
            }
            await shouldThrow(amo.addLiquidity(failJoinPoolRequest2, bptOut, true), /InvalidBalancerVaultRequest/);

            // add liquidity
            // fund and execute
            const amount = ethers.utils.parseEther("2000")
            await templeToken.transfer(amo.address, amount);
            await fund(daiToken, amo.address, amount);

            const bptAmountBefore = await bptToken.balanceOf(amo.address);
            const depositTokenAmountBefore = await depositToken.balanceOf(amo.address);
            await amo.addLiquidity(joinPoolRequest, bptOut, true);
            const bptAmountAfter = await bptToken.balanceOf(amo.address);
            const depositTokenAmountAfter = await depositToken.balanceOf(amo.address);
            expect(bptAmountAfter).to.gte(bptAmountBefore.add(bptOut));
            expect(depositTokenAmountBefore).to.eq(0);
            // not staked yet
            expect(depositTokenAmountAfter).to.eq(0);
            const templeIndex = await amo.templeBalancerPoolIndex();
            let expectedTemple: BigNumber;
            let expectedStable: BigNumber;
            if (templeIndex.toNumber() == 0) {
                expectedTemple = maxAmountsIn[0];
                expectedStable = maxAmountsIn[1];
            } else {
                expectedTemple = maxAmountsIn[1];
                expectedStable = maxAmountsIn[0];
            }
            expect(await templeToken.balanceOf(amo.address)).to.gte(amount.sub(expectedTemple));
            expect(await daiToken.balanceOf(amo.address)).to.gte(amount.sub(expectedStable));
        });

        it("adds liquidity minting TEMPLE", async () => {
            let tokens: string[];
            let balances: BigNumber[];
            [tokens, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
            const maxAmountsIn = [toAtto(1000), toAtto(990)];
            const userData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]", "uint256"], [1, maxAmountsIn, 1]);
            const joinPoolRequest = {
                assets: tokens,
                maxAmountsIn,
                userData,
                fromInternalBalance: false
            }
            let bptOut: BigNumber;
            let amountsIn: BigNumber[];
            let tx; let txx; let hash;
            [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, amo.address, amo.address, joinPoolRequest);
            console.log(bptOut, amountsIn);

            // add liquidity
            // fund and execute
            const amount = ethers.utils.parseEther("2000")
            await templeToken.transfer(amo.address, amount);
            await fund(daiToken, amo.address, amount);

            const bptAmountBefore = await bptToken.balanceOf(amo.address);
            const depositTokenAmountBefore = await depositToken.balanceOf(amo.address);
            await amo.addLiquidity(joinPoolRequest, bptOut, false);
            const bptAmountAfter = await bptToken.balanceOf(amo.address);
            const depositTokenAmountAfter = await depositToken.balanceOf(amo.address);
            expect(bptAmountAfter).to.gte(bptAmountBefore.add(bptOut));
            expect(depositTokenAmountBefore).to.eq(0);
            // not staked yet
            expect(depositTokenAmountAfter).to.eq(0);
            const templeIndex = await amo.templeBalancerPoolIndex();
            let expectedTemple: BigNumber;
            let expectedStable: BigNumber;
            if (templeIndex.toNumber() == 0) {
                expectedTemple = maxAmountsIn[0];
                expectedStable = maxAmountsIn[1];
            } else {
                expectedTemple = maxAmountsIn[1];
                expectedStable = maxAmountsIn[0];
            }
            expect(await templeToken.balanceOf(amo.address)).to.gte(amount.sub(expectedTemple));
            expect(await daiToken.balanceOf(amo.address)).to.gte(amount.sub(expectedStable));
        });

        it("removes liquidity EXACT BPT IN for tokens out", async () => {
            // create exit request
            let tokens: string[];
            let balances: BigNumber[];
            let minAmountsOut = [toAtto(100), toAtto(100)];
            const bptAmountIn = await bptToken.balanceOf(amo.address);
            [tokens, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
            // using proportional exit: [EXACT_BPT_IN_FOR_TOKENS_OUT, bptAmountIn]
            const intermediaryUserdata = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [1, bptAmountIn]);
            let exitRequest = {
                assets: tokens,
                minAmountsOut,
                userData: intermediaryUserdata,
                toInternalBalance: false
            }
            let bptIn: BigNumber;
            let amountsOut: BigNumber[];
            [bptIn, amountsOut] = await balancerHelpers.callStatic.queryExit(BALANCER_POOL_ID, amo.address, amo.address, exitRequest);
            console.log("BPTIN", bptIn, amountsOut);

            // fail invalid request
            exitRequest.toInternalBalance = true;
            await shouldThrow(amo.removeLiquidity(exitRequest, bptAmountIn), /InvalidBalancerVaultRequest/);
            
            // fail insufficient bpt
            exitRequest.toInternalBalance = false;
            await shouldThrow(amo.removeLiquidity(exitRequest, bptAmountIn.add(1)), /InsufficientBPTAmount/);

            exitRequest.minAmountsOut = amountsOut;
            exitRequest.userData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [1, bptAmountIn]);
            const templeBefore = await templeToken.balanceOf(amo.address);
            const stableBefore = await daiToken.balanceOf(amo.address);
            await amo.removeLiquidity(exitRequest, bptIn);
            
            expect(await bptToken.balanceOf(amo.address)).to.eq(bptAmountIn.sub(bptIn));

            
            let expectedTemple: BigNumber;
            let expectedStable: BigNumber;
            const templeIndex = await amo.templeBalancerPoolIndex();
            if (templeIndex.toNumber() == 0) {
                expectedTemple = amountsOut[0];
                expectedStable = amountsOut[1];
            } else {
                expectedTemple = amountsOut[1];
                expectedStable = amountsOut[0];
            }
            const templeAfter= await templeToken.balanceOf(amo.address);
            const stableAfter = await daiToken.balanceOf(amo.address);
            expect(stableAfter).to.gte(stableBefore.add(expectedStable));
            expect(templeAfter).to.gte(templeBefore.add(expectedTemple));
        });

        it("deposits stable", async () => {
            // fail checks
            const cappedAmounts = await amo.cappedRebalanceAmounts();
            await shouldThrow(amo.depositStable(100, 0), /ZeroSwapLimit/);
            await shouldThrow(amo.depositStable(cappedAmounts.stable.add(1), 1), /AboveCappedAmount/);
            // skew price to above TPF to trigger no rebalance
            // single-side deposit stable token
            await singleSideDepositStable(daiToken, toAtto(150_000));
            await shouldThrow(amo.depositStable(ONE_ETH, 1), /NoRebalanceUp/);

            // single-side withdraw stable to skew price below TPF
            await singleSideDepositTemple(templeToken, toAtto(400_000));

            // rebalance
            // increase capped amount
            const amountIn = toAtto(10_000);
            const setCappedAmounts = {
                temple: amountIn,
                bpt: amountIn,
                stable: amountIn
            }
            // TODO: create and use 50/50 pool.
            // await amo.setCappedRebalanceAmounts(setCappedAmounts);
            // const currentSpotPriceScaled = await getSpotPriceScaled();
            // expect(currentSpotPriceScaled).gt(9_700);
            
            // fund(daiToken, amo.address, amountIn)
            // await expect(amo.depositStable(amountIn, 1)).to.emit(amo, "StableDeposited");
        });

        it("withdraws stable", async () => {

        });
    });
});

async function getSpotPriceScaled() {
    let balances: BigNumber[];
    const precision = BigNumber.from(10_000);
    [, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    const normWeights = await weightedPool2Tokens.getNormalizedWeights();
    // multiply by precision to avoid rounding down
    const currentSpotPrice = precision.mul(balances[0]).div(normWeights[0]).div(balances[1].div(normWeights[1]));
    console.log("SPOT price scaled", currentSpotPrice);
    return currentSpotPrice;
}

async function singleSideDepositStable(
    stableToken: IERC20,
    amount: BigNumber
) {
    const whaleAddress = await daiWhale.getAddress();
    const assets = [TEMPLE, DAI];
    console.log("AMOUNT ", amount, await stableToken.balanceOf(whaleAddress));
    await stableToken.connect(daiWhale).approve(balancerVault.address, amount);
    // using exact tokens join with temple set to 0. [EXACT_TOKENS_IN_FOR_BPT_OUT, amountsIn, minimumBPT]
    let bptOut: BigNumber;
    let amountsIn: BigNumber[] = [BigNumber.from(0), amount];
    let userdata = ethers.utils.defaultAbiCoder.encode(["uint256","uint256[]","uint256"], [1, amountsIn, 1]);
    let req = {
        assets: assets,
        maxAmountsIn: amountsIn,
        userData: userdata,
        fromInternalBalance: false
    };

    [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, whaleAddress, whaleAddress, req);
    userdata = ethers.utils.defaultAbiCoder.encode(["uint256","uint256[]","uint256"], [1, amountsIn, bptOut]);
    console.log("AMOUNTS IN SIGNLE SIDE", amountsIn, bptOut);
    const request = {
        assets: assets,
        maxAmountsIn: amountsIn, //[0, amount],
        userData: userdata,
        fromInternalBalance: false
    }
    await balancerVault.connect(daiWhale).joinPool(BALANCER_POOL_ID, whaleAddress, whaleAddress, request);
}

async function singleSideDepositTemple(
    templeToken: TempleERC20Token,
    amount: BigNumber
) {
    const whaleAddress = await templeWhale.getAddress();
    const assets = [TEMPLE, DAI];
    console.log("AMOUNT ", amount, await templeToken.balanceOf(whaleAddress));
    await templeToken.connect(templeWhale).approve(balancerVault.address, amount);
    // using exact tokens join with temple set to 0. [EXACT_TOKENS_IN_FOR_BPT_OUT, amountsIn, minimumBPT]
    let bptOut: BigNumber;
    let amountsIn: BigNumber[] = [amount, BigNumber.from(0)];
    let userdata = ethers.utils.defaultAbiCoder.encode(["uint256","uint256[]","uint256"], [1, amountsIn, 1]);
    let req = {
        assets: assets,
        maxAmountsIn: amountsIn,
        userData: userdata,
        fromInternalBalance: false
    };

    [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, whaleAddress, whaleAddress, req);
    userdata = ethers.utils.defaultAbiCoder.encode(["uint256","uint256[]","uint256"], [1, amountsIn, bptOut]);
    console.log("AMOUNTS IN SIGNLE SIDE", amountsIn, bptOut);
    const request = {
        assets: assets,
        maxAmountsIn: amountsIn,
        userData: userdata,
        fromInternalBalance: false
    }
    await balancerVault.connect(templeWhale).joinPool(BALANCER_POOL_ID, whaleAddress, whaleAddress, request);
}

async function fund(tokenWithSigner: IERC20, to: string, amount: BigNumber) {
    await tokenWithSigner.transfer(to, amount);
}

async function impersonateAddress(address: string) {
    await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [address],
    });
    return ethers.provider.getSigner(address);
}

async function resetFork(blockNumber: Number) {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.TESTS_MAINNET_RPC_URL,
            blockNumber
          },
        },
      ],
    });
}