import { ethers, network } from "hardhat";
import { expect, should } from "chai";
import { toAtto, shouldThrow, mineForwardSeconds, blockTimestamp } from "../helpers";
import { BigNumber, Contract, ContractReceipt, Signer } from "ethers";
import addresses from "../constants";
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
import { timeStamp } from "console";

const { MULTISIG, TEMPLE } = DEPLOYED_CONTRACTS.mainnet;
const { BALANCER_VAULT } = addresses.contracts;
const { FRAX_WHALE, BINANCE_ACCOUNT_8 } = addresses.accounts;
const { FRAX } = addresses.tokens;
const { DAI } = addresses.tokens;
const TEMPLE_DAI_LP_TOKEN = "0x1b65fe4881800b91d4277ba738b567cbb200a60d";
const BBA_USD_TOKEN = "0xA13a9247ea42D743238089903570127DdA72fE44";
const BBA_USD_POOL_ID = "0xa13a9247ea42d743238089903570127dda72fe4400000000000000000000035d";
const STA_BAL3_POOL_ID = "0x06df3b2bbb68adc8b0e302443692037ed9f91b42000000000000000000000063";
const STA_BAL3 = "0x06Df3b2bbB68adc8B0e302443692037ED9f91b42";
const TEMPLE_BBAUSD_LP_TOKEN = "0x173063a30e095313eee39411f07e95a8a806014e";
const BALANCER_AUTHORIZER = "0xA331D84eC860Bf466b4CdCcFb4aC09a1B43F3aE6";
const BALANCER_AUTHORIZER_ADAPTER = "0x8F42aDBbA1B16EaAE3BB5754915E0D06059aDd75";
const TPF_SCALED = 9_700;
const REWARDS = "0xB665b3020bBE8a9020951e9a74194c1BFda5C5c4";
const AURA_BOOSTER = "0x7818A1DA7BD1E64c199029E86Ba244a9798eEE10";
const BALANCER_POOL_ID = "0x173063a30e095313eee39411f07e95a8a806014e0002000000000000000003ab";
const BALANCER_HELPERS = "0x5aDDCCa35b7A0D07C74063c48700C8590E87864E";
const ONE_ETH = toAtto(1);
const TEMPLE_WHALE = "0xf6C75d85Ef66d57339f859247C38f8F47133BD39";
const BBA_USD_WHALE = "0x1CeD4e3900c73A54eD775ef2740a4e38aC5b54e2";
const AURA_LIQUIDITY_GAUGE_FACTORY = "0xf1665E19bc105BE4EDD3739F88315cC699cc5b65";
const AURA_GAUGE_OWNER = "0x512fce9B07Ce64590849115EE6B32fd40eC0f5F3"; // balancerMaxi.eth
const AURA_POOL_MANAGER_PROXY = "0x16A04E58a77aB1CE561A37371dFb479a8594947A";
const AURA_POOL_MANAGER_SEC_PROXY = "0xdc274F4854831FED60f9Eca12CaCbD449134cF67";
const AURA_POOL_MANAGER_V3 = "0xf843F61508Fc17543412DE55B10ED87f4C28DE50"; // poolManagerV3. operates SEC PROXY
const AURA_POOL_MANAGER_OPERATOR = "0x5feA4413E3Cc5Cf3A29a49dB41ac0c24850417a0"; // aura multisig
const BAL_MULTISIG = "0xc38c5f97B34E175FFd35407fc91a937300E33860";
const AURA_GAUGE_CONTROLLER = "0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD";
const GAUGE_ADDER = "0x2ffb7b215ae7f088ec2530c7aa8e1b24e398f26a";
const BAL_VOTING_ESCROW = "0xC128a9954e6c874eA3d62ce62B468bA073093F25"; // veBAL
const BAL_WETH_8020_WHALE = "0x24FAf482304Ed21F82c86ED5fEb0EA313231a808";
const BAL_WETH_8020_TOKEN = "0x5c6Ee304399DBdB9C8Ef030aB642B10820DB8F56";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
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
        fraxToken = IERC20__factory.connect(FRAX, fraxWhale);
        daiToken = IERC20__factory.connect(DAI, daiWhale);
        bptToken = IERC20__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, owner);
        bbaUsdToken = IERC20__factory.connect(BBA_USD_TOKEN, bbaUsdWhale);
        balWeth8020Token = IERC20__factory.connect(BAL_WETH_8020_TOKEN, balWeth8020Whale);

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

        // add amo as TEMPLE minter
        const templeMultisigConnect = templeToken.connect(templeMultisig);
        await templeMultisigConnect.transfer(await templeWhale.getAddress(), toAtto(2_000_000));
        await templeMultisigConnect.transfer(ownerAddress, toAtto(2_000_000));

        // seed balancer pool
        await swapDaiForBbaUsd(toAtto(2_000_000), ownerAddress);
        await seedTempleBbaUsdPool(owner, toAtto(1_000_000), ownerAddress);
        
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
        )
        
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
            poolHelper.address
        );

        await amoStaking.setOperator(amo.address);
        await bbaUsdToken.connect(owner).transfer(amo.address, toAtto(500_000));
        await templeMultisigConnect.addMinter(amo.address);

        // set params
        await amo.setBalancerPoolId(BALANCER_POOL_ID);
        await amo.setAuraBooster(AURA_BOOSTER);
        await amoStaking.setAuraPoolInfo(bbaUsdTempleAuraPID, bbaUsdTempleAuraDepositToken.address, bbaUsdTempleAuraRewardPool.address);
        await amo.setOperator(ownerAddress);
        await amo.setCoolDown(1800); // 30 mins
        await poolHelper.setTemplePriceFloorRatio(9700);
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
            await shouldThrow(connectAMO.setBalancerPoolId(BALANCER_POOL_ID), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setOperator(alanAddress), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setCoolDown(1800), /Ownable: caller is not the owner/); // 30 mins
            await shouldThrow(connectPoolHelper.setTemplePriceFloorRatio(9700), /Ownable: caller is not the owner/);
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
            await shouldThrow(connectAMO.rebalanceDown(ONE_ETH, 1), /NotOperatorOrOwner/);
            await shouldThrow(connectAMO.rebalanceUp(ONE_ETH, 1),/NotOperatorOrOwner/);
            await shouldThrow(connectAMO.depositStable(100, 1), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.withdrawStable(100, 1), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.depositAndStake(100), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.addLiquidity(joinPoolRequest, 1), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.removeLiquidity(exitPoolRequest, 100), /Ownable: caller is not the owner/);

            // passes
            await amo.setCappedRebalanceAmounts(cappedAmounts);
            await amo.setPostRebalanceSlippage(100, 100);
            await amo.togglePause();
            await amo.setLastRebalanceAmounts(ONE_ETH, ONE_ETH, ONE_ETH);
            await amo.setBalancerPoolId(BALANCER_POOL_ID);
            await amo.setOperator(ownerAddress);
            await amo.setCoolDown(1800);
            await poolHelper.setTemplePriceFloorRatio(9700);
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
            await expect(amoStaking.setAuraPoolInfo(bbaUsdTempleAuraPID, bbaUsdTempleAuraDepositToken.address, bbaUsdTempleAuraRewardPool.address))
                .to.emit(amoStaking, "SetAuraPoolInfo").withArgs(bbaUsdTempleAuraPID, bbaUsdTempleAuraDepositToken.address, bbaUsdTempleAuraRewardPool.address);
            const auraPoolInfo = await amoStaking.auraPoolInfo();
            expect(auraPoolInfo.rewards).to.eq(REWARDS);
            expect(auraPoolInfo.pId).to.eq(bbaUsdTempleAuraPID);
            expect(auraPoolInfo.token).to.eq(bbaUsdTempleAuraDepositToken.address);
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
            await expect(poolHelper.setTemplePriceFloorRatio(numerator))
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
            await shouldThrow(amo.rebalanceDown(100, 1), /Paused/);

            // unpause
            await expect(amo.togglePause()).to.emit(amo, "SetPauseState").withArgs(false);
            amo.rebalanceDown(ONE_ETH, 1);
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

    describe("Liquidity Add/Remove", async () => {
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
            expectedEventsWithValues(
                receipt,
                ethers.utils.id("Transfer(address,address,uint256)"),
                ["address", "address", "uint256"],
                [ZERO_ADDRESS, amo.address, amountsIn[0]],
                false
            );
            // booster deposit event
            expectedEventsWithValues(
                receipt,
                ethers.utils.id("Deposited(address,uint256,uint256)"),
                ["address","uint256", "uint256"],
                [amoStaking.address, bbaUsdTempleAuraPID, bptOut],
                false
            );
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
            expectedEventsWithValues(
                receipt,
                ethers.utils.id("Transfer(address,address,uint256)"),
                ["address","address","uint256"],
                [amo.address, ZERO_ADDRESS, amountsOut[0]],
                false
            );
            // booster withdrawn event
            expectedEventsWithValues(
                receipt,
                ethers.utils.id("Withdrawn(address,uint256,uint256)"),
                ["address","uint256","uint256"],
                [amoStaking.address, bbaUsdTempleAuraPID, bptIn],
                false
            );
            
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

        it.only("deposits stable", async () => {
            // fail checks
            const cappedAmounts = await amo.cappedRebalanceAmounts();
            await shouldThrow(amo.depositStable(100, 0), /ZeroSwapLimit/);
            await shouldThrow(amo.depositStable(cappedAmounts.stable.add(1), 1), /AboveCappedAmount/);
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
            const setCappedAmounts = {
                temple: amountIn,
                bpt: amountIn,
                stable: amountIn
            }

            await amo.setCappedRebalanceAmounts(setCappedAmounts);
            // next rebalance tolerance check
            await expect(amo.depositStable(amountIn, 1)).to.be.reverted;
            await amo.setRebalanceRateChangeNumerator(1_000);
            await amo.setLastRebalanceAmounts(amountIn, amountIn, amountIn);
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
                false
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
            const cappedAmounts = await amo.cappedRebalanceAmounts();
            await shouldThrow(amo.depositStable(100, 0), /ZeroSwapLimit/);
            await shouldThrow(amo.depositStable(cappedAmounts.stable.add(1), 1), /AboveCappedAmount/);
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
            const setCappedAmounts = {
                temple: amountOut,
                bpt: amountOut,
                stable: amountOut
            }
            await amo.setCappedRebalanceAmounts(setCappedAmounts);
            await amo.setRebalanceRateChangeNumerator(1_000);
            await amo.setLastRebalanceAmounts(amountOut, amountOut, amountOut);

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
    });

    describe("Aura Staking", async () => {

        it("admin tests", async () => {

        });
    });
});

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
    // kinds accepted are EXACT_BPT_IN_FOR_TOKENS_OUT and EXACT_BPT_IN_FOR_ONE_TOKEN_OUT
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

function expectedEventsWithValues(
    receipt: ContractReceipt,
    eventTopic: string,
    decodeParams: string[],
    expectedValues: any[],
    returnlog: boolean
) {
    let eventFired: boolean = false;
    console.log("values", expectedValues, eventTopic);
    for (const log of receipt.logs) {
        //console.log("eventtopic, logtopic", eventTopic, log.topics);
        console.log(log.data);
        console.log(log.topics[0]);
        if (log.topics.length > 0 && eventTopic == log.topics[0]) {
            eventFired = true;
            console.log(log);
            if (returnlog) {
                return log;
            }
            const decodedValues = ethers.utils.defaultAbiCoder.decode(decodeParams, log.data);
            
            console.log("logadata", log.data, decodedValues);
            console.log("decoded values", decodedValues);
            for (let i=0; i<expectedValues.length; i++) {
                if (expectedValues[i] !== undefined && decodedValues[i] !== undefined) {
                    console.log("topic found", expectedValues[i], decodedValues[i]);
                    expect(expectedValues[i]).to.eq(decodedValues[i]);
                }   
            }
        }
    }
    expect(eventFired).to.eq(true);
}

async function createAuraPoolAndStakingContracts(
    signer: Signer,
    relativeWeightCap: BigNumber
) {
    // create gauge with liquidity gauge factory (0xf1665E19bc105BE4EDD3739F88315cC699cc5b65) as balancermaxi.eth 
    let tx = await liquidityGaugeFactory.create(TEMPLE_BBAUSD_LP_TOKEN, relativeWeightCap);
    let receipt = await tx.wait();
    //console.log("CREATED GAUGE", receipt.logs);
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

// todo: deposit TEMPLE or stable token using depositSingle from RewardPoolDepositWrapper 0xB188b1CB84Fb0bA13cb9ee1292769F903A9feC59
// in contract

async function seedTempleBbaUsdPool(
    signer: Signer,
    amount: BigNumber,
    to: string
) {
    const signerAddress = await signer.getAddress();
    // approvals
    await bbaUsdToken.connect(signer).approve(balancerVault.address, amount);
    await templeToken.connect(signer).approve(balancerVault.address, amount);
    console.log("BALANCESS", await templeToken.balanceOf(signerAddress), await bbaUsdToken.balanceOf(signerAddress));
    const tokens = [TEMPLE, BBA_USD_TOKEN];
    const maxAmountsIn = [amount, amount];
    const userdata = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]", "uint256"], [1, maxAmountsIn, 1]);
    let req  = {
        assets: tokens,
        maxAmountsIn: maxAmountsIn,
        userData: userdata,
        fromInternalBalance: false
    }
    let bptOut: BigNumber;
    let amountsIn: BigNumber[];
    [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, signerAddress, to, req);
    console.log("QUERIED JOIN ", bptOut, amountsIn);

    req.maxAmountsIn = amountsIn;
    req.userData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256[]", "uint256"], [1, amountsIn, bptOut]);
    await balancerVault.connect(signer).joinPool(BALANCER_POOL_ID, signerAddress, to, req);

    console.log("BALANCE BPT TO", await bptToken.balanceOf(to));
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

async function swapDaiForBbaUsd(
    amount: BigNumber,
    to: string
) {
    const whaleAddress = await daiWhale.getAddress();
    const daiConnect = daiToken.connect(daiWhale);
    // do batch swap
    const kind = 0;
    const swaps = [
        {
            poolId: "0xae37d54ae477268b9997d4161b96b8200755935c000000000000000000000337",
            assetInIndex: 0,
            assetOutIndex: 1,
            amount: amount,
            userData: "0x"
        },
        {
            poolId: "0x804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000fb",
            assetInIndex: 1,
            assetOutIndex: 2,
            amount: 0,
            userData: "0x"
        },
        {
            poolId: "0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe",
            assetInIndex: 2,
            assetOutIndex: 3,
            amount: 0,
            userData: "0x"
        },
        {
            poolId: "0x9210f1204b5a24742eba12f710636d76240df3d00000000000000000000000fc",
            assetInIndex: 3,
            assetOutIndex: 4,
            amount: 0,
            userData: "0x"
        }, 
        {
            poolId: "0x82698aecc9e28e9bb27608bd52cf57f704bd1b83000000000000000000000336",
            assetInIndex: 4,
            assetOutIndex: 5,
            amount: 0,
            userData: "0x"
        },
        {
            poolId: "0xa13a9247ea42d743238089903570127dda72fe4400000000000000000000035d",
            assetInIndex: 5,
            assetOutIndex: 6,
            amount: 0,
            userData: "0x"
        }
    ];
    const assets = [
        "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        "0x02d60b84491589974263d922D9cC7a3152618Ef6",
        "0x804CdB9116a10bB78768D3252355a1b18067bF8f",
        "0x9210F1204b5a24742Eba12f710636D76240dF3d0",
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "0x82698aeCc9E28e9Bb27608Bd52cF57f704BD1B83",
        "0xA13a9247ea42D743238089903570127DdA72fE44",
    ];
    const zero = BigNumber.from(0);
    const limits = [
        amount,
        zero,
        zero,
        zero,
        zero,
        zero,
        BigNumber.from(-1).mul(amount).mul(9).div(10) // -1 * amount * 90%
    ];
    const deadline = toAtto(100);
    const funds = {
        sender: whaleAddress,
        fromInternalBalance: false,
        recipient: to,
        toInternalBalance: false
    }
    await daiConnect.approve(balancerVault.address, amount);
    await balancerVault.connect(daiWhale).batchSwap(kind, swaps, assets, funds, limits, deadline);
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