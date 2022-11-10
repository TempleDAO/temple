import { ethers } from "hardhat";
import { expect } from "chai";
import { toAtto, shouldThrow, resetFork, impersonateSigner } from "../helpers";
import { BigNumber, Signer } from "ethers";
import amoAddresses from "./amo-constants";
import { 
  AMO__IBalancerVault,
  AMO__IBalancerVault__factory,
  ERC20, ERC20__factory,
  IBalancerHelpers, IBalancerHelpers__factory, 
  IWeightPool2Tokens,
  IWeightPool2Tokens__factory,
  PoolHelper, PoolHelper__factory, TempleERC20Token,
  TempleERC20Token__factory, 
} from "../../typechain";
import { getSpotPriceScaled, ownerAddLiquidity, singleSideDeposit, templeLotSizeForPriceTarget } from "./common";
import { DEPLOYED_CONTRACTS } from '../../scripts/deploys/helpers';
import { seedTempleBbaUsdPool, swapDaiForBbaUsd } from "./common";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const { MULTISIG, TEMPLE } = DEPLOYED_CONTRACTS.mainnet;

const { BALANCER_VAULT, BALANCER_HELPERS } = amoAddresses.contracts;
const { BALANCER_POOL_ID } = amoAddresses.others;
const { TEMPLE_WHALE, BINANCE_ACCOUNT_8, BBA_USD_WHALE } = amoAddresses.accounts;
const { DAI, TEMPLE_BBAUSD_LP_TOKEN, BBA_USD_TOKEN } = amoAddresses.tokens;

const TPF_SCALED = 9_700;
const BLOCKNUMBER = 15862300;

let poolHelper: PoolHelper;
let owner: Signer;
let alan: Signer;
let ownerAddress: string;
let bptToken: ERC20;
let balancerHelpers: IBalancerHelpers;
let balancerVault: AMO__IBalancerVault;
let bbaUsdToken: ERC20;
let templeToken: TempleERC20Token;
let daiToken: ERC20;
let weightedPool2Tokens: IWeightPool2Tokens;
let templeWhale: Signer;
let daiWhale: Signer;
let templeMultisig: Signer;
let bbaUsdWhale: Signer;

describe.only("Pool Helper", async () => {
    before( async () => {
        [owner, alan] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();
    });

    async function setup() {
        await resetFork(BLOCKNUMBER);
        templeWhale = await impersonateSigner(TEMPLE_WHALE);
        daiWhale = await impersonateSigner(BINANCE_ACCOUNT_8);
        bbaUsdWhale = await impersonateSigner(BBA_USD_WHALE);
        templeMultisig = await impersonateSigner(MULTISIG);

        templeToken = TempleERC20Token__factory.connect(TEMPLE, templeWhale);
        daiToken = ERC20__factory.connect(DAI, daiWhale);
        bptToken = ERC20__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, owner);
        bbaUsdToken = ERC20__factory.connect(BBA_USD_TOKEN, bbaUsdWhale);
        weightedPool2Tokens = IWeightPool2Tokens__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, owner);

        balancerVault = AMO__IBalancerVault__factory.connect(BALANCER_VAULT, owner);
        balancerHelpers = IBalancerHelpers__factory.connect(BALANCER_HELPERS, owner);

        poolHelper = await new PoolHelper__factory(owner).deploy(
            BALANCER_VAULT,
            TEMPLE,
            BALANCER_POOL_ID
        );

        await poolHelper.setTemplePriceFloorNumerator(TPF_SCALED);
        await poolHelper.setRebalancePercentageBounds(100, 400);

        const templeMultisigConnect = templeToken.connect(templeMultisig);
        await templeMultisigConnect.transfer(await templeWhale.getAddress(), toAtto(2_000_000));
        await templeMultisigConnect.transfer(ownerAddress, toAtto(2_000_000));

        // seed balancer pool
        const swapDaiAmount = toAtto(2_000_000);
        await swapDaiForBbaUsd(balancerVault, daiToken, daiWhale, swapDaiAmount, ownerAddress);
        const seedAmount = toAtto(1_000_000);
        await seedTempleBbaUsdPool(templeToken, balancerVault, balancerHelpers, owner, seedAmount, ownerAddress);

        await ownerAddLiquidity(
            balancerVault,
            balancerHelpers,
            templeToken,
            owner,
            ownerAddress,
            ownerAddress,
            toAtto(100_000)
        );

        return {
            templeWhale,
            daiWhale,
            bbaUsdWhale,
            templeMultisig,
    
            templeToken,
            daiToken,
            bptToken,
            bbaUsdToken,
            weightedPool2Tokens,
    
            balancerVault,
            balancerHelpers,
    
            poolHelper,
        };
    }

    beforeEach(async () => {
        ({
            templeWhale,
            daiWhale,
            bbaUsdWhale,
            templeMultisig,
    
            templeToken,
            daiToken,
            bptToken,
            bbaUsdToken,
            weightedPool2Tokens,
    
            balancerVault,
            balancerHelpers,
    
            poolHelper,
        } = await loadFixture(setup));
    });

    it("admin tests", async () => {
        const alanConnect = poolHelper.connect(alan);
        // fails
        await shouldThrow(alanConnect.setTemplePriceFloorNumerator(1_000), /Ownable: caller is not the owner/);
        await shouldThrow(alanConnect.setRebalancePercentageBounds(100,100), /Ownable: caller is not the owner/);

        // success
        await poolHelper.setTemplePriceFloorNumerator(TPF_SCALED);
        await poolHelper.setRebalancePercentageBounds(100, 200);
    });

    it("sets rebalance lower and upper bounds", async () => {
        await poolHelper.setRebalancePercentageBounds(100, 400);
        expect(await poolHelper.rebalancePercentageBoundLow()).to.eq(100);
        expect(await poolHelper.rebalancePercentageBoundUp()).to.eq(400);
    });

    it ("sets tpf ratio", async () => {
        await expect(poolHelper.setTemplePriceFloorNumerator(TPF_SCALED))
            .to.emit(poolHelper, "SetTemplePriceFloorRatio")
            .withArgs(TPF_SCALED, 10_000);
        const tpf =  await poolHelper.templePriceFloorNumerator();
        expect(tpf).to.eq(TPF_SCALED);
    });

    it("gets LP balances", async () => {
        const balances = await poolHelper.getBalances();
        expect(balances[0]).gt(0);
        expect(balances[1]).gt(0);
    });

    it("gets spot price using lp ratio", async () => {
        const spotScaledBalancer = await getSpotPriceScaled(balancerVault, weightedPool2Tokens);
        const spotScaledPoolHelper = await poolHelper.getSpotPriceScaled();
        expect(spotScaledPoolHelper).gt(0);
        expect(spotScaledPoolHelper).lt(15_000);
        expect(spotScaledBalancer).to.eq(spotScaledPoolHelper);
    });

    it("spot price above tpf with and without deviation", async () => {
        let isAboveTPF = (await poolHelper.functions["isSpotPriceAboveTPF()"]())[0];
        const spotScaledBalancer = await getSpotPriceScaled(balancerVault, weightedPool2Tokens);
        let spotScaledAbove = false;
        if (spotScaledBalancer.gt(TPF_SCALED)) {
            spotScaledAbove = true;
        }
        expect(isAboveTPF).to.eq(spotScaledAbove);

        const deviation = BigNumber.from(300); // 3%
        isAboveTPF =  (await poolHelper.functions["isSpotPriceAboveTPF(uint256)"](deviation))[0];
        const diffScaled = deviation.mul(spotScaledBalancer).div(10_000);
        spotScaledAbove = false;
        if (spotScaledBalancer.gt(BigNumber.from(TPF_SCALED).sub(diffScaled))) {
            spotScaledAbove = true;
        }
        expect(isAboveTPF).to.eq(spotScaledAbove);
    });

    it("spot price below tpf with and without deviation", async () => {
        let isBelowTPF = (await poolHelper.functions["isSpotPriceBelowTPF()"]())[0];
        const spotScaledBalancer = await getSpotPriceScaled(balancerVault, weightedPool2Tokens);
        let spotScaledAbove = false;
        if (spotScaledBalancer.lt(TPF_SCALED)) {
            spotScaledAbove = true;
        }
        expect(isBelowTPF).to.eq(spotScaledAbove);

        const deviation = BigNumber.from(300); // 3%
        isBelowTPF =  (await poolHelper.functions["isSpotPriceBelowTPF(uint256)"](deviation))[0];
        const diffScaled = deviation.mul(spotScaledBalancer).div(10_000);
        spotScaledAbove = false;
        if (spotScaledBalancer.lt(BigNumber.from(TPF_SCALED).sub(diffScaled))) {
            spotScaledAbove = true;
        }
        expect(isBelowTPF).to.eq(spotScaledAbove);
    });

    it("Is Spot Price Below TPF Lower Bound", async () =>{
        const templeIndexInPool = (await poolHelper.templeBalancerPoolIndex()).toNumber();
        // skew spot price below TPF
        const targetPriceScaled = 9500;
        const templeLotSize = await templeLotSizeForPriceTarget(balancerVault, templeIndexInPool, targetPriceScaled);
        const amountsIn: BigNumber[] = [templeLotSize, BigNumber.from(0)];
        await singleSideDeposit(balancerVault, balancerHelpers, templeWhale, amountsIn);

        expect(await poolHelper.isSpotPriceBelowTPFLowerBound()).to.be.true;
        // expect spot price close to target price scaled
        const newSpotPrice = await poolHelper.getSpotPriceScaled();
        expect(newSpotPrice).to.be.closeTo(targetPriceScaled, 100); // 0.1% approximation       
    });

    it("is spot price above TPF upper bound", async () => {
        const templeIndexInPool = (await poolHelper.templeBalancerPoolIndex()).toNumber();
        // skew spot price above TPF
        const targetPriceScaled = 10_500;
        
        const stableLotSize = await templeLotSizeForPriceTarget(balancerVault, templeIndexInPool, targetPriceScaled);
        let amountsIn: BigNumber[] = [BigNumber.from(0), stableLotSize];
        await singleSideDeposit(balancerVault, balancerHelpers, bbaUsdWhale, amountsIn);

        expect(await poolHelper.isSpotPriceAboveTPFUpperBound()).to.be.true;
        const newSpotPrice = await poolHelper.getSpotPriceScaled();
        expect(newSpotPrice).to.be.closeTo(targetPriceScaled, 100); // 0.1% approximation

        // skew spot price to above TPF but below TPF+bound
        const tpfScaled = await poolHelper.templePriceFloorNumerator();
        const upperBoundScaled = (await poolHelper.rebalancePercentageBoundUp()).mul(tpfScaled).div(10_000);
        const newTarget = tpfScaled.add(upperBoundScaled).sub(10); // subtract to go below TPF+bound

        const templeLotSize = await templeLotSizeForPriceTarget(balancerVault, templeIndexInPool, newTarget.toNumber());
        amountsIn = [templeLotSize, BigNumber.from(0)];
        await singleSideDeposit(balancerVault, balancerHelpers, templeWhale, amountsIn);

        expect(await poolHelper.isSpotPriceAboveTPFUpperBound()).to.be.false;
        expect(await poolHelper.getSpotPriceScaled()).to.lt(tpfScaled.add(upperBoundScaled));
    });

    it("will join take price below TPF lower bound", async () => {
        const joinAmount = toAtto(50_000);
        const templeIndexInPool = (await poolHelper.templeBalancerPoolIndex()).toNumber();
        const stableIndexInPool = templeIndexInPool == 0 ? 1 : 0;
        const [, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
        const newSpotPriceScaled = balances[stableIndexInPool].mul(10_000).div(balances[templeIndexInPool].add(joinAmount));
        const tpfScaled = await poolHelper.templePriceFloorNumerator();
        const lowerBoundScaled = (await poolHelper.rebalancePercentageBoundLow()).mul(tpfScaled).div(10_000);
        const newTarget = tpfScaled.sub(lowerBoundScaled);
        const willTakePriceBelow = newSpotPriceScaled < newTarget;
        expect(await poolHelper.willJoinTakePriceBelowTPFLowerBound(joinAmount)).to.eq(willTakePriceBelow);
    });

    it("will exit take price above TPF upper bound", async () => {
        const exitAmount = toAtto(50_000);
        const templeIndexInPool = (await poolHelper.templeBalancerPoolIndex()).toNumber();
        const stableIndexInPool = templeIndexInPool == 0 ? 1 : 0;
        const [, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
        const newSpotPriceScaled = balances[stableIndexInPool].mul(10_000).div(balances[templeIndexInPool].sub(exitAmount));
        const tpfScaled = await poolHelper.templePriceFloorNumerator();
        const upperBoundScaled = (await poolHelper.rebalancePercentageBoundUp()).mul(tpfScaled).div(10_000);
        const newTarget = tpfScaled.add(upperBoundScaled);
        const willTakePriceAbove = newSpotPriceScaled > newTarget;
        expect(await poolHelper.willExitTakePriceAboveTPFUpperBound(exitAmount)).to.eq(willTakePriceAbove);
    });

    it("gets right balances", async () => {
        const [,balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
        const poolHelperBalances = await poolHelper.getBalances();
        for (let i=0; i<balances.length; i++) {
            expect(poolHelperBalances[i]).to.eq(balances[i]);
        }
    });

    it("gets max", async () => {
        expect(await poolHelper.getMax(1, 2)).to.eq(2);
    });
});