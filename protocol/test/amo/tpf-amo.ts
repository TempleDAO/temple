import { ethers } from "hardhat";
import { expect } from "chai";
import { toAtto, mineForwardSeconds, blockTimestamp } from "../helpers";
import { BigNumber, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import addresses from "../constants";
import { 
    resetFork,
    impersonateAddress,
    swapDaiForBbaUsd,
    seedTempleBbaUsdPool,
    singleSideDepositTempleToPriceTarget
} from "./common";
import amoAddresses from "./amo-constants";
import { 
  TpfAmo,
  TpfAmo__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  ERC20,
  ERC20__factory,
  AMO__IBalancerVault,
  AMO__IBalancerVault__factory,
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
  AMO__IBaseRewardPool,
  AMO__IBaseRewardPool__factory,
  AMO__IAuraBooster__factory,
  AMO__IAuraBooster,
  PoolHelper__factory,
  PoolHelper
} from "../../typechain";
import { DEPLOYED_CONTRACTS } from '../../scripts/deploys/helpers';

const { MULTISIG, TEMPLE } = DEPLOYED_CONTRACTS.mainnet;
const { BALANCER_VAULT } = addresses.contracts;
const { FRAX_WHALE, BINANCE_ACCOUNT_8 } = addresses.accounts;
const { FRAX } = addresses.tokens;
const { DAI } = addresses.tokens;
const { BBA_USD_TOKEN, TEMPLE_BBAUSD_LP_TOKEN, AURA_TOKEN, 
    BALANCER_TOKEN, BAL_WETH_8020_TOKEN } = amoAddresses.tokens;
const { BALANCER_POOL_ID } = amoAddresses.others;
const { BALANCER_AUTHORIZER_ADAPTER, BALANCER_HELPERS, AURA_BOOSTER , 
    AURA_LIQUIDITY_GAUGE_FACTORY, AURA_POOL_MANAGER_V3, AURA_GAUGE_CONTROLLER,
    GAUGE_ADDER, BAL_VOTING_ESCROW } = amoAddresses.contracts;
const { TEMPLE_WHALE, BBA_USD_WHALE, AURA_GAUGE_OWNER , AURA_POOL_MANAGER_OPERATOR, 
    BAL_MULTISIG, BAL_WETH_8020_WHALE, ZERO_ADDRESS } = amoAddresses.accounts;

const TPF_SCALED = 9_700;
const ONE_ETH = toAtto(1);
const BLOCKNUMBER = 15862300;

let amo: TpfAmo;
let amoStaking: AuraStaking;
let owner: Signer;
let alan: Signer;
let operator: Signer;
let templeMultisig: Signer;
let fraxWhale: Signer;
let templeWhale: Signer;
let daiWhale: Signer;
let auraMultisig: Signer;
let balGaugeMultisig: Signer;
let bbaUsdWhale: Signer;
let ownerAddress: string;
let alanAddress: string;
let operatorAddress: string;
let auraGaugeOwner: Signer;
let templeToken: TempleERC20Token;
let fraxToken: ERC20;
let daiToken: ERC20;
let bbaUsdToken: ERC20;
let bptToken: ERC20;
let balancerVault: AMO__IBalancerVault;
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
let bbaUsdTempleAuraRewardPool: AMO__IBaseRewardPool;
let bbaUsdTempleAuraPID: number;
let bbaUsdTempleAuraDepositToken: ERC20;
let bbaUsdTempleAuraStash: string;
let bbaUsdTempleAuraGauge: string;
let auraBooster: AMO__IAuraBooster;
let auraToken: ERC20;
let balToken: ERC20;
let poolHelper: PoolHelper;

describe.only("Temple Price Floor AMO", async () => {
    
    beforeEach( async () => {
        await resetFork(BLOCKNUMBER);
        [owner, alan, operator] = await ethers.getSigners();
        templeMultisig = await impersonateAddress(MULTISIG);
        templeWhale = await impersonateAddress(TEMPLE_WHALE);
        fraxWhale = await impersonateAddress(FRAX_WHALE);
        daiWhale = await impersonateAddress(BINANCE_ACCOUNT_8);
        bbaUsdWhale = await impersonateAddress(BBA_USD_WHALE);
        auraGaugeOwner = await impersonateAddress(AURA_GAUGE_OWNER);
        auraMultisig = await impersonateAddress(AURA_POOL_MANAGER_OPERATOR);
        balGaugeMultisig = await impersonateAddress(BAL_MULTISIG); 
        balWeth8020Whale = await impersonateAddress(BAL_WETH_8020_WHALE);
    
        ownerAddress = await owner.getAddress();
        alanAddress = await alan.getAddress();
        operatorAddress = await operator.getAddress();

        templeToken = TempleERC20Token__factory.connect(TEMPLE, templeWhale);
        fraxToken = ERC20__factory.connect(FRAX, fraxWhale);
        daiToken = ERC20__factory.connect(DAI, daiWhale);
        bptToken = ERC20__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, owner);
        bbaUsdToken = ERC20__factory.connect(BBA_USD_TOKEN, bbaUsdWhale);
        balWeth8020Token = ERC20__factory.connect(BAL_WETH_8020_TOKEN, balWeth8020Whale);
        auraToken = ERC20__factory.connect(AURA_TOKEN, owner);
        balToken = ERC20__factory.connect(BALANCER_TOKEN, owner);

        balancerVault = AMO__IBalancerVault__factory.connect(BALANCER_VAULT, owner);
        balancerHelpers = IBalancerHelpers__factory.connect(BALANCER_HELPERS, owner);
        weightedPool2Tokens = IWeightPool2Tokens__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, owner);
        liquidityGaugeFactory = AMO__ILiquidityGaugeFactory__factory.connect(AURA_LIQUIDITY_GAUGE_FACTORY, auraGaugeOwner);
        auraPoolManagerProxy = AMO__IPoolManagerProxy__factory.connect(AURA_POOL_MANAGER_V3, auraMultisig);
        auraPoolManagerV3 = AMO__IPoolManagerV3__factory.connect(AURA_POOL_MANAGER_V3, auraMultisig);
        balGaugeController = AMO__IAuraGaugeController__factory.connect(AURA_GAUGE_CONTROLLER, balGaugeMultisig);
        authorizerAdapter = AMO__IBalancerAuthorizerAdapter__factory.connect(BALANCER_AUTHORIZER_ADAPTER, balGaugeMultisig);
        gaugeAdder = AMO__IGaugeAdder__factory.connect(GAUGE_ADDER, balGaugeMultisig);
        balancerVotingEscrow = AMO__IBalancerVotingEscrow__factory.connect(BAL_VOTING_ESCROW, balWeth8020Whale);
        auraBooster = AMO__IAuraBooster__factory.connect(AURA_BOOSTER, owner);

        // transfer temple for pool seeding
        const templeMultisigConnect = templeToken.connect(templeMultisig);
        await templeMultisigConnect.transfer(await templeWhale.getAddress(), toAtto(2_000_000));
        await templeMultisigConnect.transfer(ownerAddress, toAtto(2_000_000));

        // seed balancer pool
        await swapDaiForBbaUsd(balancerVault, daiToken, daiWhale, toAtto(2_000_000), ownerAddress);
        await seedTempleBbaUsdPool(bbaUsdToken, templeToken, bptToken, balancerVault, balancerHelpers, owner, toAtto(1_000_000), ownerAddress);
        
        await owner.sendTransaction({value: ONE_ETH, to: BAL_MULTISIG });
        await owner.sendTransaction({value: ONE_ETH, to: await auraMultisig.getAddress()});

        // create gauge and add pool on Aura
        let token, rewards: string;
        [bbaUsdTempleAuraGauge, token, rewards, bbaUsdTempleAuraStash, bbaUsdTempleAuraPID] = await createAuraPoolAndStakingContracts(auraGaugeOwner, BigNumber.from("20000000000000000"));
        bbaUsdTempleAuraDepositToken = ERC20__factory.connect(token, owner);
        bbaUsdTempleAuraRewardPool = AMO__IBaseRewardPool__factory.connect(rewards, owner);

        amoStaking = await new AuraStaking__factory(owner).deploy(
            ownerAddress,
            TEMPLE_BBAUSD_LP_TOKEN,
            AURA_BOOSTER,
            bbaUsdTempleAuraDepositToken.address,
            [BALANCER_TOKEN, AURA_TOKEN]
        );
    
        amo = await new TpfAmo__factory(owner).deploy(
            BALANCER_VAULT,
            TEMPLE,
            BBA_USD_TOKEN,
            TEMPLE_BBAUSD_LP_TOKEN,
            amoStaking.address,
            AURA_BOOSTER,
            0,
            BALANCER_POOL_ID
        );

        poolHelper = await new PoolHelper__factory(owner).deploy(
            BALANCER_VAULT,
            TEMPLE,
            BBA_USD_TOKEN,
            bptToken.address,
            amo.address,
            BALANCER_POOL_ID
        );
        
        await amo.setPoolHelper(poolHelper.address);
        await amoStaking.setOperator(amo.address);
        await bbaUsdToken.connect(owner).transfer(amo.address, toAtto(500_000));
        await templeMultisigConnect.addMinter(amo.address);

        // set params
        await amoStaking.setAuraPoolInfo(bbaUsdTempleAuraPID, bbaUsdTempleAuraDepositToken.address, bbaUsdTempleAuraRewardPool.address);
        await amo.setOperator(ownerAddress);
        await amo.setCoolDown(1800); // 30 mins
        await amo.setTemplePriceFloorNumerator(9700);
        await amo.setRebalancePercentageBounds(200, 500);
        const maxAmounts = {
            bpt: BigNumber.from(ONE_ETH).mul(10),
            temple: BigNumber.from(ONE_ETH).mul(10),
            stable: BigNumber.from(ONE_ETH).mul(10)
        }
        await amo.setMaxRebalanceAmounts(maxAmounts.bpt, maxAmounts.stable, maxAmounts.temple);
        await amo.setPostRebalanceSlippage(200); // 2% max price movement
        await templeToken.transfer(MULTISIG, ethers.utils.parseEther("100"));
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
            const connectPoolHelper = poolHelper.connect(alan);
            await expect(connectAMO.setOperator(alanAddress)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.setCoolDown(1800)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.setTemplePriceFloorNumerator(9700)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.setPoolHelper(alanAddress)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.setTemplePriceFloorNumerator(1_000)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.setRebalancePercentageBounds(100,100)).to.be.revertedWith("Ownable: caller is not the owner");
            const cappedAmounts = {
                temple: BigNumber.from(ONE_ETH).mul(10),
                bpt: BigNumber.from(ONE_ETH).mul(10),
                stable: BigNumber.from(ONE_ETH).mul(10)
            }
            await expect(connectAMO.setMaxRebalanceAmounts(100, 100, 100)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.setPostRebalanceSlippage(100)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.pause()).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.unpause()).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.recoverToken(TEMPLE , alanAddress, 100)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.rebalanceDown(ONE_ETH, 1)).to.be.revertedWithCustomError(amo, "NotOperatorOrOwner");
            await expect(connectAMO.rebalanceUp(ONE_ETH, 1)).to.be.revertedWithCustomError(amo, "NotOperatorOrOwner");
            await expect(connectAMO.depositStable(100, 1)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.withdrawStable(100, 1)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.addLiquidity(joinPoolRequest, 1)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.removeLiquidity(exitPoolRequest, 100)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(connectAMO.depositAndStakeBptTokens(100, true)).to.be.revertedWith("Ownable: caller is not the owner");

            // passes
            await amo.setMaxRebalanceAmounts(100, 100, 100);
            await amo.setPostRebalanceSlippage(100);
            await amo.pause();
            await amo.unpause();
            await amo.setOperator(ownerAddress);
            await amo.setCoolDown(1800);
            await amo.setTemplePriceFloorNumerator(9700);
        });

        it("sets operator", async () => {
            await expect(amo.setOperator(operatorAddress))
                .to.emit(amo, "SetOperator").withArgs(operatorAddress);
            expect(await amo.operator()).to.eq(operatorAddress);
        });

        it("sets pool helper", async () => {
            await expect(amo.setPoolHelper(poolHelper.address))
                .to.emit(amo, "SetPoolHelper")
                .withArgs(poolHelper.address);
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
            await amo.setRebalancePercentageBounds(100, 400);
            expect(await amo.rebalancePercentageBoundLow()).to.eq(100);
            expect(await amo.rebalancePercentageBoundUp()).to.eq(400);
        });
    
        it ("sets tpf numerator", async () => {
            await expect(amo.setTemplePriceFloorNumerator(TPF_SCALED))
                .to.emit(amo, "SetTemplePriceFloorNumerator")
                .withArgs(TPF_SCALED);
            const tpf =  await amo.templePriceFloorNumerator();
            expect(tpf).to.eq(TPF_SCALED);
        });

        it("sets cooldown", async () => {
            const secs = 1800;
            await expect(amo.setCoolDown(secs))
                .to.emit(amo, "SetCooldown").withArgs(secs);
        });

        it("pause/unpause", async () => {
            await expect(amo.pause()).to.emit(amo, "Paused").withArgs(ownerAddress);
            mineForwardSeconds(10_000);
            await expect(amo.rebalanceDown(100, 1)).to.be.revertedWith("Pausable: paused");

            // unpause
            await expect(amo.unpause()).to.emit(amo, "Unpaused").withArgs(ownerAddress);
            amo.rebalanceDown(ONE_ETH, 1);
        });

        it("sets max rebalance amounts", async () => {
            const maxAmounts = {
                bpt: toAtto(1_000),
                stable: toAtto(2_000),
                temple: toAtto(3_000),
            }
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
            const balBefore = await bbaUsdToken.balanceOf(ownerAddress);
            // recover token
            const checksummedAddress = ethers.utils.getAddress(bbaUsdToken.address);
            await expect(amo.recoverToken(bbaUsdToken.address, ownerAddress, amount))
                .to.emit(amo, "RecoveredToken")
                .withArgs(checksummedAddress, ownerAddress, amount);
            
            expect(await bbaUsdToken.balanceOf(ownerAddress)).eq(balBefore.add(amount));
        });
    });

    describe("Liquidity Add/Remove", async () => {

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
            [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, amo.address, amo.address, joinPoolRequest);

            const bptAmountBefore = await bptToken.balanceOf(amoStaking.address);
            expect(bptAmountBefore).to.eq(0);
            const stakedBalanceBefore = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);

            // fails
            let failRequest = {
                assets: tokens,
                maxAmountsIn,
                userData,
                fromInternalBalance: true
            }
            await expect(amo.addLiquidity(failRequest, bptOut)).to.be.revertedWithCustomError(amo, "InvalidBalancerVaultRequest");
            failRequest.fromInternalBalance = false;
            await expect(amo.addLiquidity(failRequest, bptOut.add(1))).to.be.revertedWithCustomError(amo, "InsufficientAmountOutPostcall");
            await expect(amo.addLiquidity(joinPoolRequest, bptOut))
                .to.emit(templeToken, "Transfer").withArgs(ZERO_ADDRESS, amo.address, amountsIn[0])
                .to.emit(auraBooster, "Deposited").withArgs(amoStaking.address, bbaUsdTempleAuraPID, bptOut);

            const bptAmountAfter = await bptToken.balanceOf(amoStaking.address);
            const stakedBalanceAfter = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            expect(bptAmountAfter).to.eq(0); // because bpt tokens have been staked
            expect(stakedBalanceAfter).to.eq(stakedBalanceBefore.add(bptOut));
            expect(await templeToken.balanceOf(amo.address)).to.eq(0);
            expect(await bptToken.balanceOf(amo.address)).to.eq(0);
        });

        it("removes liquidity EXACT BPT IN for tokens out", async () => {
            // add liquidity to get some staked position
            const bptAmountIn = toAtto(100);
            await ownerAddLiquidity(bptAmountIn);

            // create exit request
            let tokens: string[];
            let balances: BigNumber[];
            let minAmountsOut = [toAtto(10_000), toAtto(10_000)];

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

            // fail invalid request
            exitRequest.toInternalBalance = true;
            await expect(amo.removeLiquidity(exitRequest, bptAmountIn)).to.be.revertedWithCustomError(amo, "InvalidBalancerVaultRequest");
            exitRequest.toInternalBalance = false;

            exitRequest.minAmountsOut = amountsOut;
            exitRequest.userData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [1, bptAmountIn]);
            const stableBefore = await bbaUsdToken.balanceOf(amo.address);
            
            expect(await amo.removeLiquidity(exitRequest, bptIn))
                .to.emit(templeToken, "Transfer").withArgs(amoStaking.address, ZERO_ADDRESS, amountsOut[0])
                .to.emit(bbaUsdTempleAuraRewardPool, "Withdrawn").withArgs(amoStaking.address, bbaUsdTempleAuraPID, bptIn);
            
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
            const stableAfter = await bbaUsdToken.balanceOf(amo.address);
            expect(stableAfter).to.gte(stableBefore.add(expectedStable));
            expect(templeAfter).to.eq(0);
        });

        it("deposits stable", async () => {
            // fail checks
            const maxAmounts = await amo.maxRebalanceAmounts();
            await expect(amo.depositStable(100, 0)).to.be.revertedWithCustomError(amo, "ZeroSwapLimit");
            await expect(amo.depositStable(maxAmounts.stable.add(1), 1)).to.be.revertedWithCustomError(amo, "AboveCappedAmount");
            // skew price to above TPF to trigger no rebalance
            // single-side deposit stable token
            await singleSideDepositStable(bbaUsdToken, toAtto(10_000));
            await expect(amo.depositStable(ONE_ETH, 1)).to.be.revertedWithCustomError(poolHelper, "NoRebalanceUp");

            // single-side withdraw stable to skew price below TPF
            await singleSideDepositTemple(templeToken, toAtto(400_000));

            // increase capped amount
            const amountIn = toAtto(10_000);

            await amo.setMaxRebalanceAmounts(amountIn, amountIn, amountIn);

            const currentSpotPriceScaled = await getSpotPriceScaled();
            expect(currentSpotPriceScaled).lt(TPF_SCALED);

            const reqData = await getJoinPoolRequest(amo.address, [BigNumber.from(0), amountIn]);
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
            
            // skew price below TPF
            await singleSideDepositTemple(templeToken, toAtto(50_000));
            await amo.setTemplePriceFloorNumerator(9_700);
            await expect(amo.withdrawStable(ONE_ETH, 1)).to.be.revertedWithCustomError(poolHelper, "NoRebalanceDown");

            // skew price above TPF
            await singleSideDepositStable(bbaUsdToken, toAtto(100_000));
            // // add liquidity to get some staked position
            await ownerAddLiquidity(toAtto(10_000));
            const amountOut = toAtto(1_000);
            let minAmountsOut = [BigNumber.from(0), amountOut];
            const bptAmountIn = toAtto(100);
            const reqData = await getExitPoolRequest(bptAmountIn, minAmountsOut, 0, BigNumber.from(1));
            const amountsOut = reqData.amountsOut;
            const exitTokenAmountOut = BigNumber.from(amountsOut[1]);
            const bptIn = reqData.bptIn;
            await amo.setMaxRebalanceAmounts(bptIn, bptIn, bptIn);

            const stableBalanceBefore = await bbaUsdToken.balanceOf(amo.address);
            const stakedBalanceBefore = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address)
            await expect(amo.withdrawStable(bptIn, exitTokenAmountOut))
                .to.emit(amo, "WithdrawStable").withArgs(bptIn, exitTokenAmountOut)
                .to.emit(auraBooster, "Withdrawn").withArgs(amoStaking.address, bbaUsdTempleAuraPID, bptIn);
            const stableBalanceAfter = await bbaUsdToken.balanceOf(amo.address);
            expect(stableBalanceAfter).to.gte(stableBalanceBefore.add(exitTokenAmountOut));
            expect(await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address)).to.eq(stakedBalanceBefore.sub(bptIn));
        });

        it("directly stakes bpt tokens", async () => {
            const joinAmount = toAtto(20_000);
            const reqData = await getJoinPoolRequest(amo.address, [joinAmount, joinAmount]);
            await templeToken.connect(owner).approve(balancerVault.address, joinAmount);
            await bbaUsdToken.connect(owner).approve(balancerVault.address, joinAmount);

            await balancerVault.connect(owner).joinPool(BALANCER_POOL_ID, ownerAddress, ownerAddress, reqData.joinPoolRequest);
            const amount = reqData.bptOut;

            await bptToken.connect(owner).approve(amo.address, amount);
            const balBefore = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            await amo.depositAndStakeBptTokens(amount, false);
            const balAfter = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            
            expect(balAfter).to.eq(balBefore.add(amount));

            // deposit and stake using contract balance
            const amoBptBalance = await bptToken.balanceOf(amo.address);
            await templeToken.connect(owner).approve(balancerVault.address, joinAmount);
            await bbaUsdToken.connect(owner).approve(balancerVault.address, joinAmount);
            // get bpt tokens and send to amo
            await balancerVault.connect(owner).joinPool(BALANCER_POOL_ID, ownerAddress, amo.address, reqData.joinPoolRequest);
            const amoBptBalanceAfter = await bptToken.balanceOf(amo.address)
            expect(amoBptBalanceAfter).to.gt(amoBptBalance);
            await amo.depositAndStakeBptTokens(amoBptBalanceAfter, true);
        });

        it("rebalances up", async () => {
            await amo.setCoolDown(3_600);
            // fails
            await expect(amo.rebalanceUp(0, 0)).to.be.revertedWithCustomError(amo, "ZeroSwapLimit");
            await expect(amo.rebalanceUp(toAtto(1_000), 1)).to.be.revertedWithCustomError(amo, "AboveCappedAmount");
            await amo.pause();
            await expect(amo.rebalanceUp(1, 1)).to.be.revertedWith("Pausable: paused");
            await amo.unpause();
           
            // add liquidity on-sided to skew price above TPF
            await singleSideDepositStable(bbaUsdToken, toAtto(40_000));
            let spotPriceScaled = await poolHelper.getSpotPriceScaled();
            expect(spotPriceScaled).to.gt(TPF_SCALED);
            // directly stake bpt tokens
            const bptOut = await ownerDepositAndStakeBpt(toAtto(10_000));
        
            await amo.setMaxRebalanceAmounts(bptOut, bptOut, bptOut);
            // amount in is greater than last rebalanceAmount so expect revert
            await expect(amo.rebalanceUp(bptOut, 1)).to.be.reverted;

            await expect(amo.rebalanceUp(bptOut, 1)).to.be.revertedWithCustomError(poolHelper, "NoRebalanceUp");

            await amo.setPostRebalanceSlippage(400); // 4%
            
            // now single side deposit TEMPLE to bring spot price down if up
            const spotPriceNow = await getSpotPriceScaled();
            const discountBelowTPF = 200; // 2% below TPF
            if (spotPriceNow.gt(TPF_SCALED - discountBelowTPF)) {
                await singleSideDepositTemple(templeToken, toAtto(100_000));
            }

            // stake some more to have enough bpt to unwrap
            await ownerDepositAndStakeBpt(toAtto(20_000));

            // calculate amount of TEMPLE out to take spot quote price close to TPF by a slight percentage below TPF
            const data = await calculateBptTokensToBringTemplePriceUp(discountBelowTPF); // 2% below TPF
            const bptIn = data.bptIn;
            const maxAmounts = await amo.maxRebalanceAmounts();
            const cappedBptAmountPerRebalance = maxAmounts.bpt;
            if (cappedBptAmountPerRebalance.lt(bptIn)) {
                await amo.setMaxRebalanceAmounts(bptIn, bptIn, bptIn);
            }
            const templeAmountOut = data.amountOut;
            await expect(amo.rebalanceUp(bptIn, templeAmountOut))
                .to.emit(amo, "RebalanceUp")
                //.withArgs(bptIn, templeAmountOut);

            // no rebalance up
            const rebalanceBoundUp = await amo.rebalancePercentageBoundUp();
            const tpfNumerator = await amo.templePriceFloorNumerator();
            await expect(amo.rebalanceUp(1, 1)).to.be.revertedWithCustomError(poolHelper, "NoRebalanceUp");
            expect(await poolHelper["isSpotPriceAboveTPF(uint256)"](tpfNumerator)).to.be.false;
            expect(await poolHelper.isSpotPriceAboveTPFUpperBound(rebalanceBoundUp, tpfNumerator)).to.be.false;
        });

        it("rebalances down", async () => {
            // fails
            await expect(amo.rebalanceDown(0, 0)).to.be.revertedWithCustomError(amo, "ZeroSwapLimit");
            await expect(amo.rebalanceDown(toAtto(1_000), 1)).to.be.revertedWithCustomError(amo, "AboveCappedAmount");
            await amo.pause();
            await expect(amo.rebalanceDown(1, 1)).to.be.revertedWith("Pausable: paused");
            await amo.unpause();
            await getSpotPriceScaled();
            // add single-side liquidity to skew price below tpf
            await singleSideDepositTempleToPriceTarget(
                balancerVault,
                balancerHelpers,
                templeWhale,
                await poolHelper.getSpotPriceScaled(),
                (await poolHelper.templeIndexInBalancerPool()).toNumber(),
                templeToken,
                bbaUsdToken,
                9_500
            );
            const maxAmount = toAtto(200_000);
            await amo.setMaxRebalanceAmounts(maxAmount, maxAmount, maxAmount);
            await expect(amo.rebalanceDown(toAtto(200_000), 1)).to.be.revertedWithCustomError(poolHelper, "NoRebalanceDown");
            // add single-side stable to skew price above tpf
            await singleSideDepositStable(bbaUsdToken, toAtto(150_000));
            await getSpotPriceScaled();

            // stake some bpt to have enough bpt to unwrap
            const bptOut = await ownerDepositAndStakeBpt(toAtto(30_000));
            // make sure to meet the capped amount
            await amo.setMaxRebalanceAmounts(bptOut, bptOut, bptOut);

            // rebalance down
            const reqData = await calculateBptTokensToBringTemplePriceDown(poolHelper.address, 400);

            await amo.rebalanceDown(reqData.templeAmountIn, 1);

            const newMaxAmount = toAtto(1_000_000);
            await amo.setMaxRebalanceAmounts(newMaxAmount, newMaxAmount, newMaxAmount);
            await expect(amo.rebalanceDown(toAtto(1_000_000), 1)).to.be.revertedWithCustomError(poolHelper, "HighSlippage");
            // test cool down
            await time.increase((await amo.cooldownSecs()).sub(1));
            await expect(amo.rebalanceDown(toAtto(10_000), 1)).to.be.revertedWithCustomError(amo, "NotEnoughCooldown");
        });
    });

    describe("Aura Staking", async () => {

        it("admin tests", async () => {
            // fails
            const stakingConnect = amoStaking.connect(alan);
            await expect(stakingConnect.setOperator(alanAddress)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(stakingConnect.setAuraPoolInfo(100, bptToken.address, bptToken.address)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(stakingConnect.recoverToken(bptToken.address, alanAddress, 100)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(stakingConnect.withdrawAllAndUnwrap(true, true)).to.be.revertedWith("Ownable: caller is not the owner");

            // passes
            await amoStaking.setOperator(alanAddress);
            await amoStaking.setAuraPoolInfo(100, bptToken.address, bptToken.address);
        });

        it("recovers token", async () => {
            const amount = 1000;
            await bbaUsdToken.transfer(amoStaking.address, amount);
            const ownerBalanceBefore = await bbaUsdToken.balanceOf(ownerAddress);

            // recover token
            const checksummedAddress = ethers.utils.getAddress(bbaUsdToken.address);
            await expect(amoStaking.recoverToken(bbaUsdToken.address, ownerAddress, amount))
                .to.emit(amoStaking, "RecoveredToken")
                .withArgs(checksummedAddress, ownerAddress, amount);
            const ownerBalanceAfter = await bbaUsdToken.balanceOf(ownerAddress);
            expect(await bbaUsdToken.balanceOf(amoStaking.address)).eq(0);
            expect(ownerBalanceAfter).to.eq(ownerBalanceBefore.add(amount));
        });

        it("sets operator", async () => {
            await expect(amoStaking.setOperator(operatorAddress))
                .to.emit(amoStaking, "SetOperator").withArgs(operatorAddress);
            expect(await amoStaking.operator()).to.eq(operatorAddress);
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
            let balance = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            // admin withdraws
            expect(await bptToken.balanceOf(amoStaking.address)).to.eq(0);
            await amoStaking.withdrawAndUnwrap(balance, true, ZERO_ADDRESS);
            expect(await bptToken.balanceOf(amoStaking.address)).to.eq(balance);

            let amoBalanceBefore = await bptToken.balanceOf(amo.address);
            await ownerAddLiquidity(amount);
            const toWithdraw = balance.div(2);
            await amoStaking.withdrawAndUnwrap(toWithdraw, true, amo.address);
            let amoBalanceAfter = await bptToken.balanceOf(amo.address);
            expect(amoBalanceAfter).to.eq(amoBalanceBefore.add(toWithdraw));
            amoBalanceBefore = await bptToken.balanceOf(amo.address);

            await ownerAddLiquidity(amount);
            balance = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            await amoStaking.withdrawAllAndUnwrap(true, true);
            amoBalanceAfter = await bptToken.balanceOf(amo.address);
            expect(amoBalanceAfter).to.eq(amoBalanceBefore.add(balance));
        });

        it("helper functions", async () => {
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
            const earned = await bbaUsdTempleAuraRewardPool.earned(amoStaking.address);
            const auraBalanceBefore = await auraToken.balanceOf(amoStaking.address);
            const positions = await amoStaking.showPositions();
            expect(positions.staked).to.eq(stakedBalance);
            expect(positions.earned).to.gt(0);
            expect(earned).to.gt(0);
            expect(await amoStaking.earned()).to.eq(earned);
            await amoStaking.getReward(true);
            const auraBalanceAfter = await auraToken.balanceOf(amoStaking.address);
            const balBalancer = await balToken.balanceOf(amoStaking.address);
            
            expect(earned).to.be.closeTo(balBalancer, ethers.utils.parseEther("0.001"));
            expect(auraBalanceAfter).to.gt(auraBalanceBefore);
        });

        it("deposits and stakes", async () => {
            // tested in amo tests
        });
    });
});

async function calculateBptTokensToBringTemplePriceDown(
    sender: string,
    percentageAboveTPF: number // to percentage above TPF
) {
    let balances: BigNumber[];
    let tokens: string[];
    [tokens, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    const templeIndexInPool = await poolHelper.templeIndexInBalancerPool();
    const stableIndexInPool = templeIndexInPool.toNumber() == 0 ? 1 : 0;
    const templeBalance = balances[templeIndexInPool.toNumber()];
    const stableBalance = balances[stableIndexInPool];

    const tpf = BigNumber.from(TPF_SCALED);
    const basisPointsAboveTPF = BigNumber.from(percentageAboveTPF).mul(tpf).div(10_000);
    const expectedSpotPriceQuote = tpf.add(basisPointsAboveTPF);
    // get temple amount to send to pool
    let templeAmountIn = expectedSpotPriceQuote.mul(stableBalance).div(templeBalance).mul(ONE_ETH);
    // randomize between 50% to 100%
    const randomValue = Math.floor(Math.random() * (100 - 50 + 1) + 50);
    templeAmountIn = BigNumber.from(randomValue).mul(templeAmountIn).div(100);
    const maxAmounts = await amo.maxRebalanceAmounts();
    if (templeAmountIn.gt(maxAmounts.temple)) {
        templeAmountIn = maxAmounts.temple;
    }
    let amountsIn: BigNumber[] = [BigNumber.from(0), BigNumber.from(0)];
    amountsIn[templeIndexInPool.toNumber()] = templeAmountIn;
    const reqData = await getJoinPoolRequest(sender, amountsIn);
    const bptOut = reqData.bptOut;
    return {
        bptOut,
        poolRequest: reqData.joinPoolRequest,
        templeAmountIn: reqData.joinPoolRequest.maxAmountsIn[templeIndexInPool.toNumber()]
    }
}

async function calculateBptTokensToBringTemplePriceUp(
    percentageBelowTPF: number // to percentage below TPF
) {
    // 1-It calculates how many BPTs it'd have to single asset withdraw into TEMPLE to bring the price back to the TPF.
    // 2-RNG decides a number between 0.5 and 1
    // 3-The number from step 1 is multiplied by the RNG result
    // 4-That amount of BPTs is single asset withdrawn and the TEMPLE is burnt
    let balances: BigNumber[];
    let tokens: string[];
    [tokens, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    const templeIndexInPool = await poolHelper.templeIndexInBalancerPool();
    let templeBalance: BigNumber;
    let stableBalance: BigNumber;
    if (templeIndexInPool.toNumber() == 0) {
        templeBalance = balances[0];
        stableBalance = balances[1];
    } else {
        templeBalance = balances[1];
        stableBalance = balances[0];
    }
    // weights are 50/50 so ignoring the weights from math
    // lot size is amount out to get to spot price to TPF (with slippage and fees)
    // ls = Bt - (Bd / tpf(1-fee))
    const tpf = await amo.templePriceFloorNumerator();
    const basisPointsBelowTPF = BigNumber.from(percentageBelowTPF).mul(tpf).div(10_000);
    const expectedSpotPriceQuote = tpf.sub(basisPointsBelowTPF);
    const BdDivTpfFee = stableBalance.mul(1_000).div(expectedSpotPriceQuote.mul(995));
    const lotSize = templeBalance.sub(BdDivTpfFee); // max expected TEMPLE to withdraw
    // we don't want to fill to exactly value percentage below TPF, so we randomize between 0.5 and 1
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
    let exitRequest = {
        assets: tokens,
        minAmountsOut: amountsOut,
        userData: tempUserdata,
        toInternalBalance: false
    }
    let bptIn: BigNumber;
    [bptIn, amountsOut] = await balancerHelpers.callStatic.queryExit(BALANCER_POOL_ID, amo.address, amo.address, exitRequest);
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
    const reqData = await getJoinPoolRequest(amo.address, [joinAmount, joinAmount]);
    await templeToken.connect(owner).approve(balancerVault.address, joinAmount);
    await bbaUsdToken.connect(owner).approve(balancerVault.address, joinAmount);

    await balancerVault.connect(owner).joinPool(BALANCER_POOL_ID, ownerAddress, amo.address, reqData.joinPoolRequest);
    await amo.depositAndStakeBptTokens(reqData.bptOut, true);
    return reqData.bptOut;
}

async function ownerAddLiquidity(
    bptAmountIn: BigNumber
) {
    const reqData = await getJoinPoolRequest(amo.address, [bptAmountIn, bptAmountIn]);
    const bptOut = reqData.bptOut;
    const req = reqData.joinPoolRequest;
    await amo.addLiquidity(req, bptOut);
}

async function getJoinPoolRequest(
    sender: string,
    maxAmountsIn: BigNumber[]
) {
    let tokens: string[];
    let balances: BigNumber[];
    [tokens, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    const userData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]", "uint256"], [1, maxAmountsIn, 1]);
    let joinPoolRequest = {
        assets: tokens,
        maxAmountsIn,
        userData,
        fromInternalBalance: false
    }
    let bptOut: BigNumber;
    let amountsIn: BigNumber[];
    [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, sender, amo.address, joinPoolRequest);
    joinPoolRequest.maxAmountsIn = amountsIn;
    return {
        joinPoolRequest,
        bptOut
    };
}

async function getExitPoolRequest(
    bptAmountIn: BigNumber,
    minAmountsOut: BigNumber[],
    kind: number,
    exitTokenIndex: BigNumber
) {
    // create exit request
    let tokens: string[];
    let balances: BigNumber[];
    [tokens, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    let intermediaryUserdata: string = "";
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

    let exitRequest = {
        assets: tokens,
        minAmountsOut,
        userData: intermediaryUserdata,
        toInternalBalance: false
    }
    let bptIn: BigNumber;
    let amountsOut: BigNumber[];
    // bpt tokens will be in pool helper so from poolHelper to amo (as receiver of exit tokens)

    [bptIn, amountsOut] = await balancerHelpers.callStatic.queryExit(BALANCER_POOL_ID, poolHelper.address, amo.address, exitRequest);
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
    let deployedGauge: string = "";
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

async function getSpotPriceScaled() {
    let balances: BigNumber[];
    const precision = BigNumber.from(10_000);
    [, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    const normWeights = await weightedPool2Tokens.getNormalizedWeights();
    // multiply by precision to avoid rounding down
    const currentSpotPrice = precision.mul(balances[1]).div(normWeights[1]).div(balances[0].div(normWeights[0]));
    return currentSpotPrice;
}

async function singleSideDepositStable(
    stableToken: ERC20,
    amount: BigNumber
) {
    const whaleAddress = await bbaUsdWhale.getAddress();
    let assets: string[];
    [assets,,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    await stableToken.connect(bbaUsdWhale).approve(balancerVault.address, amount);
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
    const request = {
        assets: assets,
        maxAmountsIn: amountsIn, //[0, amount],
        userData: userdata,
        fromInternalBalance: false
    }
    await balancerVault.connect(bbaUsdWhale).joinPool(BALANCER_POOL_ID, whaleAddress, whaleAddress, request);
}

async function singleSideDepositTemple(
    templeToken: TempleERC20Token,
    amount: BigNumber
) {
    const whaleAddress = await templeWhale.getAddress();
    const assets = [TEMPLE, BBA_USD_TOKEN];
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
    const request = {
        assets: assets,
        maxAmountsIn: amountsIn,
        userData: userdata,
        fromInternalBalance: false
    }
    await balancerVault.connect(templeWhale).joinPool(BALANCER_POOL_ID, whaleAddress, whaleAddress, request);
}

