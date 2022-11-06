import { ethers, network } from "hardhat";
import { expect, should } from "chai";
import { toAtto, shouldThrow, mineForwardSeconds, blockTimestamp } from "../helpers";
import { BigNumber, Contract, ContractReceipt, Signer } from "ethers";
import addresses from "../constants";
import { 
    resetFork,
    impersonateAddress,
    expectedEventsWithValues,
    swapDaiForBbaUsd,
    seedTempleBbaUsdPool
} from "./common";
import amoAddresses from "./amo-constants";
import { 
  TPFAMO,
  TPFAMO__factory,
  IERC20__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  IERC20,
  AMOIBalancerVault,
  AMOIBalancerVault__factory,
  IBalancerHelpers,
  IBalancerHelpers__factory,
  AuraStaking__factory,
  AuraStaking,
  ITempleERC20Token,
  AMOILiquidityGaugeFactory,
  AMOILiquidityGaugeFactory__factory,
  IWeightPool2Tokens,
  IWeightPool2Tokens__factory,
  AMOIPoolManagerProxy,
  AMOIPoolManagerProxy__factory,
  AMOIPoolManagerV3,
  AMOIPoolManagerV3__factory,
  AMOIAuraGaugeController__factory,
  AMOIAuraGaugeController,
  AMOIBalancerAuthorizerAdapter__factory,
  AMOIBalancerAuthorizerAdapter,
  AMOIGaugeAdder,
  AMOIGaugeAdder__factory,
  AMOIBalancerVotingEscrow__factory,
  AMOIBalancerVotingEscrow,
  IBaseRewardPool,
  IBaseRewardPool__factory,
  IAuraBooster__factory,
  IAuraBooster,
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

let amo: TPFAMO;
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
let fraxToken: IERC20;
let daiToken: IERC20;
let bbaUsdToken: IERC20;
let bptToken: IERC20;
let balancerVault: AMOIBalancerVault;
let balancerHelpers: IBalancerHelpers;
let weightedPool2Tokens: IWeightPool2Tokens;
let liquidityGaugeFactory: AMOILiquidityGaugeFactory;
let auraPoolManagerProxy: AMOIPoolManagerProxy;
let auraPoolManagerV3: AMOIPoolManagerV3;
let balGaugeController: AMOIAuraGaugeController;
let authorizerAdapter: AMOIBalancerAuthorizerAdapter;
let gaugeAdder: AMOIGaugeAdder;
let balWeth8020Whale: Signer;
let balWeth8020Token: IERC20;
let balancerVotingEscrow: AMOIBalancerVotingEscrow;
let bbaUsdTempleAuraRewardPool: IBaseRewardPool;
let bbaUsdTempleAuraPID: number;
let bbaUsdTempleAuraDepositToken: IERC20;
let bbaUsdTempleAuraStash: string;
let bbaUsdTempleAuraGauge: string;
let auraBooster: IAuraBooster;
let auraToken: IERC20;
let balToken: IERC20;
let poolHelper: PoolHelper;

describe("Temple Price Floor AMO", async () => {
    
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
        fraxToken = IERC20__factory.connect(FRAX, fraxWhale);
        daiToken = IERC20__factory.connect(DAI, daiWhale);
        bptToken = IERC20__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, owner);
        bbaUsdToken = IERC20__factory.connect(BBA_USD_TOKEN, bbaUsdWhale);
        balWeth8020Token = IERC20__factory.connect(BAL_WETH_8020_TOKEN, balWeth8020Whale);
        auraToken = IERC20__factory.connect(AURA_TOKEN, owner);
        balToken = IERC20__factory.connect(BALANCER_TOKEN, owner);

        balancerVault = AMOIBalancerVault__factory.connect(BALANCER_VAULT, owner);
        balancerHelpers = IBalancerHelpers__factory.connect(BALANCER_HELPERS, owner);
        weightedPool2Tokens = IWeightPool2Tokens__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, owner);
        liquidityGaugeFactory = AMOILiquidityGaugeFactory__factory.connect(AURA_LIQUIDITY_GAUGE_FACTORY, auraGaugeOwner);
        auraPoolManagerProxy = AMOIPoolManagerProxy__factory.connect(AURA_POOL_MANAGER_V3, auraMultisig);
        auraPoolManagerV3 = AMOIPoolManagerV3__factory.connect(AURA_POOL_MANAGER_V3, auraMultisig);
        balGaugeController = AMOIAuraGaugeController__factory.connect(AURA_GAUGE_CONTROLLER, balGaugeMultisig);
        authorizerAdapter = AMOIBalancerAuthorizerAdapter__factory.connect(BALANCER_AUTHORIZER_ADAPTER, balGaugeMultisig);
        gaugeAdder = AMOIGaugeAdder__factory.connect(GAUGE_ADDER, balGaugeMultisig);
        balancerVotingEscrow = AMOIBalancerVotingEscrow__factory.connect(BAL_VOTING_ESCROW, balWeth8020Whale);
        auraBooster = IAuraBooster__factory.connect(AURA_BOOSTER, owner);

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
        bbaUsdTempleAuraDepositToken = IERC20__factory.connect(token, owner);
        bbaUsdTempleAuraRewardPool = IBaseRewardPool__factory.connect(rewards, owner);

        poolHelper = await new PoolHelper__factory(owner).deploy(
            BALANCER_VAULT,
            TEMPLE,
            BALANCER_POOL_ID
        );
        
        amoStaking = await new AuraStaking__factory(owner).deploy(
            ownerAddress,
            TEMPLE_BBAUSD_LP_TOKEN,
            AURA_BOOSTER,
            bbaUsdTempleAuraDepositToken.address
        );
    
        amo = await new TPFAMO__factory(owner).deploy(
            BALANCER_VAULT,
            TEMPLE,
            BBA_USD_TOKEN,
            TEMPLE_BBAUSD_LP_TOKEN,
            amoStaking.address,
            AURA_BOOSTER,
            await poolHelper.templeBalancerPoolIndex(),
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
        await poolHelper.setTemplePriceFloorRatio(9700);
        await amo.setRebalanceRateChangeNumerator(300); // 3%
        await poolHelper.setRebalancePercentageBounds(200, 500);
        await amo.setMaxRebalanceAmount(BigNumber.from(ONE_ETH).mul(10));
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
            // await shouldThrow(connectAMO.setBalancerPoolId(BALANCER_POOL_ID), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setOperator(alanAddress), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setCoolDown(1800), /Ownable: caller is not the owner/); // 30 mins
            await shouldThrow(connectPoolHelper.setTemplePriceFloorRatio(9700), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setRebalanceRateChangeNumerator(300), /Ownable: caller is not the owner/); // 3%
            await shouldThrow(connectAMO.setPoolHelper(alanAddress), /Ownable: caller is not the owner/);
            const cappedAmounts = {
                temple: BigNumber.from(ONE_ETH).mul(10),
                bpt: BigNumber.from(ONE_ETH).mul(10),
                stable: BigNumber.from(ONE_ETH).mul(10)
            }
            //await shouldThrow(connectAMO.setCappedRebalanceAmounts(cappedAmounts), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setMaxRebalanceAmount(100), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setPostRebalanceSlippage(100), /Ownable: caller is not the owner/); // 1%
            //await shouldThrow(connectAMO.setLastRebalanceAmounts(ONE_ETH, ONE_ETH, ONE_ETH), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.togglePause(), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.recoverToken(TEMPLE , alanAddress, 100), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.rebalanceDown(ONE_ETH, 1), /NotOperatorOrOwner/);
            await shouldThrow(connectAMO.rebalanceUp(ONE_ETH, 1),/NotOperatorOrOwner/);
            await shouldThrow(connectAMO.depositStable(100, 1), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.withdrawStable(100, 1), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.addLiquidity(joinPoolRequest, 1), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.removeLiquidity(exitPoolRequest, 100), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.depositAndStakeBptTokens(100, true), /Ownable: caller is not the owner/);

            // passes
            await amo.setMaxRebalanceAmount(100);
            await amo.setPostRebalanceSlippage(100);
            await amo.togglePause();
            await amo.setOperator(ownerAddress);
            await amo.setCoolDown(1800);
            await poolHelper.setTemplePriceFloorRatio(9700);
            await amo.setRebalanceRateChangeNumerator(300);
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

        it("sets cooldown", async () => {
            const secs = 1800;
            await expect(amo.setCoolDown(secs))
                .to.emit(amo, "SetCooldown").withArgs(secs);
            //expect(await amo()).to.eq(secs);
            // attempt below cooldown
        });

        it("sets TPF ratio", async () => {
            const numerator = 9_700;
            const denominator = 10_000;
            await expect(poolHelper.setTemplePriceFloorRatio(numerator))
                .to.emit(poolHelper, "SetTemplePriceFloorRatio").withArgs(numerator, denominator);
            const tpf = await poolHelper.templePriceFloorRatio();
            expect(tpf.numerator).to.eq(numerator);
            expect(tpf.denominator).to.eq(denominator);
        });

        it("sets rebalance rate change for successive rebalances", async () => {
            const change = 300; // 3%
            // test wrong values
            await expect(amo.setRebalanceRateChangeNumerator(10_000)).to.be.revertedWith("InvalidBPSValue");
            await expect(amo.setRebalanceRateChangeNumerator(0)).to.be.revertedWith("InvalidBPSValue");

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
            await shouldThrow(amo.rebalanceDown(100, 1), /Paused/);

            // unpause
            await expect(amo.togglePause()).to.emit(amo, "SetPauseState").withArgs(false);
            amo.rebalanceDown(ONE_ETH, 1);
        });

        it("sets max rebalance amount", async () => {
            const maxAmount = toAtto(1_000);
            await amo.setMaxRebalanceAmount(maxAmount);
            expect(await amo.maxRebalanceAmount()).to.eq(maxAmount);
        });

        it("sets post rebalance slippage", async () => {
            // fails
            await expect(amo.setPostRebalanceSlippage(1_000)).to.be.revertedWith("InvalidBPSValue");
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
            await expect(amo.addLiquidity(failRequest, bptOut)).to.be.revertedWith("InvalidBalancerVaultRequest");
            failRequest.fromInternalBalance = false;
            await expect(amo.addLiquidity(failRequest, bptOut.add(1))).to.be.revertedWith("InsufficientAmountOutPostcall");
            const tx = await amo.addLiquidity(joinPoolRequest, bptOut);
            const receipt = await tx.wait();
            // temple transfer after mint
            let expectedValues = [ZERO_ADDRESS, amo.address, amountsIn[0]];
            let logWithEvent = expectedEventsWithValues(
                receipt,
                ethers.utils.id("Transfer(address,address,uint256)"),
                ["address", "address", "uint256"],
                expectedValues,
                true
            )!;
            const fromAddress = ethers.utils.getAddress(expectedValues[0].toString());
            const toAddress = ethers.utils.getAddress(amo.address);
            const eventFromAddress =  ethers.utils.getAddress(ethers.utils.hexDataSlice(logWithEvent.topics[1], 12, 32));
            const eventToAddress =  ethers.utils.getAddress(ethers.utils.hexDataSlice(logWithEvent.topics[2], 12, 32));
            const eventAmountTransfer = ethers.utils.defaultAbiCoder.decode(["uint256"], logWithEvent.data)[0];
            expect(eventFromAddress).to.eq(fromAddress);
            expect(eventToAddress).to.eq(toAddress);
            expect(eventAmountTransfer).to.eq(amountsIn[0]);

            // booster deposit event
            const expectedValuesDeposited = [amoStaking.address, bbaUsdTempleAuraPID, bptOut]
            logWithEvent = expectedEventsWithValues(
                receipt,
                ethers.utils.id("Deposited(address,uint256,uint256)"),
                ["address","uint256", "uint256"],
                expectedValues,
                true
            )!;
            console.log(logWithEvent);
            console.log(amoStaking.address);
            const expectedAddress = ethers.utils.getAddress(expectedValuesDeposited[0].toString());
            const userAddress = ethers.utils.getAddress(ethers.utils.hexDataSlice(logWithEvent.topics[1], 12, 32));
            const eventPid = ethers.utils.defaultAbiCoder.decode(["uint256"], logWithEvent.topics[2])[0];
            const eventAmount = ethers.utils.defaultAbiCoder.decode(["uint256"], logWithEvent.data)[0];
            expect(expectedAddress).to.eq(userAddress);
            expect(expectedValuesDeposited[1]).to.eq(eventPid);
            expect(expectedValuesDeposited[2]).to.eq(eventAmount);

            const bptAmountAfter = await bptToken.balanceOf(amoStaking.address);
            const stakedBalanceAfter = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            expect(bptAmountAfter).to.eq(0); // because bpt tokens have been staked
            expect(stakedBalanceAfter).to.eq(stakedBalanceBefore.add(bptOut));
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
            console.log("BPTIN", bptIn, amountsOut);

            // fail invalid request
            exitRequest.toInternalBalance = true;
            await shouldThrow(amo.removeLiquidity(exitRequest, bptAmountIn), /InvalidBalancerVaultRequest/);
            exitRequest.toInternalBalance = false;

            exitRequest.minAmountsOut = amountsOut;
            exitRequest.userData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [1, bptAmountIn]);
            const stableBefore = await bbaUsdToken.balanceOf(amo.address);
            
            const tx = await amo.removeLiquidity(exitRequest, bptIn);
            const receipt = await tx.wait();
            // check events and values
            // const expectedValuesTransfer = [amoStaking.address, ZERO_ADDRESS, amountsOut[0]];
            // let logWithEvent = expectedEventsWithValues(
            //     receipt,
            //     ethers.utils.id("Transfer(address,address,uint256)"),
            //     ["address","address","uint256"],
            //     expectedValuesTransfer,
            //     true
            // )!;
            // const fromAddress = ethers.utils.getAddress(expectedValuesTransfer[0].toString());
            // const toAddress = ethers.utils.getAddress(ZERO_ADDRESS);
            // const eventFromAddress =  ethers.utils.getAddress(ethers.utils.hexDataSlice(logWithEvent.topics[1], 12, 32));
            // const eventToAddress =  ethers.utils.getAddress(ethers.utils.hexDataSlice(logWithEvent.topics[2], 12, 32));
            // const eventAmountTransfer = ethers.utils.defaultAbiCoder.decode(["uint256"], logWithEvent.data)[0];
            // console.log(bbaUsdTempleAuraDepositToken.address, );
            // expect(eventFromAddress).to.eq(fromAddress);
            // expect(eventToAddress).to.eq(toAddress);
            // expect(eventAmountTransfer).to.eq(amountsOut[0]);

            // booster withdrawn event

            const expectedValues = [amoStaking.address, bbaUsdTempleAuraPID, bptIn];
            let logWithEvent = expectedEventsWithValues(
                receipt,
                ethers.utils.id("Withdrawn(address,uint256,uint256)"),
                ["address","uint256","uint256"],
                expectedValues,
                true
            )!;
            const expectedAddress = ethers.utils.getAddress(expectedValues[0].toString());
            const userAddress = ethers.utils.getAddress(ethers.utils.hexDataSlice(logWithEvent.topics[1], 12, 32));
            const eventPid = ethers.utils.defaultAbiCoder.decode(["uint256"], logWithEvent.topics[2])[0];
            const eventAmount = ethers.utils.defaultAbiCoder.decode(["uint256"], logWithEvent.data)[0];
            expect(expectedAddress).to.eq(userAddress);
            expect(expectedValues[1]).to.eq(eventPid);
            expect(expectedValues[2]).to.eq(eventAmount);
            
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
            const maxAmount = await amo.maxRebalanceAmount();
            await shouldThrow(amo.depositStable(100, 0), /ZeroSwapLimit/);
            await shouldThrow(amo.depositStable(maxAmount.add(1), 1), /AboveCappedAmount/);
            // skew price to above TPF to trigger no rebalance
            // single-side deposit stable token
            console.log(await getSpotPriceScaled());
            await singleSideDepositStable(bbaUsdToken, toAtto(10_000));
            console.log(await getSpotPriceScaled());
            await shouldThrow(amo.depositStable(ONE_ETH, 1), /NoRebalanceUp/);

            // single-side withdraw stable to skew price below TPF
            await singleSideDepositTemple(templeToken, toAtto(400_000));
            console.log(await getSpotPriceScaled());

            // increase capped amount
            const amountIn = toAtto(10_000);

            await amo.setMaxRebalanceAmount(amountIn);
            // next rebalance tolerance check
            await expect(amo.depositStable(amountIn, 1)).to.be.reverted;
            await amo.setRebalanceRateChangeNumerator(1_000);

            const currentSpotPriceScaled = await getSpotPriceScaled();
            expect(currentSpotPriceScaled).lt(TPF_SCALED);

            const reqData = await getJoinPoolRequest([BigNumber.from(0), amountIn]);
            const bptOut = reqData.bptOut;
            const tx = await amo.depositStable(amountIn, bptOut);
            const receipt = await tx.wait();
            expectedEventsWithValues(
                receipt,
                ethers.utils.id("StableDeposited(uint256,uint256)"),
                ["uint256","uint256"],
                [amountIn, bptOut],
                true
            );
            const expectedValues = [amoStaking.address, bbaUsdTempleAuraPID, bptOut];
            const logWithEvent = expectedEventsWithValues(
                receipt,
                ethers.utils.id("Deposited(address,uint256,uint256)"),
                ["address", "uint256", "uint256"],
                expectedValues,
                true
            )!;
            const expectedAddress = ethers.utils.getAddress(expectedValues[0].toString());
            const userAddress = ethers.utils.getAddress(ethers.utils.hexDataSlice(logWithEvent.topics[1], 12, 32));
            const eventPid = ethers.utils.defaultAbiCoder.decode(["uint256"], logWithEvent.topics[2])[0];
            const eventAmount = ethers.utils.defaultAbiCoder.decode(["uint256"], logWithEvent.data)[0];
            expect(expectedAddress).to.eq(userAddress);
            expect(expectedValues[1]).to.eq(eventPid);
            expect(expectedValues[2]).to.eq(eventAmount);
        });

        it("withdraws stable", async () => {
            // fail checks
            const maxAmount = await amo.maxRebalanceAmount();
            await shouldThrow(amo.depositStable(100, 0), /ZeroSwapLimit/);
            await shouldThrow(amo.depositStable(maxAmount.add(1), 1), /AboveCappedAmount/);
            console.log(await getSpotPriceScaled());
            // skew price below TPF
            await singleSideDepositTemple(templeToken, toAtto(50_000));
            console.log(await getSpotPriceScaled());
            await poolHelper.setTemplePriceFloorRatio(9_700);
            await shouldThrow(amo.withdrawStable(ONE_ETH, 1), /NoRebalanceDown/);

            // skew price above TPF
            await singleSideDepositStable(bbaUsdToken, toAtto(100_000));
            console.log(await getSpotPriceScaled());

            const amountOut = toAtto(1_000);
            let minAmountsOut = [BigNumber.from(0), amountOut];
            const bptAmountIn = toAtto(100);
            const reqData = await getExitPoolRequest(bptAmountIn, minAmountsOut, 0, BigNumber.from(1));
            let amountsOut = reqData.amountsOut;
            const exitTokenAmountOut = BigNumber.from(amountsOut[1]).mul(99).div(100); // minus fees
            const bptIn = reqData.bptIn
           
            await amo.setMaxRebalanceAmount(amountOut);
            await amo.setRebalanceRateChangeNumerator(1_000);

            // add liquidity to get some staked position
            await ownerAddLiquidity(bptAmountIn);
            const stableBalanceBefore = await bbaUsdToken.balanceOf(amo.address);
            console.log("AMOUNTS OUT", amountsOut, minAmountsOut);
            const tx = await amo.withdrawStable(bptIn, exitTokenAmountOut);
            const receipt = await tx.wait();
            const stableBalanceAfter = await bbaUsdToken.balanceOf(amo.address);
            expect(stableBalanceAfter).to.gte(stableBalanceBefore.add(exitTokenAmountOut));
            const expectedValues =  [amoStaking.address, bbaUsdTempleAuraPID, bptIn];
            const logWithEvent = expectedEventsWithValues(
                receipt,
                ethers.utils.id("Withdrawn(address,uint256,uint256)"),
                ["address","uint256", "uint256"],
                expectedValues,
                true
            )!;
            const expectedAddress = ethers.utils.getAddress(expectedValues[0].toString());
            const userAddress = ethers.utils.getAddress(ethers.utils.hexDataSlice(logWithEvent.topics[1], 12, 32));
            const eventPid = ethers.utils.defaultAbiCoder.decode(["uint256"], logWithEvent.topics[2])[0];
            const eventAmount = ethers.utils.defaultAbiCoder.decode(["uint256"], logWithEvent.data)[0];
            expect(expectedAddress).to.eq(userAddress);
            expect(expectedValues[1]).to.eq(eventPid);
            expect(expectedValues[2]).to.eq(eventAmount);
        });

        it("directly stakes bpt tokens", async () => {
            const joinAmount = toAtto(20_000);
            const reqData = await getJoinPoolRequest([joinAmount, joinAmount]);
            await templeToken.connect(owner).approve(balancerVault.address, joinAmount);
            await bbaUsdToken.connect(owner).approve(balancerVault.address, joinAmount);

            await balancerVault.connect(owner).joinPool(BALANCER_POOL_ID, ownerAddress, ownerAddress, reqData.joinPoolRequest);
            const amount = reqData.bptOut;
            console.log(amount);
            await bptToken.connect(owner).approve(amo.address, amount);
            const balBefore = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            await amo.depositAndStakeBptTokens(amount, false);
            const balAfter = await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address);
            console.log(balBefore, balAfter);
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
            await expect(amo.rebalanceUp(0, 0)).to.be.revertedWith("ZeroSwapLimit");
            await expect(amo.rebalanceUp(toAtto(1_000), 1)).to.be.revertedWith("AboveCappedAmount");
            await amo.togglePause();
            await expect(amo.rebalanceUp(1, 1)).to.be.revertedWith("Paused");
            await amo.togglePause();
            // add liquidity on-sided to skew price above TPF
            await singleSideDepositStable(bbaUsdToken, toAtto(40_000));
            let spotPriceScaled = await poolHelper.getSpotPriceScaled();
            expect(spotPriceScaled).to.gt(TPF_SCALED);
            // directly stake bpt tokens
            const bptOut = await ownerDepositAndStakeBpt(toAtto(10_000));
        
            await amo.setMaxRebalanceAmount(bptOut);
            // amount in is greater than last rebalanceAmount so expect revert
            await expect(amo.rebalanceUp(bptOut, 1)).to.be.reverted;

            await expect(amo.rebalanceUp(bptOut, 1)).to.be.revertedWith("NoRebalanceUp");

            await amo.setPostRebalanceSlippage(400); // 4%
            
            // now single side deposit TEMPLE to bring spot price down if up
            const spotPriceNow = await getSpotPriceScaled();
            const discountBelowTPF = 200; // 2% below TPF
            if (spotPriceNow.gt(TPF_SCALED - discountBelowTPF)) {
                await singleSideDepositTemple(templeToken, toAtto(100_000));
                console.log("spot price after single side depost", await getSpotPriceScaled());
            }

            // stake some more to have enough bpt to unwrap
            await ownerDepositAndStakeBpt(toAtto(20_000));

            // calculate amount of TEMPLE out to take spot quote price close to TPF by a slight percentage below TPF
            const data = await calculateBptTokensToBringTemplePriceUp(discountBelowTPF); // 2% below TPF
            const bptIn = data.bptIn;
            const maxAmount = await amo.maxRebalanceAmount();
            const cappedBptAmountPerRebalance = maxAmount;
            if (cappedBptAmountPerRebalance.lt(bptIn)) {
                
                await amo.setMaxRebalanceAmount(bptIn);
            }
            const templeAmountOut = data.amountOut;
            console.log(await getSpotPriceScaled());
            await expect(amo.rebalanceUp(bptIn, templeAmountOut))
                .to.emit(amo, "RebalanceUp")
                .withArgs(bptIn, templeAmountOut);

            // no rebalance up
            await expect(amo.rebalanceUp(1, 1)).to.be.revertedWith("NoRebalanceUp");
            expect(await poolHelper["isSpotPriceAboveTPF()"]()).to.be.false;
            expect(await poolHelper.isSpotPriceAboveTPFUpperBound()).to.be.false;
        });

        it.only("rebalances down", async () => {
            await amo.setCoolDown(3_600); 

            // fails
            await expect(amo.rebalanceDown(0, 0)).to.be.revertedWith("ZeroSwapLimit");
            await expect(amo.rebalanceDown(toAtto(1_000), 1)).to.be.revertedWith("AboveCappedAmount");
            await amo.togglePause();
            await expect(amo.rebalanceDown(1, 1)).to.be.revertedWith("Paused");
            await amo.togglePause();
            await getSpotPriceScaled();
            // add single-side liquidity to skew price below tpf
            await singleSideDepositTempleToPriceTarget(templeToken, 9_500);
            await amo.setMaxRebalanceAmount(toAtto(200_000));
            await expect(amo.rebalanceDown(toAtto(200_000), 1)).to.be.revertedWith("NoRebalanceDown");
            // add single-side stable to skew price above tpf
            await singleSideDepositStable(bbaUsdToken, toAtto(150_000));
            await getSpotPriceScaled();

            // stake some bpt to have enough bpt to unwrap
            const bptOut = await ownerDepositAndStakeBpt(toAtto(30_000));
            // make sure to meet the capped amount
            await amo.setMaxRebalanceAmount(bptOut);

            // rebalance down
            const reqData = await calculateBptTokensToBringTemplePriceDown(400);
            console.log(reqData);

            await amo.rebalanceDown(reqData.templeAmountIn, reqData.bptOut);
        });
    });

    describe("Aura Staking", async () => {

        it("admin tests", async () => {
            // fails
            const stakingConnect = amoStaking.connect(alan);
            await shouldThrow(stakingConnect.setOperator(alanAddress), /Ownable: caller is not the owner/);
            await shouldThrow(stakingConnect.setAuraPoolInfo(100, bptToken.address, bptToken.address), /Ownable: caller is not the owner/);
            await shouldThrow(stakingConnect.recoverToken(bptToken.address, alanAddress, 100), /Ownable: caller is not the owner/);
            await shouldThrow(stakingConnect.withdrawAllAndUnwrap(true, true), /Ownable: caller is not the owner/);

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
            await amoStaking.withdrawAndUnwrap(balance, true, false);
            expect(await bptToken.balanceOf(amoStaking.address)).to.eq(balance);

            let amoBalanceBefore = await bptToken.balanceOf(amo.address);
            await ownerAddLiquidity(amount);
            const toWithdraw = balance.div(2);
            await amoStaking.withdrawAndUnwrap(toWithdraw, true, true);
            let amoBalanceAfter = await bptToken.balanceOf(amo.address);
            expect(amoBalanceAfter).to.eq(amoBalanceBefore.add(toWithdraw));
            console.log(await bptToken.balanceOf(amo.address));
            console.log(await bptToken.balanceOf(amoStaking.address));
            console.log(await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address));
            amoBalanceBefore = await bptToken.balanceOf(amo.address);

            await ownerAddLiquidity(amount);
            console.log(await bptToken.balanceOf(amo.address));
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
            //0xd9e863B7317a66fe0a4d2834910f604Fd6F89C6c aura staking proxy
            //change_gauge_weight(addr: address, weight: uint256): 0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD
            // checkpoint_gauge(addr: address)
            // aura voter proxy: 0xaF52695E1bB01A16D33D7194C28C42b10e0Dbec2
            // ExtraRewardStashV3 0x41F1Ad38eA36E39E1Ea39067F2fe424F83E2e40f
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
    percentageAboveTPF: number // to percentage above TPF
) {
    let balances: BigNumber[];
    let tokens: string[];
    [tokens, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    const templeIndexInPool = await poolHelper.templeBalancerPoolIndex();
    const stableIndexInPool = templeIndexInPool.toNumber() == 0 ? 1 : 0;
    const templeBalance = balances[templeIndexInPool.toNumber()];
    const stableBalance = balances[stableIndexInPool];

    const tpf = await poolHelper.templePriceFloorRatio();
    const basisPointsAboveTPF = BigNumber.from(percentageAboveTPF).mul(tpf.numerator).div(10_000);
    const expectedSpotPriceQuote = tpf.numerator.add(basisPointsAboveTPF);
    console.log("current spot price", await getSpotPriceScaled());
    console.log("expectedspotpricequote", expectedSpotPriceQuote);

    // get temple amount to send to pool
    let templeAmountIn = expectedSpotPriceQuote.mul(stableBalance).div(templeBalance).mul(ONE_ETH);
    console.log("temple Amount In", templeAmountIn);

    // randomize between 50% to 100%
    const randomValue = Math.floor(Math.random() * (100 - 50 + 1) + 50);
    templeAmountIn = BigNumber.from(randomValue).mul(templeAmountIn).div(100);
    const maxAmount = await amo.maxRebalanceAmount();
    console.log(maxAmount);
    if (templeAmountIn.gt(maxAmount)) {
        templeAmountIn = maxAmount;
    }
    let amountsIn: BigNumber[] = [BigNumber.from(0), BigNumber.from(0)];
    amountsIn[templeIndexInPool.toNumber()] = templeAmountIn;
    console.log("before getJoinPoolRequest", amountsIn);
    const reqData = await getJoinPoolRequest(amountsIn);
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
    const templeIndexInPool = await poolHelper.templeBalancerPoolIndex();
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
    const tpf = await poolHelper.templePriceFloorRatio();
    const basisPointsBelowTPF = BigNumber.from(percentageBelowTPF).mul(tpf.numerator).div(10_000);
    const expectedSpotPriceQuote = tpf.numerator.sub(basisPointsBelowTPF);
    console.log("current spot price", await getSpotPriceScaled());
    console.log("expectedspotpricequote", expectedSpotPriceQuote, tpf.denominator);
    const BdDivTpfFee = stableBalance.mul(1_000).div(expectedSpotPriceQuote.mul(995));
    const lotSize = templeBalance.sub(BdDivTpfFee); // max expected TEMPLE to withdraw
    console.log("lotSize, templebalance", lotSize, templeBalance, BdDivTpfFee);
    // we don't want to fill to exactly value percentage below TPF, so we randomize between 0.5 and 1
    const randomValue = Math.floor(Math.random() * (100 - 50 + 1) + 50);
    let templeAmountOut = BigNumber.from(randomValue).mul(lotSize).div(100);
    console.log("Random, templeAmount", randomValue, templeAmountOut);
    // now use calculated amount out to query for join expected tokens out
    // get bpt amount in for exact TEMPLE out
    // BPT_IN_FOR_EXACT_TOKENS_OUT, enum 2
    console.log("templeindex", templeIndexInPool.toNumber(), templeAmountOut);
    // if temple amount to withdraw is above capped amount, set amount to capped amount
    const maxAmount = await amo.maxRebalanceAmount();
    const cappedTempleAmountPerRebalance = maxAmount;
    console.log(cappedTempleAmountPerRebalance);
    if (templeAmountOut.gt(cappedTempleAmountPerRebalance)) {
        templeAmountOut = cappedTempleAmountPerRebalance;
    }
    let amountsOut: BigNumber[] = [BigNumber.from(0), BigNumber.from(0)];
    amountsOut[templeIndexInPool.toNumber()] = templeAmountOut;
    console.log( amountsOut[templeIndexInPool.toNumber()]);
    const maxBPTAmountIn = toAtto(100_000);
    const tempUserdata = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]', 'uint256'], [2, amountsOut, maxBPTAmountIn]);
    let exitRequest = {
        assets: tokens,
        minAmountsOut: amountsOut,
        userData: tempUserdata,
        toInternalBalance: false
    }
    let bptIn: BigNumber;
    console.log(exitRequest);
    [bptIn, amountsOut] = await balancerHelpers.callStatic.queryExit(BALANCER_POOL_ID, amo.address, amo.address, exitRequest);
    console.log("BPT IN , amountsOut", bptIn, amountsOut);
    console.log("bpt staked", await bbaUsdTempleAuraRewardPool.balanceOf(amoStaking.address));
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
    const reqData = await getJoinPoolRequest([joinAmount, joinAmount]);
    await templeToken.connect(owner).approve(balancerVault.address, joinAmount);
    await bbaUsdToken.connect(owner).approve(balancerVault.address, joinAmount);

    await balancerVault.connect(owner).joinPool(BALANCER_POOL_ID, ownerAddress, amo.address, reqData.joinPoolRequest);
    await amo.depositAndStakeBptTokens(reqData.bptOut, true);
    return reqData.bptOut;
}

async function ownerAddLiquidity(
    bptAmountIn: BigNumber
) {
    const reqData = await getJoinPoolRequest([bptAmountIn, bptAmountIn]);
    const bptOut = reqData.bptOut;
    const req = reqData.joinPoolRequest;
    await amo.addLiquidity(req, bptOut);
}

async function getJoinPoolRequest(
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
    [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, amo.address, amo.address, joinPoolRequest);
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
    [bptIn, amountsOut] = await balancerHelpers.callStatic.queryExit(BALANCER_POOL_ID, amo.address, amo.address, exitRequest);
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
    const gaugeCreatedEventTopic = "0xaa98436d09d130af48de49867af8b723bbbebb0d737638b5fe8f1bf31bbb71c0";
    let deployedGauge: string = "";
    const decoder = new ethers.utils.AbiCoder();
    for(const log of receipt.logs) {
        if (log.topics[0] == gaugeCreatedEventTopic) {
            const res = decoder.decode(["address"], log.topics[1]);
            deployedGauge = res[0];
            console.log("DEPLOYED ADDRESS", deployedGauge);
            break;
        }
    }

    tx = await gaugeAdder.connect(balGaugeMultisig).addEthereumGauge(deployedGauge);
    receipt = await tx.wait();
    console.log("Gauge Added to Balancer");

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
    console.log(receipt.logs);
    // check logs for created addresses
    // emit PoolAdded(_lptoken, _gauge, token, newRewardPool, stash, pid);
    const boosterLog = receipt.logs[receipt.logs.length-1];
    const decodedData = ethers.utils.defaultAbiCoder.decode(["address","address","address","address","address","uint256"], boosterLog.data);
    const depositToken = decodedData[2];
    const newRewardPool = decodedData[3];
    const stash = decodedData[4];
    const pId = decodedData[5];
    console.log(depositToken, newRewardPool, stash, pId);

    return [deployedGauge, depositToken, newRewardPool, stash, pId];

}

async function getSpotPriceScaled() {
    let balances: BigNumber[];
    const precision = BigNumber.from(10_000);
    [, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    const normWeights = await weightedPool2Tokens.getNormalizedWeights();
    // multiply by precision to avoid rounding down
    const currentSpotPrice = precision.mul(balances[1]).div(normWeights[1]).div(balances[0].div(normWeights[0]));
    console.log("SPOT price scaled", currentSpotPrice);
    return currentSpotPrice;
}

async function singleSideDepositStable(
    stableToken: IERC20,
    amount: BigNumber
) {
    const whaleAddress = await bbaUsdWhale.getAddress();
    let assets: string[];
    [assets,,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    console.log("AMOUNT ", amount, await stableToken.balanceOf(whaleAddress));
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
    console.log("AMOUNTS IN SIGNLE SIDE", amountsIn, bptOut);
    const request = {
        assets: assets,
        maxAmountsIn: amountsIn, //[0, amount],
        userData: userdata,
        fromInternalBalance: false
    }
    await balancerVault.connect(bbaUsdWhale).joinPool(BALANCER_POOL_ID, whaleAddress, whaleAddress, request);
}

async function singleSideDepositTempleToPriceTarget(
    templeToken: TempleERC20Token,
    priceTarget: number // scaled
) {
    const currentPriceScaled = await getSpotPriceScaled();
    if (currentPriceScaled.gte(priceTarget)) {
        console.error("Current price greater than target price");
        return;
    }

    // calculate lot size for stable tokens
    let balances: BigNumber[];
    const templeIndexInPool = await poolHelper.templeBalancerPoolIndex();
    [,balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
    const stableIndexInPool = templeIndexInPool.toNumber() == 0 ? 1 : 0;
    // a ratio for stable balances against price quote with fees
    const bdDivQuoteWithFee = balances[stableIndexInPool].mul(1_000).div(BigNumber.from(priceTarget).mul(995));
    const templeLotSize = balances[templeIndexInPool.toNumber()].sub(bdDivQuoteWithFee);

    // query join pool with expected temple amounts
    const whaleAddress = await templeWhale.getAddress();
    let bptOut: BigNumber;
    let amountsIn: BigNumber[] = [templeLotSize, BigNumber.from(0)];
    const assets = [TEMPLE, bbaUsdToken.address]
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
    await templeToken.connect(templeWhale).approve(balancerVault.address, amountsIn[0]);
    await balancerVault.connect(templeWhale).joinPool(BALANCER_POOL_ID, whaleAddress, whaleAddress, request);

    await getSpotPriceScaled();
}


async function singleSideDepositTemple(
    templeToken: TempleERC20Token,
    amount: BigNumber
) {
    const whaleAddress = await templeWhale.getAddress();
    const assets = [TEMPLE, BBA_USD_TOKEN];
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

