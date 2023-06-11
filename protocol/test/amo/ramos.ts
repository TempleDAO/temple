import { ethers } from "hardhat";
import { expect } from "chai";
import { toAtto, mineForwardSeconds, blockTimestamp, resetFork, impersonateSigner, setExplicitAccess } from "../helpers";
import { BigNumber, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import addresses from "../constants";
import {
    swapDaiForBbaUsd,
    seedTempleBbaUsdPool,
    getJoinPoolRequest,
    singleSideDeposit,
    templeLotSizeForPriceTarget,
    getSpotPriceScaled,
    getTempleIndexInBalancerPool
} from "./common";
import amoAddresses from "./amo-constants";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { 
  TempleERC20Token,
  TempleERC20Token__factory,
  ERC20,
  ERC20__factory,
  IBalancerVault,
  IBalancerVault__factory,
  IBalancerHelpers,
  IBalancerHelpers__factory,
  AuraStaking__factory,
  AuraStaking,
  AMO__ILiquidityGaugeFactory,
  AMO__ILiquidityGaugeFactory__factory,
  IWeightPool2Tokens,
  IWeightPool2Tokens__factory,
  AMO__IPoolManagerProxy,
  AMO__IPoolManagerProxy__factory,
  AMO__IPoolManagerV3,
  AMO__IPoolManagerV3__factory,
  AMO__IAuraGaugeController__factory,
  AMO__IAuraGaugeController,
  AMO__IBalancerAuthorizerAdapter__factory,
  AMO__IBalancerAuthorizerAdapter,
  AMO__IGaugeAdder,
  AMO__IGaugeAdder__factory,
  AMO__IBalancerVotingEscrow__factory,
  AMO__IBalancerVotingEscrow,
  IAuraBaseRewardPool,
  IAuraBaseRewardPool__factory,
  IAuraBooster__factory,
  IAuraBooster,
  BalancerPoolHelper__factory,
  BalancerPoolHelper,
  Ramos__factory,
  Ramos,
  TempleDebtToken__factory,
  TreasuryReservesVault__factory,
  TempleDebtToken,
  TreasuryReservesVault
} from "../../typechain";
import { DEPLOYED_CONTRACTS } from '../../scripts/deploys/helpers';

const { MULTISIG, TEMPLE } = DEPLOYED_CONTRACTS.mainnet;
const { BALANCER_VAULT } = addresses.contracts;
const { FRAX_WHALE, BINANCE_ACCOUNT_8 } = addresses.accounts;
const { FRAX, DAI, } = addresses.tokens;
const { BBA_USD_TOKEN, TEMPLE_BBAUSD_LP_TOKEN, AURA_TOKEN, 
    BALANCER_TOKEN, BAL_WETH_8020_TOKEN } = amoAddresses.mainnet.tokens;
const { TEMPLE_BB_A_USD_BALANCER_POOL_ID } = amoAddresses.mainnet.others;
const { BALANCER_AUTHORIZER_ADAPTER, BALANCER_HELPERS, AURA_BOOSTER , 
    AURA_LIQUIDITY_GAUGE_FACTORY, AURA_POOL_MANAGER_V3, AURA_GAUGE_CONTROLLER,
    GAUGE_ADDER, BAL_VOTING_ESCROW } = amoAddresses.mainnet.contracts;
const { TEMPLE_WHALE, BBA_USD_WHALE, AURA_GAUGE_OWNER , AURA_POOL_MANAGER_OPERATOR, 
    BAL_MULTISIG, BAL_WETH_8020_WHALE, ZERO_ADDRESS } = amoAddresses.mainnet.accounts;

const TPI_SCALED = toAtto(0.97);
const ONE_ETH = toAtto(1);
const BLOCKNUMBER = 15862300;

let amo: Ramos;
let amoStaking: AuraStaking;
let executor: Signer;
let rescuer: Signer;
let alan: Signer;
let templeMultisig: Signer;
let fraxWhale: Signer;
let templeWhale: Signer;
let daiWhale: Signer;
let auraMultisig: Signer;
let balGaugeMultisig: Signer;
let bbaUsdWhale: Signer;
let executorAddress: string;
let alanAddress: string;
let rescuerAddress: string;
let auraGaugeOwner: Signer;
let templeToken: TempleERC20Token;
let fraxToken: ERC20;
let daiToken: ERC20;
let bbaUsdToken: ERC20;
let bptToken: ERC20;
let balancerVault: IBalancerVault;
let balancerHelpers: IBalancerHelpers;
let weightedPool2Tokens: IWeightPool2Tokens;
let liquidityGaugeFactory: AMO__ILiquidityGaugeFactory;
let auraPoolManagerProxy: AMO__IPoolManagerProxy;
let auraPoolManagerV3: AMO__IPoolManagerV3;
let balGaugeController: AMO__IAuraGaugeController;
let authorizerAdapter: AMO__IBalancerAuthorizerAdapter;
let gaugeAdder: AMO__IGaugeAdder;
let balWeth8020Whale: Signer;
let balWeth8020Token: ERC20;
let balancerVotingEscrow: AMO__IBalancerVotingEscrow;
let bbaUsdTempleAuraRewardPool: IAuraBaseRewardPool;
let bbaUsdTempleAuraPID: number;
let bbaUsdTempleAuraDepositToken: ERC20;
let bbaUsdTempleAuraStash: string;
let bbaUsdTempleAuraGauge: string;
let auraBooster: IAuraBooster;
let auraToken: ERC20;
let balToken: ERC20;
let poolHelper: BalancerPoolHelper;
let dUSD: TempleDebtToken;
let trv: TreasuryReservesVault;

describe("Temple Price Floor AMO", async () => {

    before( async () => {
        [executor, rescuer, alan] = await ethers.getSigners();
        executorAddress = await executor.getAddress();
        alanAddress = await alan.getAddress();
        rescuerAddress = await rescuer.getAddress();
    });

    async function setup() {
        await resetFork(BLOCKNUMBER);
        
        templeMultisig = await impersonateSigner(MULTISIG);
        templeWhale = await impersonateSigner(TEMPLE_WHALE);
        fraxWhale = await impersonateSigner(FRAX_WHALE);
        daiWhale = await impersonateSigner(BINANCE_ACCOUNT_8);
        bbaUsdWhale = await impersonateSigner(BBA_USD_WHALE);
        auraGaugeOwner = await impersonateSigner(AURA_GAUGE_OWNER);
        auraMultisig = await impersonateSigner(AURA_POOL_MANAGER_OPERATOR);
        balGaugeMultisig = await impersonateSigner(BAL_MULTISIG); 
        balWeth8020Whale = await impersonateSigner(BAL_WETH_8020_WHALE);
    
        executorAddress = await executor.getAddress();
        alanAddress = await alan.getAddress();
        rescuerAddress = await rescuer.getAddress();

        templeToken = TempleERC20Token__factory.connect(TEMPLE, templeWhale);
        fraxToken = ERC20__factory.connect(FRAX, fraxWhale);
        daiToken = ERC20__factory.connect(DAI, daiWhale);
        bptToken = ERC20__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, executor);
        bbaUsdToken = ERC20__factory.connect(BBA_USD_TOKEN, bbaUsdWhale);
        balWeth8020Token = ERC20__factory.connect(BAL_WETH_8020_TOKEN, balWeth8020Whale);
        auraToken = ERC20__factory.connect(AURA_TOKEN, executor);
        balToken = ERC20__factory.connect(BALANCER_TOKEN, executor);

        balancerVault = IBalancerVault__factory.connect(BALANCER_VAULT, executor);
        balancerHelpers = IBalancerHelpers__factory.connect(BALANCER_HELPERS, executor);
        weightedPool2Tokens = IWeightPool2Tokens__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, executor);
        liquidityGaugeFactory = AMO__ILiquidityGaugeFactory__factory.connect(AURA_LIQUIDITY_GAUGE_FACTORY, auraGaugeOwner);
        auraPoolManagerProxy = AMO__IPoolManagerProxy__factory.connect(AURA_POOL_MANAGER_V3, auraMultisig);
        auraPoolManagerV3 = AMO__IPoolManagerV3__factory.connect(AURA_POOL_MANAGER_V3, auraMultisig);
        balGaugeController = AMO__IAuraGaugeController__factory.connect(AURA_GAUGE_CONTROLLER, balGaugeMultisig);
        authorizerAdapter = AMO__IBalancerAuthorizerAdapter__factory.connect(BALANCER_AUTHORIZER_ADAPTER, balGaugeMultisig);
        gaugeAdder = AMO__IGaugeAdder__factory.connect(GAUGE_ADDER, balGaugeMultisig);
        balancerVotingEscrow = AMO__IBalancerVotingEscrow__factory.connect(BAL_VOTING_ESCROW, balWeth8020Whale);
        auraBooster = IAuraBooster__factory.connect(AURA_BOOSTER, executor);

        // transfer temple for pool seeding
        const templeMultisigConnect = templeToken.connect(templeMultisig);
        await templeMultisigConnect.transfer(await templeWhale.getAddress(), toAtto(2_000_000));
        await templeMultisigConnect.transfer(executorAddress, toAtto(2_000_000));
        const templeIndexInBalancerPool = await getTempleIndexInBalancerPool(balancerVault, templeToken.address);
 
        // seed balancer pool
        await swapDaiForBbaUsd(balancerVault, daiToken, daiWhale, toAtto(2_000_000), executorAddress);
        await seedTempleBbaUsdPool(templeToken, balancerVault, balancerHelpers, executor, toAtto(1_000_000), executorAddress);
        
        await executor.sendTransaction({value: ONE_ETH, to: BAL_MULTISIG });
        await executor.sendTransaction({value: ONE_ETH, to: await auraMultisig.getAddress()});

        dUSD = await new TempleDebtToken__factory(executor).deploy("Temple Debt", "dUSD", rescuerAddress, executorAddress, ethers.utils.parseEther("0.01"));
        trv = await new TreasuryReservesVault__factory(executor).deploy(rescuerAddress, executorAddress, TEMPLE, BBA_USD_TOKEN, dUSD.address, ethers.utils.parseEther("0.97"));

         // create gauge and add pool on Aura
        let token, rewards: string;
        [bbaUsdTempleAuraGauge, token, rewards, bbaUsdTempleAuraStash, bbaUsdTempleAuraPID] = await createAuraPoolAndStakingContracts(auraGaugeOwner, BigNumber.from("20000000000000000"));
        bbaUsdTempleAuraDepositToken = ERC20__factory.connect(token, executor);
        bbaUsdTempleAuraRewardPool = IAuraBaseRewardPool__factory.connect(rewards, executor);
        amoStaking = await new AuraStaking__factory(executor).deploy(
            rescuerAddress, executorAddress, 
            TEMPLE_BBAUSD_LP_TOKEN,
            AURA_BOOSTER,
            [BALANCER_TOKEN, AURA_TOKEN]
         );

        amo = await new Ramos__factory(executor).deploy(
            rescuerAddress,
            executorAddress,
            BALANCER_VAULT,
            TEMPLE,
            BBA_USD_TOKEN,
            TEMPLE_BBAUSD_LP_TOKEN,
            amoStaking.address,
            0,
            TEMPLE_BB_A_USD_BALANCER_POOL_ID,
            trv.address
        );

        poolHelper = await new BalancerPoolHelper__factory(executor).deploy(
            BALANCER_VAULT,
            BALANCER_HELPERS,
            TEMPLE,
            BBA_USD_TOKEN,
            bptToken.address,
            amo.address,
            templeIndexInBalancerPool,
            TEMPLE_BB_A_USD_BALANCER_POOL_ID
        );
        
        await amo.setPoolHelper(poolHelper.address);
        await setExplicitAccess(amoStaking, "withdrawAndUnwrap", amo.address, true);
        await setExplicitAccess(amoStaking, "depositAndStake", amo.address, true);
        await amoStaking.setRewardsRecipient(executorAddress);
        await bbaUsdToken.connect(executor).transfer(amo.address, toAtto(500_000));
        await templeMultisigConnect.addMinter(amo.address);

        // set params
        await amoStaking.setAuraPoolInfo(bbaUsdTempleAuraPID, bbaUsdTempleAuraDepositToken.address, bbaUsdTempleAuraRewardPool.address);
        await amo.setCoolDown(1800); // 30 mins
        await amo.setRebalancePercentageBounds(200, 500);
        const maxAmounts = {
            bpt: BigNumber.from(ONE_ETH).mul(10),
            temple: BigNumber.from(ONE_ETH).mul(10),
            stable: BigNumber.from(ONE_ETH).mul(10)
        }
        await amo.setMaxRebalanceAmounts(maxAmounts.bpt, maxAmounts.stable, maxAmounts.temple);
        await amo.setPostRebalanceSlippage(200); // 2% max price movement
        await templeToken.transfer(MULTISIG, ethers.utils.parseEther("100"));

        return {
            templeMultisig,
            templeWhale,
            fraxWhale,
            daiWhale,
            bbaUsdWhale,
            auraGaugeOwner,
            auraMultisig,
            balGaugeMultisig,
            balWeth8020Whale,

            templeToken,
            fraxToken,
            daiToken,
            bptToken,
            bbaUsdToken,
            balWeth8020Token,
            auraToken,
            balToken,

            balancerVault,
            balancerHelpers,
            weightedPool2Tokens,
            liquidityGaugeFactory,
            auraPoolManagerProxy,
            auraPoolManagerV3,
            balGaugeController,
            authorizerAdapter,
            gaugeAdder,
            balancerVotingEscrow,
            auraBooster,

            bbaUsdTempleAuraGauge,
            bbaUsdTempleAuraStash,
            bbaUsdTempleAuraPID,

            bbaUsdTempleAuraDepositToken,
            bbaUsdTempleAuraRewardPool,

            poolHelper,
            amoStaking,
            amo,
        };
    }
    
    beforeEach( async () => {
        ({
            templeMultisig,
            templeWhale,
            fraxWhale,
            daiWhale,
            bbaUsdWhale,
            auraGaugeOwner,
            auraMultisig,
            balGaugeMultisig,
            balWeth8020Whale,

            templeToken,
            fraxToken,
            daiToken,
            bptToken,
            bbaUsdToken,
            balWeth8020Token,
            auraToken,
            balToken,

            balancerVault,
            balancerHelpers,
            weightedPool2Tokens,
            liquidityGaugeFactory,
            auraPoolManagerProxy,
            auraPoolManagerV3,
            balGaugeController,
            authorizerAdapter,
            gaugeAdder,
            balancerVotingEscrow,
            auraBooster,

            bbaUsdTempleAuraGauge,
            bbaUsdTempleAuraStash,
            bbaUsdTempleAuraPID,

            bbaUsdTempleAuraDepositToken,
            bbaUsdTempleAuraRewardPool,

            poolHelper,
            amoStaking,
            amo,
        } = await loadFixture(setup));
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
            await expect(connectAMO.setCoolDown(1800)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.setPoolHelper(alanAddress)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.setAmoStaking(alanAddress)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.setTreasuryReservesVault(alanAddress)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.setRebalancePercentageBounds(100,100)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.setMaxRebalanceAmounts(100, 100, 100)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.setPostRebalanceSlippage(100)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.pause()).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.unpause()).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.recoverToken(TEMPLE , alanAddress, 100)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.rebalanceDown(ONE_ETH, 1)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.rebalanceUp(ONE_ETH, 1)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.depositStable(100, 1)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.withdrawStable(100, 1, amo.address)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.addLiquidity(joinPoolRequest)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.removeLiquidity(exitPoolRequest, 100, amo.address)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(connectAMO.depositAndStakeBptTokens(100, true)).to.be.revertedWithCustomError(amo, "InvalidAccess");

            // passes
            await amo.setMaxRebalanceAmounts(100, 100, 100);
            await amo.setPostRebalanceSlippage(100);
            await amo.pause();
            await amo.unpause();
            await amo.setCoolDown(1800);
            await amo.setTreasuryReservesVault(trv.address);
        });

        it("sets pool helper", async () => {
            await expect(amo.setPoolHelper(poolHelper.address))
                .to.emit(amo, "SetPoolHelper")
                .withArgs(poolHelper.address);
        });

        it("sets amo staking", async () => {
            await expect(amo.setAmoStaking(amoStaking.address))
                .to.emit(amo, "SetAmoStaking")
                .withArgs(amoStaking.address);
        });

        it("sets aura pool info", async () => {
            await expect(amoStaking.setAuraPoolInfo(bbaUsdTempleAuraPID, bbaUsdTempleAuraDepositToken.address, bbaUsdTempleAuraRewardPool.address))
                .to.emit(amoStaking, "SetAuraPoolInfo").withArgs(bbaUsdTempleAuraPID, bbaUsdTempleAuraDepositToken.address, bbaUsdTempleAuraRewardPool.address);
            const auraPoolInfo = await amoStaking.auraPoolInfo();
            expect(auraPoolInfo.rewards).to.eq(bbaUsdTempleAuraRewardPool.address);
            expect(auraPoolInfo.pId).to.eq(bbaUsdTempleAuraPID);
            expect(auraPoolInfo.token).to.eq(bbaUsdTempleAuraDepositToken.address);
        });

        it("sets rebalance lower and upper bounds", async () => {
            await expect(amo.setRebalancePercentageBounds(10_001, 9_800))
                .to.be.revertedWithCustomError(amo, "InvalidBPSValue").withArgs(10_001);
            await expect(amo.setRebalancePercentageBounds(2_000, 10_001))
                .to.be.revertedWithCustomError(amo, "InvalidBPSValue");
            await amo.setRebalancePercentageBounds(100, 400);
            expect(await amo.rebalancePercentageBoundLow()).to.eq(100);
            expect(await amo.rebalancePercentageBoundUp()).to.eq(400);
        });
    
        it("sets treasury reserves vault", async () => {
            const newTrv = await new TreasuryReservesVault__factory(executor).deploy(rescuerAddress, executorAddress, TEMPLE, BBA_USD_TOKEN, dUSD.address, ethers.utils.parseEther("0.97"));
            await expect(amo.setTreasuryReservesVault(newTrv.address))
                .to.emit(amo, "SetTreasuryReservesVault")
                .withArgs(newTrv.address);
            expect(await amo.treasuryReservesVault()).to.eq(newTrv.address);

            await expect(amo.setTreasuryReservesVault(ZERO_ADDRESS))
                .to.revertedWithCustomError(amo, "InvalidAddress");
        });

        it("sets cooldown", async () => {
            const secs = 1800;
            await expect(amo.setCoolDown(secs))
                .to.emit(amo, "SetCooldown").withArgs(secs);
        });

        it("pause/unpause", async () => {
            await expect(amo.pause()).to.emit(amo, "Paused").withArgs(executorAddress);
            mineForwardSeconds(10_000);
            await expect(amo.rebalanceDown(100, 1)).to.be.revertedWith("Pausable: paused");

            // unpause
            await expect(amo.unpause()).to.emit(amo, "Unpaused").withArgs(executorAddress);
            amo.rebalanceDown(ONE_ETH, 1);
        });

        it("sets max rebalance amounts", async () => {
            const maxAmounts = {
                bpt: toAtto(1_000),
                stable: toAtto(2_000),
                temple: toAtto(3_000),
            }
            await expect(amo.setMaxRebalanceAmounts(0, 0, 1)).to.be.revertedWithCustomError(amo, "InvalidMaxAmounts");
            await expect(amo.setMaxRebalanceAmounts(1, 0, 1)).to.be.revertedWithCustomError(amo, "InvalidMaxAmounts");
            await expect(amo.setMaxRebalanceAmounts(1, 1, 0)).to.be.revertedWithCustomError(amo, "InvalidMaxAmounts");
            await amo.setMaxRebalanceAmounts(maxAmounts.bpt, maxAmounts.stable, maxAmounts.temple);
            const updatedMaxAmounts = await amo.maxRebalanceAmounts();
            expect(maxAmounts.bpt).to.eq(updatedMaxAmounts.bpt);
            expect(maxAmounts.stable).to.eq(updatedMaxAmounts.stable);
            expect(maxAmounts.temple).to.eq(updatedMaxAmounts.temple);
        });

        it("sets post rebalance slippage", async () => {
            await expect(amo.setPostRebalanceSlippage(0)).to.be.revertedWithCustomError(amo, "InvalidBPSValue");
            await expect(amo.setPostRebalanceSlippage(10_001)).to.be.revertedWithCustomError(amo, "InvalidBPSValue");
            await expect(amo.setPostRebalanceSlippage(100)).to.emit(amo, "SetPostRebalanceSlippage").withArgs(100);
        });

        it("recovers tokens", async () => {
            const amount = 1000;
            await bbaUsdToken.transfer(amo.address, amount);
            const balBefore = await bbaUsdToken.balanceOf(executorAddress);
            // recover token
            const checksummedAddress = ethers.utils.getAddress(bbaUsdToken.address);
            await expect(amo.recoverToken(bbaUsdToken.address, executorAddress, amount))
                .to.emit(amo, "RecoveredToken")
                .withArgs(checksummedAddress, executorAddress, amount);
            
            expect(await bbaUsdToken.balanceOf(executorAddress)).eq(balBefore.add(amount));
        });
    });

    describe("Liquidity Add/Remove", async () => {

        it("adds liquidity minting TEMPLE", async () => {
            const [tokens, ,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);

            const templeStableBalancesBefore = await poolHelper.getTempleStableBalances();
            const templeIndex = (await poolHelper.templeIndexInBalancerPool()).toNumber();
            const templeBalanceBefore = templeStableBalancesBefore.templeBalance;
            const stableBalanceBefore = templeStableBalancesBefore.stableBalance;
            const templeAmountIn = toAtto(1000);
            const stableAmountIn = stableBalanceBefore.mul(templeAmountIn).div(templeBalanceBefore);
            const maxAmountsIn = templeIndex == 0 ? [templeAmountIn, stableAmountIn] : [stableAmountIn, templeAmountIn];

            const { joinPoolRequest, bptOut } = await getJoinPoolRequest(tokens, balancerHelpers, amo.address, amo.address, maxAmountsIn);
            
            const bptAmountBefore = await bptToken.balanceOf(amoStaking.address);
            expect(bptAmountBefore).to.eq(0);
            const stakedBalanceBefore = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);

            // fails
            const failRequest = {
                assets: tokens,
                maxAmountsIn,
                userData: joinPoolRequest.userData,
                fromInternalBalance: true
            }
            await expect(amo.addLiquidity(failRequest)).to.be.revertedWithCustomError(amo, "InvalidBalancerVaultRequest");
            failRequest.assets = [TEMPLE];
            await expect(amo.addLiquidity(failRequest)).to.be.revertedWithCustomError(amo, "InvalidBalancerVaultRequest");
            failRequest.assets = tokens;
            failRequest.maxAmountsIn = [BigNumber.from(1)];
            await expect(amo.addLiquidity(failRequest)).to.be.revertedWithCustomError(amo, "InvalidBalancerVaultRequest");
            {
                const newFailRequest = {
                    assets: tokens,
                    maxAmountsIn,
                    userData: ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]", "uint256"], [1, maxAmountsIn, bptOut.add(1)]),
                    fromInternalBalance: false
                }

                // https://docs.balancer.fi/reference/contracts/error-codes.html#input
                // 208 BPT_OUT_MIN_AMOUNT    Slippage/front-running protection check failed on a pool join
                await expect(amo.addLiquidity(newFailRequest)).to.be.revertedWith("BAL#208");
            }
            failRequest.fromInternalBalance = false;
            failRequest.maxAmountsIn = maxAmountsIn;
            await expect(amo.addLiquidity(joinPoolRequest))
                .to.emit(templeToken, "Transfer").withArgs(ZERO_ADDRESS, amo.address, joinPoolRequest.maxAmountsIn[0])
                .to.emit(auraBooster, "Deposited").withArgs(amoStaking.address, bbaUsdTempleAuraPID, bptOut)
                .to.emit(amo, "LiquidityAdded").withArgs(stableAmountIn, templeAmountIn, bptOut);

            const bptAmountAfter = await bptToken.balanceOf(amoStaking.address);
            const stakedBalanceAfter = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            const templeStableBalancesAfter = await poolHelper.getTempleStableBalances();
            expect(bptAmountAfter).to.eq(0); // because bpt tokens have been staked
            expect(stakedBalanceAfter).to.eq(stakedBalanceBefore.add(bptOut));
            expect(await templeToken.balanceOf(amo.address)).to.eq(0);
            expect(await bptToken.balanceOf(amo.address)).to.eq(0);
            expect(templeBalanceBefore.mul(BigNumber.from(1e10)).div(stableBalanceBefore))    // pool balance ratio no change
                .to.eq(templeStableBalancesAfter.templeBalance.mul(BigNumber.from(1e10)).div(templeStableBalancesAfter.stableBalance));
        });

        it("removes liquidity EXACT BPT IN for tokens out", async () => {
            // add liquidity to get some staked position
            const bptAmountIn = toAtto(100);
            await ownerAddLiquidity(bptAmountIn);

            // create exit request
            const minAmountsOut = [toAtto(10_000), toAtto(10_000)];
            const [tokens,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);

            // using proportional exit: [EXACT_BPT_IN_FOR_TOKENS_OUT, bptAmountIn]
            const intermediaryUserdata = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [1, bptAmountIn]);
            const exitRequest = {
                assets: tokens,
                minAmountsOut,
                userData: intermediaryUserdata,
                toInternalBalance: false
            }
           
            const [bptIn, amountsOut] = await balancerHelpers.queryExit(TEMPLE_BB_A_USD_BALANCER_POOL_ID, amo.address, amo.address, exitRequest);

            // fail invalid request
            exitRequest.toInternalBalance = true;
            await expect(amo.removeLiquidity(exitRequest, bptAmountIn, amo.address)).to.be.revertedWithCustomError(amo, "InvalidBalancerVaultRequest");
            exitRequest.minAmountsOut = [BigNumber.from(1)];
            await expect(amo.removeLiquidity(exitRequest, bptAmountIn, amo.address)).to.be.revertedWithCustomError(amo, "InvalidBalancerVaultRequest");
            exitRequest.assets = [TEMPLE];
            await expect(amo.removeLiquidity(exitRequest, bptAmountIn, amo.address)).to.be.revertedWithCustomError(amo, "InvalidBalancerVaultRequest");
            exitRequest.assets = tokens;
            exitRequest.minAmountsOut = minAmountsOut;
            exitRequest.toInternalBalance = false;

            exitRequest.minAmountsOut = amountsOut;
            exitRequest.userData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [1, bptAmountIn]);
            const amoStableBefore = await bbaUsdToken.balanceOf(amo.address);
            
            const templeIndex = await amo.templeBalancerPoolIndex();
            const expectedStable = (templeIndex.toNumber() == 0) ? amountsOut[1] : amountsOut[0];
            const expectedTemple = (templeIndex.toNumber() == 0) ? amountsOut[0] : amountsOut[1];
            
            expect(await amo.removeLiquidity(exitRequest, bptIn, amo.address))
                .to.emit(templeToken, "Transfer").withArgs(amoStaking.address, ZERO_ADDRESS, amountsOut[0])
                .to.emit(bbaUsdTempleAuraRewardPool, "Withdrawn").withArgs(amoStaking.address, bbaUsdTempleAuraPID, bptIn)
                .to.emit(amo, "LiquidityRemoved").withArgs(expectedStable, expectedTemple, bptIn)
            expect(await bptToken.balanceOf(amo.address)).to.eq(bptAmountIn.sub(bptIn));

            const amoTempleAfter= await templeToken.balanceOf(amo.address);
            const amoStableAfter = await bbaUsdToken.balanceOf(amo.address);
            expect(amoStableAfter).to.eq(amoStableBefore.add(expectedStable))
            expect(amoTempleAfter).to.eq(0);
        });

        it("deposits stable", async () => {
            // fail checks
            const maxAmounts = await amo.maxRebalanceAmounts();
            await expect(amo.depositStable(100, 0)).to.be.revertedWithCustomError(amo, "ZeroSwapLimit");
            await expect(amo.depositStable(maxAmounts.stable.add(1), 1)).to.be.revertedWithCustomError(amo, "AboveCappedAmount");
            // skew price to above TPI to trigger no rebalance
            // single-side deposit stable token
            await singleSideDepositStable(toAtto(10_000));
            await expect(amo.depositStable(ONE_ETH, 1)).to.be.revertedWithCustomError(poolHelper, "NoRebalanceUp");
            await amo.pause();
            await expect(amo.depositStable(ONE_ETH, 1)).to.be.revertedWith("Pausable: paused");
            await amo.unpause();
            // single-side withdraw stable to skew price below TPI
            await singleSideDepositTemple(toAtto(100_000));

            // willStableJoinTakePriceAboveTpiUpperBound
            await amo.setMaxRebalanceAmounts(toAtto(100_000), toAtto(200_000), toAtto(100_000));
            await expect(amo.depositStable(toAtto(200_000), 1))
                .to.be.revertedWithCustomError(poolHelper, "HighSlippage");

            // increase capped amount
            const amountIn = toAtto(10_000);

            await amo.setMaxRebalanceAmounts(amountIn, amountIn, amountIn);

            const currentSpotPriceScaled = await getSpotPriceScaled(balancerVault, weightedPool2Tokens);
            expect(currentSpotPriceScaled).eq(await poolHelper.getSpotPrice());
            expect(currentSpotPriceScaled).lt(TPI_SCALED);

            const reqData = await getAmoJoinPoolRequest(amo.address, [BigNumber.from(0), amountIn]);
            const bptOut = reqData.bptOut;
            const stakedBalanceBefore = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            const stableBalanceBefore = await bbaUsdToken.balanceOf(amo.address); 

            await expect(amo.depositStable(amountIn, bptOut))
                .to.emit(amo, "StableDeposited").withArgs(amountIn, bptOut)
                .to.emit(auraBooster, "Deposited").withArgs(amoStaking.address, bbaUsdTempleAuraPID, bptOut);
            const stakedBalanceAfter = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            const stableBalanceAfter = await bbaUsdToken.balanceOf(amo.address);
            expect(stakedBalanceAfter).to.eq(stakedBalanceBefore.add(bptOut));
            expect(stableBalanceAfter).to.eq(stableBalanceBefore.sub(reqData.joinPoolRequest.maxAmountsIn[1]));
        });

        it("withdraws stable", async () => {
            // fail checks
            const maxAmounts = await amo.maxRebalanceAmounts();
            await expect(amo.depositStable(100, 0)).to.be.revertedWithCustomError(amo, "ZeroSwapLimit");
            await expect(amo.depositStable(maxAmounts.bpt.add(1), 1)).to.be.revertedWithCustomError(amo, "AboveCappedAmount");

            await ownerDepositAndStakeBpt(toAtto(20_000));
            
            // skew price below TPI
            await singleSideDepositTemple(toAtto(50_000));
            await trv.setTreasuryPriceIndex(ethers.utils.parseEther("0.97"));
            await expect(amo.withdrawStable(ONE_ETH, 1, amo.address)).to.be.revertedWithCustomError(poolHelper, "NoRebalanceDown");
            await amo.pause();
            await expect(amo.withdrawStable(1, 1, amo.address)).to.be.revertedWith("Pausable: paused");
            await amo.unpause();
            // skew price above TPI
            await singleSideDepositStable(toAtto(200_000));

            // // add liquidity to get some staked position
            const stakeAmount = toAtto(100_000);
            await ownerAddLiquidity(stakeAmount);
            await ownerDepositAndStakeBpt(stakeAmount);
            const amountOut = toAtto(1_000);
            const minAmountsOut = [BigNumber.from(0), amountOut];
            const bptAmountIn = toAtto(100);
            const reqData = await getExitPoolRequest(bptAmountIn, minAmountsOut, 0, BigNumber.from(1));
            const amountsOut = reqData.amountsOut;
            const exitTokenAmountOut = BigNumber.from(amountsOut[1]);
            const bptIn = reqData.bptIn;
            await amo.setMaxRebalanceAmounts(bptIn, bptIn, bptIn);

            const stableBalanceBefore = await bbaUsdToken.balanceOf(amo.address);
            const stakedBalanceBefore = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            // willStableExitTakePriceBelowTpiLowerBound
            await amo.setMaxRebalanceAmounts(stakeAmount, stakeAmount, stakeAmount);
            await expect(amo.withdrawStable(bptIn, exitTokenAmountOut.add(toAtto(300_000)), amo.address))
                .to.be.revertedWithCustomError(poolHelper, "HighSlippage");
            await expect(amo.withdrawStable(bptIn, exitTokenAmountOut, amo.address))
                .to.emit(amo, "WithdrawStable").withArgs(bptIn, exitTokenAmountOut, amo.address)
                .to.emit(auraBooster, "Withdrawn").withArgs(amoStaking.address, bbaUsdTempleAuraPID, bptIn);
            const stableBalanceAfter = await bbaUsdToken.balanceOf(amo.address);
            expect(stableBalanceAfter).to.gte(stableBalanceBefore.add(exitTokenAmountOut));
            expect(await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address)).to.eq(stakedBalanceBefore.sub(bptIn));
        });

        it("directly stakes bpt tokens", async () => {
            const joinAmount = toAtto(20_000);
            const reqData = await getAmoJoinPoolRequest(amo.address, [joinAmount, joinAmount]);

            // No approval required for bbaUsd into the balancer vault.
            await templeToken.connect(executor).approve(balancerVault.address, joinAmount);

            await balancerVault.connect(executor).joinPool(TEMPLE_BB_A_USD_BALANCER_POOL_ID, executorAddress, executorAddress, reqData.joinPoolRequest);
            const amount = reqData.bptOut;

            await bptToken.connect(executor).approve(amo.address, amount);
            const balBefore = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            await amo.depositAndStakeBptTokens(amount, false);
            const balAfter = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            
            expect(balAfter).to.eq(balBefore.add(amount));

            // deposit and stake using contract balance
            // No approval required for bbaUsd into the balancer vault.
            const amoBptBalance = await bptToken.balanceOf(amo.address);
            await templeToken.connect(executor).approve(balancerVault.address, joinAmount);

            // get bpt tokens and send to amo
            await balancerVault.connect(executor).joinPool(TEMPLE_BB_A_USD_BALANCER_POOL_ID, executorAddress, amo.address, reqData.joinPoolRequest);
            const amoBptBalanceAfter = await bptToken.balanceOf(amo.address)
            expect(amoBptBalanceAfter).to.gt(amoBptBalance);
            await amo.depositAndStakeBptTokens(amoBptBalanceAfter, true);
        });

        it("rebalances up", async () => {
            await amo.setCoolDown(0);
            // fails
            await expect(amo.rebalanceUp(0, 0)).to.be.revertedWithCustomError(amo, "ZeroSwapLimit");
            await expect(amo.rebalanceUp(toAtto(1_000), 1)).to.be.revertedWithCustomError(amo, "AboveCappedAmount");
            await amo.pause();
            await expect(amo.rebalanceUp(1, 1)).to.be.revertedWith("Pausable: paused");
            await amo.unpause();
           
            // add liquidity on-sided to skew price above TPI
            await singleSideDepositStable(toAtto(40_000));
            const spotPriceScaled = await poolHelper.getSpotPrice();
            expect(spotPriceScaled).to.gt(TPI_SCALED);
            // directly stake bpt tokens
            const bptOut = await ownerDepositAndStakeBpt(toAtto(10_000));
        
            await amo.setMaxRebalanceAmounts(bptOut, bptOut, bptOut);

            await expect(amo.rebalanceUp(bptOut, 1)).to.be.revertedWithCustomError(poolHelper, "NoRebalanceUp");

            await amo.setPostRebalanceSlippage(400); // 4%
            
            // now single side deposit TEMPLE to bring spot price down if up
            const spotPriceNow = await getSpotPriceScaled(balancerVault, weightedPool2Tokens);
            const discountBelowTpi = 200; // 2% below TPI
            if (spotPriceNow.gt(TPI_SCALED.sub(discountBelowTpi))) {
                await singleSideDepositTemple(toAtto(100_000));
            }
            // stake some more to have enough bpt to unwrap
            await ownerDepositAndStakeBpt(toAtto(20_000));

            // calculate amount of TEMPLE out to take spot quote price close to TPI by a slight percentage below TPI
            const data = await calculateBptTokensToBringTemplePriceUp(discountBelowTpi); // 2% below TPI
            const bptIn = data.bptIn;
            const maxAmounts = await amo.maxRebalanceAmounts();
            const cappedBptAmountPerRebalance = maxAmounts.bpt;
            if (cappedBptAmountPerRebalance.lt(bptIn)) {
                await amo.setMaxRebalanceAmounts(bptIn, bptIn, bptIn);
            }
            const templeAmountOut = data.amountOut;
            const totalBptStaked = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            // test with total bpt staked to trigger high price impact after balancer pool exit
            await amo.setMaxRebalanceAmounts(totalBptStaked, bptIn, bptIn);
            await expect(amo.rebalanceUp(totalBptStaked, templeAmountOut))
                .to.be.revertedWithCustomError(poolHelper, "HighSlippage");
            await expect(amo.rebalanceUp(bptIn, templeAmountOut))
                .to.emit(amo, "RebalanceUp");
            const newMaxAmount = toAtto(200_000);
            await amo.setMaxRebalanceAmounts(newMaxAmount, newMaxAmount, newMaxAmount);
            // stake some more to have enough bpt to unwrap and trigger price drop
            await ownerDepositAndStakeBpt(toAtto(150_000));
            await singleSideDepositTemple(toAtto(50_000));

            // test cooldown
            await amo.setCoolDown(1_800);
            await time.increase((await amo.cooldownSecs()).sub(10));
            await expect(amo.rebalanceUp(toAtto(10_000), 1)).to.be.revertedWithCustomError(amo, "NotEnoughCooldown");
            await amo.setCoolDown(0);

            // exit will take price above TPI upper bound
            await expect(amo.rebalanceUp(toAtto(130_000), toAtto(250_000)))
                .to.be.revertedWithCustomError(poolHelper, "HighSlippage");

            // no rebalance up
            const rebalanceBoundUp = await amo.rebalancePercentageBoundUp();
            const tpi = await amo.treasuryPriceIndex();
            // send price up
            await singleSideDepositStable(toAtto(50_000));
            await expect(amo.rebalanceUp(1, 1)).to.be.revertedWithCustomError(poolHelper, "NoRebalanceUp");
            expect(await poolHelper["isSpotPriceAboveTpi(uint256)"](tpi)).to.be.false;
            expect(await poolHelper.isSpotPriceAboveTpiUpperBound(rebalanceBoundUp, tpi)).to.be.false;
        });

        it("rebalances down", async () => {
            await amo.setCoolDown(0);
            // fails
            await expect(amo.rebalanceDown(0, 0)).to.be.revertedWithCustomError(amo, "ZeroSwapLimit");
            await expect(amo.rebalanceDown(toAtto(1_000), 1)).to.be.revertedWithCustomError(amo, "AboveCappedAmount");
            await amo.pause();
            await expect(amo.rebalanceDown(1, 1)).to.be.revertedWith("Pausable: paused");
            await amo.unpause();
            
            // add single-side liquidity to skew price below TPI
            const templeIndexInPool = (await poolHelper.templeIndexInBalancerPool()).toNumber();
            const targetPriceScaled = toAtto(0.95);
            const templeLotSize = await templeLotSizeForPriceTarget(balancerVault, templeIndexInPool, targetPriceScaled);
            const amountsIn = [templeLotSize, BigNumber.from(0)];
            await singleSideDeposit(balancerVault, balancerHelpers, templeWhale, amountsIn);

            const maxAmount = toAtto(200_000);
            await amo.setMaxRebalanceAmounts(maxAmount, maxAmount, maxAmount);
            await expect(amo.rebalanceDown(toAtto(200_000), 1)).to.be.revertedWithCustomError(poolHelper, "NoRebalanceDown");
            
            // add single-side stable to skew price above TPI
            await singleSideDepositStable(toAtto(220_000));

            // stake some bpt to have enough bpt to unwrap
            await ownerDepositAndStakeBpt(toAtto(30_000));

            // make sure to meet the capped amount
            const positions = await amo.positions();
            await amo.setMaxRebalanceAmounts(positions.bptBalance, positions.stableBalance, positions.templeBalance);
            await amo.setPostRebalanceSlippage(2_000); // 20% max price movement

            // rebalance down - target 4% above TPI
            const reqData = await calculateBptTokensToBringTemplePriceDown(poolHelper.address, 400);

            // Can't go over the cap
            await expect(amo.rebalanceDown(reqData.templeAmountIn.add(toAtto(500_000)), reqData.bptOut))
                .to.be.revertedWithCustomError(amo, "AboveCappedAmount");

            // Success
            await expect(amo.rebalanceDown(reqData.templeAmountIn, reqData.bptOut))
                .to.emit(amo, "RebalanceDown")
                .withArgs(reqData.templeAmountIn, reqData.bptOut);

            const newMaxAmount = toAtto(1_000_000);
            await amo.setMaxRebalanceAmounts(newMaxAmount, newMaxAmount, newMaxAmount);
            // join will take price below TPI lower bound
            await expect(amo.rebalanceDown(toAtto(800_000), reqData.bptOut)).to.be.revertedWithCustomError(poolHelper, "HighSlippage");

            // test cool down
            await amo.setCoolDown(1_800);
            await time.increase((await amo.cooldownSecs()).sub(10));
            await expect(amo.rebalanceDown(toAtto(10_000), reqData.bptOut)).to.be.revertedWithCustomError(amo, "NotEnoughCooldown");
        });

        it("proportional add/remove liquidity", async () => {
            await amo.setCoolDown(0);
            await singleSideDepositStable(toAtto(220_000));
            await ownerDepositAndStakeBpt(toAtto(30_000));

            const positionsBefore = await amo.positions();
            const spotPriceBefore = await poolHelper.getSpotPrice();

            const addQuote = await amo.callStatic.proportionalAddLiquidityQuote(toAtto(100_000), 100);
            await amo.addLiquidity(addQuote.requestData);
            const positionsAfter = await amo.positions();
            const spotPriceAfter = await poolHelper.getSpotPrice();

            // The spot price is the same
            expect(spotPriceAfter).eq(spotPriceBefore);
            expect(positionsAfter.bptBalance).to.be.approximately(positionsBefore.bptBalance.add(addQuote.expectedBptAmount), 1e8);
            expect(positionsAfter.templeBalance).to.be.approximately(positionsBefore.templeBalance.add(addQuote.templeAmount), 1e12);
            expect(positionsAfter.stableBalance).to.be.approximately(positionsBefore.stableBalance.add(toAtto(100_000)), 1e12);

            const bptAmount = toAtto(50_000);
            const removeQuote = await amo.callStatic.proportionalRemoveLiquidityQuote(bptAmount, 100);
            await amo.removeLiquidity(removeQuote.requestData, bptAmount, executorAddress);
            const positionsAfter2 = await amo.positions();
            const spotPriceAfter2 = await poolHelper.getSpotPrice();

            // The spot price is the same
            expect(spotPriceAfter2).eq(spotPriceBefore);
            expect(positionsAfter2.bptBalance).eq(positionsAfter.bptBalance.sub(bptAmount));
            expect(positionsAfter2.templeBalance).to.be.approximately(positionsAfter.templeBalance.sub(removeQuote.expectedTempleAmount), 1e8);
            expect(positionsAfter2.stableBalance).to.be.approximately(positionsAfter.stableBalance.sub(removeQuote.expectedStablesAmount), 1e8);
        });
    });

    describe("Aura Staking", async () => {

        it("admin tests", async () => {
            // fails
            const stakingConnect = amoStaking.connect(alan);
            await expect(stakingConnect.setAuraPoolInfo(10, bptToken.address, bptToken.address)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(stakingConnect.recoverToken(bptToken.address, alanAddress, 100)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(stakingConnect.withdrawAllAndUnwrap(true, alanAddress)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(stakingConnect.setRewardsRecipient(alanAddress)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(stakingConnect.depositAndStake(100)).to.be.revertedWithCustomError(amo, "InvalidAccess");
            await expect(stakingConnect.withdrawAndUnwrap(100, true, executorAddress)).to.be.revertedWithCustomError(amo, "InvalidAccess");

            // passes
            await expect(amoStaking.recoverToken(bptToken.address, alanAddress, 100)).to.be.revertedWith("BAL#416");
            await expect(amoStaking.withdrawAndUnwrap(100, true, executorAddress)).to.be.revertedWith("SafeMath: subtraction overflow");
            await amoStaking.withdrawAllAndUnwrap(false, ZERO_ADDRESS);
            await amoStaking.setRewardsRecipient(executorAddress);
            await expect(amoStaking.depositAndStake(100)).to.be.revertedWith("BAL#416");
            await amoStaking.setAuraPoolInfo(10, bptToken.address, bptToken.address);
        });

        it("recovers token", async () => {
            const amount = 1000;
            await bbaUsdToken.transfer(amoStaking.address, amount);
            const ownerBalanceBefore = await bbaUsdToken.balanceOf(executorAddress);

            // recover token
            const checksummedAddress = ethers.utils.getAddress(bbaUsdToken.address);
            await expect(amoStaking.recoverToken(bbaUsdToken.address, executorAddress, amount))
                .to.emit(amoStaking, "RecoveredToken")
                .withArgs(checksummedAddress, executorAddress, amount);
            const ownerBalanceAfter = await bbaUsdToken.balanceOf(executorAddress);
            expect(await bbaUsdToken.balanceOf(amoStaking.address)).eq(0);
            expect(ownerBalanceAfter).to.eq(ownerBalanceBefore.add(amount));
        });

        it("sets reward recipient", async () => {
            await expect(amoStaking.setRewardsRecipient(executorAddress))
                .to.emit(amoStaking, "SetRewardsRecipient")
                .withArgs(executorAddress);
        });

        it("sets aura pool info", async () => {
            await expect(amoStaking.setAuraPoolInfo(bbaUsdTempleAuraPID, bbaUsdTempleAuraDepositToken.address, bbaUsdTempleAuraRewardPool.address))
                .to.emit(amoStaking, "SetAuraPoolInfo").withArgs(bbaUsdTempleAuraPID, bbaUsdTempleAuraDepositToken.address, bbaUsdTempleAuraRewardPool.address);
            const auraPoolInfo = await amoStaking.auraPoolInfo();
            expect(auraPoolInfo.pId).to.eq(bbaUsdTempleAuraPID);
            expect(auraPoolInfo.token).to.eq(bbaUsdTempleAuraDepositToken.address);
            expect(auraPoolInfo.rewards).to.eq(bbaUsdTempleAuraRewardPool.address);
        });

        it("withdraws", async () => {
            const amount = toAtto(100);
            await ownerAddLiquidity(amount);
            const toWithdraw1 = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            const toWithdraw2 = toWithdraw1.div(2);

            // admin withdraws
            {
                expect(await bptToken.balanceOf(amoStaking.address)).to.eq(0);
                await amoStaking.withdrawAndUnwrap(toWithdraw1, true, ZERO_ADDRESS);
                expect(await bptToken.balanceOf(amoStaking.address)).to.eq(toWithdraw1);
            }

            // admin withdraws sending to ramos
            {
                const amoBalanceBefore = await bptToken.balanceOf(amo.address);
                await ownerAddLiquidity(amount);
                await amoStaking.withdrawAndUnwrap(toWithdraw2, true, amo.address);
                const amoBalanceAfter = await bptToken.balanceOf(amo.address);
                expect(amoBalanceAfter).to.eq(amoBalanceBefore.add(toWithdraw2));
            }
            
            // admin withdraws all, sending to operator
            {
                const amoBalanceBefore = await bptToken.balanceOf(amo.address);
                const alanBalanceBefore = await bptToken.balanceOf(alanAddress);
                await ownerAddLiquidity(amount);
                const toWithdraw3 = amoBalanceBefore.add(await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address));
                await amoStaking.withdrawAllAndUnwrap(true, alanAddress);
                const amoBalanceAfter = await bptToken.balanceOf(amo.address);
                expect(amoBalanceAfter).eq(amoBalanceBefore);
                const alanBalanceAfter = await bptToken.balanceOf(alanAddress);
                const amountTransferred = alanBalanceAfter.sub(alanBalanceBefore);

                // expect that the amount sent to the amo in this instance =
                //    The first withdrawal's BPT (since that was left in the amoStaking)
                //  + The third withdrawal's BPT (also sent to amoStaking)
                expect(amountTransferred).to.eq(toWithdraw3);
            }

            // admin withdraws all, not sending to operator
            {               
                const amoBalanceBefore = await bptToken.balanceOf(amo.address);
                await ownerAddLiquidity(amount);
                const toWithdraw4 = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
                await amoStaking.withdrawAllAndUnwrap(true, ZERO_ADDRESS);
                expect(await bptToken.balanceOf(amo.address)).eq(amoBalanceBefore);
                expect(await bptToken.balanceOf(amoStaking.address)).eq(toWithdraw4);
            }
        });

        it("balance views", async () => {
            const amount = toAtto(10_000);
            await ownerAddLiquidity(amount);
            expect(await poolHelper.getSpotPrice()).to.be.approximately(ONE_ETH, ethers.utils.parseEther("0.00001"));
            const actualStakedBalance = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);

            let stakedBal = await amoStaking.stakedBalance();
            let totalBal = await amoStaking.totalBalance();
            expect(stakedBal).to.eq(actualStakedBalance);
            expect(totalBal).to.eq(actualStakedBalance);

            const toRemove = toAtto(1_000);
            await amoStaking.withdrawAndUnwrap(toRemove, false, ZERO_ADDRESS);
            stakedBal = await amoStaking.stakedBalance();
            totalBal = await amoStaking.totalBalance();
            expect(stakedBal).to.eq(actualStakedBalance.sub(toRemove));
            expect(totalBal).to.eq(actualStakedBalance);

        });

        it("helper functions", async () => {
            const rewardsRecipient = executorAddress;
            const amount = toAtto(10_000);
            await ownerAddLiquidity(amount);
            const stakedBalance = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            
            // fast forward 7 days and check earned
            await mineForwardSeconds(14 * 24 * 3600);
            await balGaugeController.connect(balWeth8020Whale).vote_for_gauge_weights(bbaUsdTempleAuraGauge, 10_000);
            await mineForwardSeconds(7 * 24 * 3600);
            
            // harvest rewards
            await auraBooster.earmarkRewards(bbaUsdTempleAuraPID);
            await mineForwardSeconds(7 * 24 * 3600);
            await auraBooster.earmarkRewards(bbaUsdTempleAuraPID);

            const auraBalanceBefore = await auraToken.balanceOf(rewardsRecipient);
            const positions = await amoStaking.showPositions();
            expect(positions.staked).to.eq(stakedBalance);
            expect(positions.earned).to.gt(0);
            const earned = await bbaUsdTempleAuraRewardPool.earned(amoStaking.address);
            expect(earned).to.gt(0);
            expect(await amoStaking.earned()).to.eq(earned);
            const balBalancerBefore = await balToken.balanceOf(rewardsRecipient);
            await amoStaking.getReward(true);
            const auraBalanceAfter = await auraToken.balanceOf(rewardsRecipient);
            const balBalancerAfter = await balToken.balanceOf(rewardsRecipient);
            
            expect(earned).to.be.approximately(balBalancerAfter.sub(balBalancerBefore), ethers.utils.parseEther("0.001"));
            expect(auraBalanceAfter).to.gt(auraBalanceBefore);

            // when rewards receiver not set
            await amoStaking.setRewardsRecipient(ZERO_ADDRESS);
            await auraBooster.earmarkRewards(bbaUsdTempleAuraPID);
            await mineForwardSeconds(7 * 24 * 3600);
            await auraBooster.earmarkRewards(bbaUsdTempleAuraPID);
            const contractAuraBalanceBefore = await auraToken.balanceOf(amoStaking.address);
            const contractBalBalanceBefore = await balToken.balanceOf(amoStaking.address);
            await amoStaking.getReward(true);
            const contractAuraBalanceAfter = await auraToken.balanceOf(amoStaking.address);
            const contractBalBalanceAfter = await balToken.balanceOf(amoStaking.address);
            expect(contractBalBalanceAfter).gt(contractBalBalanceBefore);
            expect(contractAuraBalanceAfter).gt(contractAuraBalanceBefore);
        });

        it("deposits and stakes", async () => {
            // tested in amo tests
        });

        it("ensure aura shutdown view works as expected when the pool is shutdown", async () => {
            expect(await amoStaking.isAuraShutdown()).eq(false);
            await auraPoolManagerV3.shutdownPool(bbaUsdTempleAuraPID);
            expect(await amoStaking.isAuraShutdown()).eq(true);
        });

        it("deposits and withdrawals when Aura pool is shutdown", async () => {
            const amount = toAtto(100);

            const depositedBpt1 = BigNumber.from("199993718169269512888");
            const depositedBpt2 = BigNumber.from("199993718169284128992");
            const depositedBpt3 = BigNumber.from("199993718169297863178");
            const withdrawalAmount1 = depositedBpt2.div(2);
            const withdrawalAmount2 = depositedBpt2;

            // Deposit by adding liquidity, which gets staked in Aura
            {
                await ownerAddLiquidity(amount);
                expect(await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address)).eq(depositedBpt1);
                expect(await bptToken.balanceOf(amoStaking.address)).eq(0);
            }

            // Shutdown the pool
            await auraPoolManagerV3.shutdownPool(bbaUsdTempleAuraPID);

            // Now deposit again, this time the BPT should go into amoStaking only
            {
                await ownerAddLiquidity(amount);
                expect(await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address)).eq(depositedBpt1);
                expect(await bptToken.balanceOf(amoStaking.address)).eq(depositedBpt2);
            }           

            // Withdrawal - should come from the BPT sitting in the contract
            {
                await amoStaking.withdrawAndUnwrap(withdrawalAmount1, false, await alan.getAddress());
                // Alan gets the withdrawn BPT
                expect(await bptToken.balanceOf(await alan.getAddress())).eq(withdrawalAmount1);

                // amoStaking's BPT decreases
                expect(await bptToken.balanceOf(amoStaking.address)).eq(depositedBpt2.sub(withdrawalAmount1));

                // Staked BPT is the same
                expect(await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address)).eq(depositedBpt1);
            }

            let totalDeposited = depositedBpt1.add(depositedBpt2);
            const totalWithdrawn = withdrawalAmount1.add(withdrawalAmount2);

            // Withdrawal - should come from the BPT sitting in the contract
            {   
                await amoStaking.withdrawAndUnwrap(withdrawalAmount2, false, await alan.getAddress());
                // Alan gets the withdrawn BPT
                expect(await bptToken.balanceOf(await alan.getAddress())).eq(totalWithdrawn);

                // amoStaking's has no more BPT left
                expect(await bptToken.balanceOf(amoStaking.address)).eq(0);

                // Staked BPT decreases
                expect(await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address)).eq(totalDeposited.sub(totalWithdrawn));
            }

            totalDeposited = totalDeposited.add(depositedBpt3);

            // Withdraw all
            {   
                // Despoit some more so there's unstaked BPT in the contract
                await ownerAddLiquidity(amount);
                expect(await bptToken.balanceOf(amoStaking.address)).eq(depositedBpt3);

                // operator == RAMOS
                const ramosBalBefore = await bptToken.balanceOf(amo.address);
                await amoStaking.withdrawAllAndUnwrap(false, amo.address);
                const ramosBalAfter = await bptToken.balanceOf(amo.address);

                expect(ramosBalAfter.sub(ramosBalBefore)).eq(totalDeposited.sub(totalWithdrawn));

                // amoStaking's has no more BPT left, nor any staked
                expect(await bptToken.balanceOf(amoStaking.address)).eq(0);
                expect(await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address)).eq(0);
            }
        });
    });
});

async function calculateBptTokensToBringTemplePriceDown(
    sender: string,
    percentageAboveTpi: number // to percentage above TPI
) {
    const [, balances,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
    const templeIndexInPool = await poolHelper.templeIndexInBalancerPool();
    const stableIndexInPool = templeIndexInPool.toNumber() == 0 ? 1 : 0;
    const templeBalance = balances[templeIndexInPool.toNumber()];
    const stableBalance = balances[stableIndexInPool];

    const targetPrice = TPI_SCALED.mul(10_000 + percentageAboveTpi).div(10_000);

    // targetPrice = stableBalance / targetTempleBalance
    // targetTempleBalance = stableBalance / targetPrice
    // (existingTempleBalance + templeAmountIn) = stableBalance / targetPrice
    // templeAmountIn = (stableBalance / targetPrice) - existingTempleBalance
    let templeAmountIn = (ONE_ETH.mul(stableBalance).div(targetPrice)).sub(templeBalance);

    // randomize between 50% to 100%
    // const randomValue = Math.floor(Math.random() * (100 - 50 + 1) + 50);
    // To have repeatable tests - we fix at 75%
    const randomValue = 75; 
    templeAmountIn = BigNumber.from(randomValue).mul(templeAmountIn).div(100);

    const maxAmounts = await amo.maxRebalanceAmounts();
    if (templeAmountIn.gt(maxAmounts.temple)) {
        templeAmountIn = maxAmounts.temple;
    }

    const amountsIn: BigNumber[] = [BigNumber.from(0), BigNumber.from(0)];
    amountsIn[templeIndexInPool.toNumber()] = templeAmountIn;
    const reqData = await getAmoJoinPoolRequest(sender, amountsIn);
    const bptOut = reqData.bptOut;
    return {
        bptOut,
        poolRequest: reqData.joinPoolRequest,
        templeAmountIn: reqData.joinPoolRequest.maxAmountsIn[templeIndexInPool.toNumber()]
    }
}

async function calculateBptTokensToBringTemplePriceUp(
    percentageBelowTpi: number // to percentage below TPI
) {
    // 1-It calculates how many BPTs it'd have to single asset withdraw into TEMPLE to bring the price back to the TPI.
    // 2-RNG decides a number between 0.5 and 1
    // 3-The number from step 1 is multiplied by the RNG result
    // 4-That amount of BPTs is single asset withdrawn and the TEMPLE is burnt
    const [tokens, balances,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
    const templeIndexInPool = await poolHelper.templeIndexInBalancerPool();
    const [templeBalance, stableBalance] = templeIndexInPool.toNumber() == 0
        ? [balances[0], balances[1]]
        : [balances[1], balances[0]];
    // weights are 50/50 so ignoring the weights from math
    // lot size is amount out to get to spot price to TPI (with slippage and fees)
    // ls = Bt - (Bd / TPI(1-fee))
    const tpi = await amo.treasuryPriceIndex();
    const basisPointsBelowTpi = BigNumber.from(percentageBelowTpi).mul(tpi).div(10_000);
    const expectedSpotPriceQuote = tpi.sub(basisPointsBelowTpi);
    const BdDivTpiFee = stableBalance.mul(10_000).div(expectedSpotPriceQuote);
    const lotSize = templeBalance.sub(BdDivTpiFee).abs(); // max expected TEMPLE to withdraw
    // we don't want to fill to exactly value percentage below TPI, so we randomize between 0.5 and 1
    const randomValue = Math.floor(Math.random() * (100 - 50 + 1) + 50);
    let templeAmountOut = BigNumber.from(randomValue).mul(lotSize).div(100);
    // now use calculated amount out to query for join expected tokens out
    // get bpt amount in for exact TEMPLE out
    // BPT_IN_FOR_EXACT_TOKENS_OUT, enum 2
    // if temple amount to withdraw is above capped amount, set amount to capped amount
    const maxAmounts = await amo.maxRebalanceAmounts();
    const cappedTempleAmountPerRebalance = maxAmounts.temple;
    if (templeAmountOut.gt(cappedTempleAmountPerRebalance)) {
        templeAmountOut = cappedTempleAmountPerRebalance;
    }
    let amountsOut: BigNumber[] = [BigNumber.from(0), BigNumber.from(0)];
    amountsOut[templeIndexInPool.toNumber()] = templeAmountOut;
    
    const maxBPTAmountIn = toAtto(100_000);
    const tempUserdata = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'uint256'], [2, amountsOut, maxBPTAmountIn]);
    const exitRequest = {
        assets: tokens,
        minAmountsOut: amountsOut,
        userData: tempUserdata,
        toInternalBalance: false
    }
    let bptIn: BigNumber = BigNumber.from(0);
    [bptIn, amountsOut] = await balancerHelpers.queryExit(TEMPLE_BB_A_USD_BALANCER_POOL_ID, amo.address, amo.address, exitRequest);
    const userData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'uint256'], [2, amountsOut, bptIn]);
    exitRequest.userData = userData;
    exitRequest.minAmountsOut = amountsOut;
    
    // now call rebalance up
    // for the call to rebalanceUp, function uses EXACT_BPT_IN_FOR_ONE_TOKEN_OUT. we have both bptIn and amountsOut calculated.
    // rebalanceUp function checks for amountsOut
    return {
        exitRequest,
        bptIn,
        amountOut: amountsOut[templeIndexInPool.toNumber()]
    }
}

async function ownerDepositAndStakeBpt(
    joinAmount: BigNumber
) {
    const reqData = await getAmoJoinPoolRequest(amo.address, [joinAmount, joinAmount]);

    // No approval required for bbaUsd into the balancer vault.
    await templeToken.connect(executor).approve(balancerVault.address, joinAmount);

    await balancerVault.connect(executor).joinPool(TEMPLE_BB_A_USD_BALANCER_POOL_ID, executorAddress, amo.address, reqData.joinPoolRequest);
    await amo.depositAndStakeBptTokens(reqData.bptOut, true);
    return reqData.bptOut;
}

async function ownerAddLiquidity(
    bptAmountIn: BigNumber
) {
    const reqData = await getAmoJoinPoolRequest(amo.address, [bptAmountIn, bptAmountIn]);
    const req = reqData.joinPoolRequest;
    await amo.addLiquidity(req);
}

async function getAmoJoinPoolRequest(
    sender: string,
    maxAmountsIn: BigNumber[]
) {
    const [tokens, ,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
    return getJoinPoolRequest(tokens, balancerHelpers, sender, amo.address, maxAmountsIn);
}

async function getExitPoolRequest(
    bptAmountIn: BigNumber,
    minAmountsOut: BigNumber[],
    kind: number,
    exitTokenIndex: BigNumber
) {
    // create exit request
    const [tokens,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
    let intermediaryUserdata = "";
    // kinds accepted are EXACT_BPT_IN_FOR_TOKENS_OUT and EXACT_BPT_IN_FOR_ONE_TOKEN_OUT (and 2 others not supported in this function)
    if (kind == 0) {
        // EXACT_BPT_IN_FOR_ONE_TOKEN_OUT
        intermediaryUserdata = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [0, bptAmountIn, exitTokenIndex]);
        
    } else if (kind == 1) {
        // using proportional exit: [EXACT_BPT_IN_FOR_TOKENS_OUT, bptAmountIn]
        intermediaryUserdata = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [1, bptAmountIn]);
    } else {
        throw("Unsupported kind");
    }

    const exitRequest = {
        assets: tokens,
        minAmountsOut,
        userData: intermediaryUserdata,
        toInternalBalance: false
    }

    // bpt tokens will be in pool helper so from poolHelper to amo (as receiver of exit tokens)

    const [bptIn, amountsOut] = await balancerHelpers.queryExit(TEMPLE_BB_A_USD_BALANCER_POOL_ID, poolHelper.address, amo.address, exitRequest);
    return {
        bptIn,
        amountsOut
    }
}

async function createAuraPoolAndStakingContracts(
    signer: Signer,
    relativeWeightCap: BigNumber
) {
    // create gauge with liquidity gauge factory (0xf1665E19bc105BE4EDD3739F88315cC699cc5b65) as balancermaxi.eth 
    let tx = await liquidityGaugeFactory.create(TEMPLE_BBAUSD_LP_TOKEN, relativeWeightCap);
    let receipt = await tx.wait();
    // get deployed gauge from event
    const gaugeCreatedEventTopic = "0xaa98436d09d130af48de49867af8b723bbbebb0d737638b5fe8f1bf31bbb71c0";
    let deployedGauge = "";
    const decoder = new ethers.utils.AbiCoder();
    for(const log of receipt.logs) {
        if (log.topics[0] == gaugeCreatedEventTopic) {
            const res = decoder.decode(["address"], log.topics[1]);
            deployedGauge = res[0];
            break;
        }
    }
    // add gauge
    tx = await gaugeAdder.connect(balGaugeMultisig).addEthereumGauge(deployedGauge);
    receipt = await tx.wait();

    // now vote gauge weight, also so that we can finally addPool on aura
    // lock for veBAL position and vote gauge weight
    const unlockTime = await blockTimestamp() + 31557600; // 1 year
    const amountToLock = toAtto(10_000);
    await balWeth8020Token.approve(balancerVotingEscrow.address, amountToLock);
    await balancerVotingEscrow.create_lock(amountToLock, unlockTime);
    await balGaugeController.connect(balWeth8020Whale).vote_for_gauge_weights(deployedGauge, 10_000);

    // add pool
    tx = await auraPoolManagerV3.addPool(deployedGauge, 3);
    receipt = await tx.wait();

    const boosterLog = receipt.logs[receipt.logs.length-1];
    const decodedData = ethers.utils.defaultAbiCoder.decode(["address","address","address","address","address","uint256"], boosterLog.data);
    const depositToken = decodedData[2];
    const newRewardPool = decodedData[3];
    const stash = decodedData[4];
    const pId = decodedData[5];

    return [deployedGauge, depositToken, newRewardPool, stash, pId];

}

async function singleSideDepositStable(
    amount: BigNumber
) {
    const amountsIn: BigNumber[] = [BigNumber.from(0), amount];
    await singleSideDeposit(balancerVault, balancerHelpers, bbaUsdWhale, amountsIn);
}

async function singleSideDepositTemple(
    amount: BigNumber
) {
    const amountsIn: BigNumber[] = [amount, BigNumber.from(0)];
    await templeToken.connect(templeWhale).approve(balancerVault.address, amount);
    await singleSideDeposit(balancerVault, balancerHelpers, templeWhale, amountsIn);
}

