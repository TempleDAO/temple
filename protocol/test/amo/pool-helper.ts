import { ethers } from "hardhat";
import { expect } from "chai";
import { toAtto } from "../helpers";
import { BigNumber, Signer } from "ethers";
import amoAddresses from "./amo-constants";
import {
  AMO__IBalancerVault,
  AMO__IBalancerVault__factory, ERC20, ERC20__factory,
  IBalancerHelpers, IBalancerHelpers__factory,
  IWeightPool2Tokens,
  IWeightPool2Tokens__factory,
  PoolHelper, PoolHelper__factory, TempleERC20Token,
  TempleERC20Token__factory,
} from "../../typechain";
import { getSpotPriceScaled, ownerAddLiquidity, singleSideDepositStableToPriceTarget, singleSideDepositTempleToPriceTarget } from "./common";
import { DEPLOYED_CONTRACTS } from '../../scripts/deploys/helpers';
import { impersonateAddress, resetFork, seedTempleBbaUsdPool, swapDaiForBbaUsd } from "./common";
import { zeroAddress } from "ethereumjs-util";

const { MULTISIG, TEMPLE } = DEPLOYED_CONTRACTS.mainnet;

const { BALANCER_VAULT, BALANCER_HELPERS } = amoAddresses.contracts;
const { BALANCER_POOL_ID } = amoAddresses.others;
const { TEMPLE_WHALE, BINANCE_ACCOUNT_8, BBA_USD_WHALE } = amoAddresses.accounts;
const { DAI, TEMPLE_BBAUSD_LP_TOKEN, BBA_USD_TOKEN, BALANCER_TOKEN } = amoAddresses.tokens;

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
let balToken: ERC20;
let daiToken: ERC20;
let weightedPool2Tokens: IWeightPool2Tokens;
let templeWhale: Signer;
let daiWhale: Signer;
let templeMultisig: Signer;
let bbaUsdWhale: Signer;
let upperBound: BigNumber;
let lowerBound: BigNumber;

describe("Pool Helper", async () => {

    beforeEach(async () => {
        await resetFork(BLOCKNUMBER);
        [owner, alan] = await ethers.getSigners();
        templeWhale = await impersonateAddress(TEMPLE_WHALE);
        daiWhale = await impersonateAddress(BINANCE_ACCOUNT_8);
        bbaUsdWhale = await impersonateAddress(BBA_USD_WHALE);
        templeMultisig = await impersonateAddress(MULTISIG);

        ownerAddress = await owner.getAddress();

        templeToken = TempleERC20Token__factory.connect(TEMPLE, templeWhale);
        daiToken = ERC20__factory.connect(DAI, daiWhale);
        bptToken = ERC20__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, owner);
        bbaUsdToken = ERC20__factory.connect(BBA_USD_TOKEN, bbaUsdWhale);
        balToken = ERC20__factory.connect(BALANCER_TOKEN, owner);
        weightedPool2Tokens = IWeightPool2Tokens__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, owner);

        balancerVault = AMO__IBalancerVault__factory.connect(BALANCER_VAULT, owner);
        balancerHelpers = IBalancerHelpers__factory.connect(BALANCER_HELPERS, owner);


        poolHelper = await new PoolHelper__factory(owner).deploy(
            BALANCER_VAULT,
            TEMPLE,
            BBA_USD_TOKEN,
            bptToken.address,
            zeroAddress(),
            BALANCER_POOL_ID
        );

        const templeMultisigConnect = templeToken.connect(templeMultisig);
        await templeMultisigConnect.transfer(await templeWhale.getAddress(), toAtto(2_000_000));
        await templeMultisigConnect.transfer(ownerAddress, toAtto(2_000_000));

        // seed balancer pool
        const swapDaiAmount = toAtto(2_000_000);
        await swapDaiForBbaUsd(balancerVault, daiToken, daiWhale, swapDaiAmount, ownerAddress);
        const seedAmount = toAtto(1_000_000);
        await seedTempleBbaUsdPool(bbaUsdToken, templeToken, bptToken, balancerVault, balancerHelpers, owner, seedAmount, ownerAddress);

        await ownerAddLiquidity(
            balancerVault,
            balancerHelpers,
            bbaUsdToken,
            templeToken,
            owner,
            ownerAddress,
            ownerAddress,
            toAtto(100_000)
        );

        upperBound = BigNumber.from(400);
        lowerBound = BigNumber.from(100);
    });

    it("gets LP balances", async () => {
        const balances = await poolHelper.getBalances();
        expect(balances[0]).gt(0);
        expect(balances[1]).gt(0);
    });

    it("gets right temple stable balances", async () => {
        let balances: BigNumber[];
        [,balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
        const templeStableBalances = await poolHelper.getTempleStableBalances();
        const templeIndex = (await poolHelper.templeIndexInBalancerPool()).toNumber();
        const stableIndex = templeIndex == 0 ? 1 : 0;
        expect(templeStableBalances.templeBalance).to.eq(balances[templeIndex]);
        expect(templeStableBalances.stableBalance).to.eq(balances[stableIndex]);
    });

    it("gets spot price using lp ratio", async () => {
        let balances;
        [,balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
        const spotScaledBalancer = await getSpotPriceScaled(balancerVault, weightedPool2Tokens);
        const spotScaledPoolHelper = await poolHelper.getSpotPriceScaled();
        expect(spotScaledPoolHelper).gt(0);
        expect(spotScaledPoolHelper).lt(15_000);
        expect(spotScaledBalancer).to.eq(spotScaledPoolHelper);
    });

    it("spot price above tpf with and without deviation", async () => {
        let isAboveTPF = (await poolHelper.functions["isSpotPriceAboveTPF(uint256)"](9_700))[0];
        const spotScaledBalancer = await getSpotPriceScaled(balancerVault, weightedPool2Tokens);
        let spotScaledAbove = false;
        if (spotScaledBalancer.gt(TPF_SCALED)) {
            spotScaledAbove = true;
        }
        expect(isAboveTPF).to.eq(spotScaledAbove);

        const deviation = BigNumber.from(300); // 3%
        isAboveTPF =  (await poolHelper.functions["isSpotPriceAboveTPF(uint256,uint256)"](deviation, TPF_SCALED))[0];
        const diffScaled = deviation.mul(spotScaledBalancer).div(10_000);
        spotScaledAbove = false;
        if (spotScaledBalancer.gt(BigNumber.from(TPF_SCALED).sub(diffScaled))) {
            spotScaledAbove = true;
        }
        expect(isAboveTPF).to.eq(spotScaledAbove);
    });

    it("spot price below tpf with and without deviation", async () => {
        let isBelowTPF = (await poolHelper.functions["isSpotPriceBelowTPF(uint256)"](TPF_SCALED))[0];
        const spotScaledBalancer = await getSpotPriceScaled(balancerVault, weightedPool2Tokens);
        let spotScaledAbove = false;
        if (spotScaledBalancer.lt(TPF_SCALED)) {
            spotScaledAbove = true;
        }
        expect(isBelowTPF).to.eq(spotScaledAbove);

        const deviation = BigNumber.from(300); // 3%
        isBelowTPF =  (await poolHelper.functions["isSpotPriceBelowTPF(uint256,uint256)"](deviation, TPF_SCALED))[0];
        const diffScaled = deviation.mul(spotScaledBalancer).div(10_000);
        spotScaledAbove = false;
        if (spotScaledBalancer.lt(BigNumber.from(TPF_SCALED).sub(diffScaled))) {
            spotScaledAbove = true;
        }
        expect(isBelowTPF).to.eq(spotScaledAbove);
    });

    it("Is Spot Price Below TPF Lower Bound", async () =>{
        const spotPriceNow = await poolHelper.getSpotPriceScaled();
        const templeIndexInPool = (await poolHelper.templeIndexInBalancerPool()).toNumber();
        // skew spot price below TPF
        const targetPriceScaled = 9500;
        await singleSideDepositTempleToPriceTarget(
            balancerVault,
            balancerHelpers,
            templeWhale,
            spotPriceNow,
            templeIndexInPool,
            templeToken,
            bbaUsdToken,
            targetPriceScaled
        );
        expect(await poolHelper.isSpotPriceBelowTPFLowerBound(lowerBound, TPF_SCALED)).to.be.true;
        // expect spot price close to target price scaled
        let newSpotPrice = await poolHelper.getSpotPriceScaled();
        expect(newSpotPrice).to.be.closeTo(targetPriceScaled, 100); // 0.1% approximation       
    });

    it("is spot price above TPF upper bound", async () => {
        const templeIndexInPool = (await poolHelper.templeIndexInBalancerPool()).toNumber();
        // skew spot price above TPF
        const targetPriceScaled = 10_500;
        await singleSideDepositStableToPriceTarget(
            balancerVault,
            balancerHelpers,
            bbaUsdWhale,
            bbaUsdToken,
            templeIndexInPool,
            targetPriceScaled
        );
        expect(await poolHelper.isSpotPriceAboveTPFUpperBound(upperBound, TPF_SCALED)).to.be.true;
        const newSpotPrice = await poolHelper.getSpotPriceScaled();
        expect(newSpotPrice).to.be.closeTo(targetPriceScaled, 100); // 0.1% approximation

        // skew spot price to above TPF but below TPF+bound
        const upperBoundScaled = (BigNumber.from(upperBound)).mul(TPF_SCALED).div(10_000);
        const newTarget = BigNumber.from(TPF_SCALED).add(upperBoundScaled).sub(10); // subtract to go below TPF+bound
        await singleSideDepositTempleToPriceTarget(
            balancerVault,
            balancerHelpers,
            templeWhale,
            await poolHelper.getSpotPriceScaled(),
            templeIndexInPool,
            templeToken,
            bbaUsdToken,
            newTarget.toNumber()
        );
        expect(await poolHelper.isSpotPriceAboveTPFUpperBound(upperBound, TPF_SCALED)).to.be.false;
        expect(await poolHelper.getSpotPriceScaled()).to.lt(BigNumber.from(TPF_SCALED).add(upperBoundScaled));
    });

    it("will join take price below TPF lower bound", async () => {
        const lowerBound = BigNumber.from(100);
        const joinAmount = toAtto(50_000);
        const templeIndexInPool = (await poolHelper.templeIndexInBalancerPool()).toNumber();
        const stableIndexInPool = templeIndexInPool == 0 ? 1 : 0;
        let balances: BigNumber[];
        [, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
        const newSpotPriceScaled = balances[stableIndexInPool].mul(10_000).div(balances[templeIndexInPool].add(joinAmount));
        
        const lowerBoundScaled = (lowerBound).mul(TPF_SCALED).div(10_000);
        const newTarget = BigNumber.from(TPF_SCALED).sub(lowerBoundScaled);
        const willTakePriceBelow = newSpotPriceScaled < newTarget;
        expect(await poolHelper.willJoinTakePriceBelowTPFLowerBound(joinAmount, lowerBound, TPF_SCALED)).to.eq(willTakePriceBelow);
    });

    it("will exit take price above TPF upper bound", async () => {
        const exitAmount = toAtto(50_000);
        const templeIndexInPool = (await poolHelper.templeIndexInBalancerPool()).toNumber();
        const stableIndexInPool = templeIndexInPool == 0 ? 1 : 0;
        let balances: BigNumber[];
        [, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
        const newSpotPriceScaled = balances[stableIndexInPool].mul(10_000).div(balances[templeIndexInPool].sub(exitAmount));
        const upperBoundScaled = upperBound.mul(TPF_SCALED).div(10_000);
        const newTarget = BigNumber.from(TPF_SCALED).add(upperBoundScaled);
        const willTakePriceAbove = newSpotPriceScaled > newTarget;
        expect(await poolHelper.willExitTakePriceAboveTPFUpperBound(exitAmount, upperBound, TPF_SCALED)).to.eq(willTakePriceAbove);
    });

    it("will stable join take price above TPF upper bound", async () => {
        const joinAmount = toAtto(20_000);
        const templeIndexInPool = (await poolHelper.templeIndexInBalancerPool()).toNumber();
        const stableIndexInPool = templeIndexInPool == 0 ? 1 : 0;
        let balances: BigNumber[];
        [, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
        const newSpotPriceScaled = balances[stableIndexInPool].add(joinAmount).mul(10_000).div(balances[templeIndexInPool]);
        const upperBoundScaled = upperBound.mul(TPF_SCALED).div(10_000);
        const newTarget = BigNumber.from(TPF_SCALED).add(upperBoundScaled);
        const willTakePriceAbove = newSpotPriceScaled > newTarget;
        expect(await poolHelper.willStableJoinTakePriceAboveTPFUpperBound(joinAmount, upperBound, TPF_SCALED)).to.eq(willTakePriceAbove);
    });

    it("will stable exit take price below TPF lower bound", async () => {
        const exitAmount = toAtto(20_000);
        const templeIndexInPool = (await poolHelper.templeIndexInBalancerPool()).toNumber();
        const stableIndexInPool = templeIndexInPool == 0 ? 1 : 0;
        let balances: BigNumber[];
        [, balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
        const newSpotPriceScaled = balances[stableIndexInPool].sub(exitAmount).mul(10_000).div(balances[templeIndexInPool]);
        const lowerBoundScaled = (lowerBound).mul(TPF_SCALED).div(10_000);
        const newTarget = BigNumber.from(TPF_SCALED).sub(lowerBoundScaled);
        const willTakePriceBelow = newSpotPriceScaled < newTarget;
        expect(await poolHelper.willStableExitTakePriceBelowTPFLowerBound(exitAmount, lowerBound, TPF_SCALED)).to.eq(willTakePriceBelow);
    });

    it("gets right balances", async () => {
        let balances: BigNumber[];
        [,balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
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
});