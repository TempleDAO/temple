import { ethers } from "hardhat";
import { expect } from "chai";
import { toAtto, impersonateSigner, resetFork } from "../helpers";
import { BigNumber, Signer } from "ethers";
import amoAddresses from "./amo-constants";
import {
  IBalancerVault,
  IBalancerVault__factory, ERC20, ERC20__factory,
  IBalancerHelpers, IBalancerHelpers__factory,
  IWeightPool2Tokens,
  IWeightPool2Tokens__factory,
  BalancerPoolHelper, BalancerPoolHelper__factory, TempleERC20Token,
  TempleERC20Token__factory,
} from "../../typechain";
import { getSpotPriceScaled, getTempleIndexInBalancerPool, ownerAddLiquidity, singleSideDeposit, templeLotSizeForPriceTarget } from "./common";
import { DEPLOYED_CONTRACTS } from '../../scripts/deploys/helpers';
import { seedTempleBbaUsdPool, swapDaiForBbaUsd } from "./common";
import { zeroAddress } from "ethereumjs-util";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const { MULTISIG, TEMPLE } = DEPLOYED_CONTRACTS.mainnet;

const { BALANCER_VAULT, BALANCER_HELPERS } = amoAddresses.mainnet.contracts;
const { TEMPLE_BB_A_USD_BALANCER_POOL_ID } = amoAddresses.mainnet.others;
const { TEMPLE_WHALE, BINANCE_ACCOUNT_8, BBA_USD_WHALE } = amoAddresses.mainnet.accounts;
const { DAI, TEMPLE_BBAUSD_LP_TOKEN, BBA_USD_TOKEN } = amoAddresses.mainnet.tokens;

const TPF_SCALED = toAtto(0.97);
const BLOCKNUMBER = 15862300;

let poolHelper: BalancerPoolHelper;
let owner: Signer;
let alan: Signer;
let ownerAddress: string;
let bptToken: ERC20;
let balancerHelpers: IBalancerHelpers;
let balancerVault: IBalancerVault;
let bbaUsdToken: ERC20;
let templeToken: TempleERC20Token;
let daiToken: ERC20;
let weightedPool2Tokens: IWeightPool2Tokens;
let templeWhale: Signer;
let daiWhale: Signer;
let templeMultisig: Signer;
let bbaUsdWhale: Signer;
let upperBound: BigNumber;
let lowerBound: BigNumber;

describe("Pool Helper", async () => {
    before(async () => {
        [owner, alan] = await ethers.getSigners();
        ownerAddress = await owner.getAddress();

        upperBound = BigNumber.from(400);
        lowerBound = BigNumber.from(100);
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

        balancerVault = IBalancerVault__factory.connect(BALANCER_VAULT, owner);
        balancerHelpers = IBalancerHelpers__factory.connect(BALANCER_HELPERS, owner);
        
        const templeIndexInBalancerPool = await getTempleIndexInBalancerPool(balancerVault, templeToken.address);

        poolHelper = await new BalancerPoolHelper__factory(owner).deploy(
            BALANCER_VAULT,
            BALANCER_HELPERS,
            TEMPLE,
            BBA_USD_TOKEN,
            bptToken.address,
            zeroAddress(),
            templeIndexInBalancerPool,
            TEMPLE_BB_A_USD_BALANCER_POOL_ID
        );

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
        const connectPoolHelper = poolHelper.connect(alan);
        await expect(connectPoolHelper.exitPool(100, 1, 100, 100, 100, 1, 9_700, templeToken.address))
            .to.be.revertedWithCustomError(poolHelper, "OnlyAMO");
        await expect(connectPoolHelper.joinPool(100, 1, 100, 100, 9_600, 100, 1, templeToken.address))
            .to.be.revertedWithCustomError(poolHelper, "OnlyAMO");
    });

    it("gets LP balances", async () => {
        const balances = await poolHelper.getBalances();
        expect(balances[0]).gt(0);
        expect(balances[1]).gt(0);
    });

    it("gets right temple stable balances", async () => {
        const [, balances,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
        const templeStableBalances = await poolHelper.getPairBalances();
        const templeIndex = (await poolHelper.protocolTokenIndexInBalancerPool()).toNumber();
        const stableIndex = templeIndex == 0 ? 1 : 0;
        expect(templeStableBalances.protocolTokenBalance).to.eq(balances[templeIndex]);
        expect(templeStableBalances.quoteTokenBalance).to.eq(balances[stableIndex]);
    });

    it("gets spot price using lp ratio", async () => {
        const spotScaledBalancer = await getSpotPriceScaled(balancerVault, weightedPool2Tokens);
        const spotScaledPoolHelper = await poolHelper.getSpotPrice();
        expect(spotScaledPoolHelper).gt(0);
        expect(spotScaledPoolHelper).lt(toAtto(1.5));
        expect(spotScaledBalancer).to.eq(spotScaledPoolHelper);
    });

    it("spot price above tpf with and without deviation", async () => {
        let isAboveTPF = (await poolHelper.functions["isSpotPriceAboveTpi(uint256)"](9_700))[0];
        const spotScaledBalancer = await getSpotPriceScaled(balancerVault, weightedPool2Tokens);
        let spotScaledAbove = false;
        if (spotScaledBalancer.gt(TPF_SCALED)) {
            spotScaledAbove = true;
        }
        expect(isAboveTPF).to.eq(spotScaledAbove);

        const deviation = BigNumber.from(300); // 3%
        isAboveTPF =  (await poolHelper.functions["isSpotPriceAboveTpi(uint256,uint256)"](deviation, TPF_SCALED))[0];
        const diffScaled = deviation.mul(spotScaledBalancer).div(10_000);
        spotScaledAbove = false;
        if (spotScaledBalancer.gt(TPF_SCALED.sub(diffScaled))) {
            spotScaledAbove = true;
        }
        expect(isAboveTPF).to.eq(spotScaledAbove);
    });

    it("spot price below tpf with and without deviation", async () => {
        let isBelowTPF = (await poolHelper.functions["isSpotPriceBelowTpi(uint256)"](TPF_SCALED))[0];
        const spotScaledBalancer = await getSpotPriceScaled(balancerVault, weightedPool2Tokens);
        let spotScaledAbove = false;
        if (spotScaledBalancer.lt(TPF_SCALED)) {
            spotScaledAbove = true;
        }
        expect(isBelowTPF).to.eq(spotScaledAbove);

        const deviation = BigNumber.from(300); // 3%
        isBelowTPF =  (await poolHelper.functions["isSpotPriceBelowTpi(uint256,uint256)"](deviation, TPF_SCALED))[0];
        const diffScaled = deviation.mul(spotScaledBalancer).div(10_000);
        spotScaledAbove = false;
        if (spotScaledBalancer.lt(TPF_SCALED.sub(diffScaled))) {
            spotScaledAbove = true;
        }
        expect(isBelowTPF).to.eq(spotScaledAbove);
    });

    it("Is Spot Price Below TPF Lower Bound", async () => {
        const templeIndexInPool = (await poolHelper.protocolTokenIndexInBalancerPool()).toNumber();
        // skew spot price below TPF
        const targetPriceScaled = toAtto(0.95);
        const templeLotSize = await templeLotSizeForPriceTarget(balancerVault, templeIndexInPool, targetPriceScaled);
        const amountsIn: BigNumber[] = [templeLotSize, BigNumber.from(0)];
        await singleSideDeposit(balancerVault, balancerHelpers, templeWhale, amountsIn);

        expect(await poolHelper.isSpotPriceBelowTpiLowerBound(lowerBound, TPF_SCALED)).to.be.true;
        // expect spot price close to target price scaled
        const newSpotPrice = await poolHelper.getSpotPrice();
        expect(newSpotPrice).to.be.closeTo(targetPriceScaled, 100); // 0.1% approximation       
    });

    it("is spot price above TPF upper bound", async () => {
        const templeIndexInPool = (await poolHelper.protocolTokenIndexInBalancerPool()).toNumber();

        // skew spot price above TPF
        const targetPriceScaled = toAtto(1.05);
        const stableLotSize = await templeLotSizeForPriceTarget(balancerVault, templeIndexInPool, targetPriceScaled);
        let amountsIn: BigNumber[] = [BigNumber.from(0), stableLotSize];
        await singleSideDeposit(balancerVault, balancerHelpers, bbaUsdWhale, amountsIn);
        
        expect(await poolHelper.isSpotPriceAboveTpiUpperBound(upperBound, TPF_SCALED)).to.be.true;
        const newSpotPrice = await poolHelper.getSpotPrice();
        expect(newSpotPrice).to.be.closeTo(targetPriceScaled, toAtto(0.01)); // Within 1c

        // skew spot price to above TPF but below TPF+bound
        const upperBoundScaled = (BigNumber.from(upperBound)).mul(TPF_SCALED).div(10_000);
        const newTarget = TPF_SCALED.add(upperBoundScaled).sub(10); // subtract to go below TPF+bound
        const templeLotSize = await templeLotSizeForPriceTarget(balancerVault, templeIndexInPool, newTarget);
        amountsIn = [templeLotSize, BigNumber.from(0)];
        await singleSideDeposit(balancerVault, balancerHelpers, templeWhale, amountsIn);
        
        expect(await poolHelper.isSpotPriceAboveTpiUpperBound(upperBound, TPF_SCALED)).to.be.false;
        expect(await poolHelper.getSpotPrice()).to.lt(TPF_SCALED.add(upperBoundScaled));
    });

    it("will join take price below TPF lower bound", async () => {
        const lowerBound = BigNumber.from(100);
        const joinAmount = toAtto(50_000);
        const templeIndexInPool = (await poolHelper.protocolTokenIndexInBalancerPool()).toNumber();
        const stableIndexInPool = templeIndexInPool == 0 ? 1 : 0;
    
        const [, balances,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
        const newSpotPriceScaled = balances[stableIndexInPool].mul(10_000).div(balances[templeIndexInPool].add(joinAmount));
        
        const lowerBoundScaled = (lowerBound).mul(TPF_SCALED).div(10_000);
        const newTarget = TPF_SCALED.sub(lowerBoundScaled);
        const willTakePriceBelow = newSpotPriceScaled < newTarget;
        expect(await poolHelper.willJoinTakePriceBelowTpiLowerBound(joinAmount, lowerBound, TPF_SCALED)).to.eq(willTakePriceBelow);
    });

    it("will exit take price above TPF upper bound", async () => {
        const exitAmount = toAtto(50_000);
        const templeIndexInPool = (await poolHelper.protocolTokenIndexInBalancerPool()).toNumber();
        const stableIndexInPool = templeIndexInPool == 0 ? 1 : 0;
        
        const [, balances,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
        const newSpotPriceScaled = balances[stableIndexInPool].mul(10_000).div(balances[templeIndexInPool].sub(exitAmount));
        const upperBoundScaled = upperBound.mul(TPF_SCALED).div(10_000);
        const newTarget = TPF_SCALED.add(upperBoundScaled);
        const willTakePriceAbove = newSpotPriceScaled > newTarget;
        expect(await poolHelper.willExitTakePriceAboveTpiUpperBound(exitAmount, upperBound, TPF_SCALED)).to.eq(willTakePriceAbove);
    });

    it("will stable join take price above TPF upper bound", async () => {
        const joinAmount = toAtto(20_000);
        const templeIndexInPool = (await poolHelper.protocolTokenIndexInBalancerPool()).toNumber();
        const stableIndexInPool = templeIndexInPool == 0 ? 1 : 0;
    
        const [, balances,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
        const newSpotPriceScaled = balances[stableIndexInPool].add(joinAmount).mul(10_000).div(balances[templeIndexInPool]);
        const upperBoundScaled = upperBound.mul(TPF_SCALED).div(10_000);
        const newTarget = TPF_SCALED.add(upperBoundScaled);
        const willTakePriceAbove = newSpotPriceScaled > newTarget;
        expect(await poolHelper.willQuoteTokenJoinTakePriceAboveTpiUpperBound(joinAmount, upperBound, TPF_SCALED)).to.eq(willTakePriceAbove);
    });

    it("will stable exit take price below TPF lower bound", async () => {
        const exitAmount = toAtto(20_000);
        const templeIndexInPool = (await poolHelper.protocolTokenIndexInBalancerPool()).toNumber();
        const stableIndexInPool = templeIndexInPool == 0 ? 1 : 0;

        const [, balances,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
        const newSpotPriceScaled = balances[stableIndexInPool].sub(exitAmount).mul(10_000).div(balances[templeIndexInPool]);
        const lowerBoundScaled = (lowerBound).mul(TPF_SCALED).div(10_000);
        const newTarget = TPF_SCALED.sub(lowerBoundScaled);
        const willTakePriceBelow = newSpotPriceScaled < newTarget;
        expect(await poolHelper.willQuoteTokenExitTakePriceBelowTpiLowerBound(exitAmount, lowerBound, TPF_SCALED)).to.eq(willTakePriceBelow);
    });

    it("gets right balances", async () => {
        const [,balances,] = await balancerVault.getPoolTokens(TEMPLE_BB_A_USD_BALANCER_POOL_ID);
        const poolHelperBalances = await poolHelper.getBalances();
        for (let i=0; i<balances.length; i++) {
            expect(poolHelperBalances[i]).to.eq(balances[i]);
        }
    });

    it("joins pool", async () => {
        // tests in test/amo/tpf-amo.ts
    });
    it("exits pool", async () => {
        // tests in test/amo/tpf-amo.ts
    });
    it("internal validate functions", async () => {
        // tests in test/amo/tpf-amo.ts
    });
});