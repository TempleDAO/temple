import { ethers, network } from "hardhat";
import { expect, should } from "chai";
import { toAtto, shouldThrow, mineForwardSeconds, blockTimestamp } from "../helpers";
import { BigNumber, Contract, ContractReceipt, Signer } from "ethers";
import addresses from "../constants";
import amoAddresses from "./amo-constants";
import { 
  AMOIAuraGaugeController,
  AMOIBalancerAuthorizerAdapter,
  AMOIBalancerVault,
  AMOIBalancerVault__factory,
  AMOIBalancerVotingEscrow, AMOIGaugeAdder,
  AMOILiquidityGaugeFactory, AMOIPoolManagerProxy,
  AMOIPoolManagerV3, AuraStaking, IAuraBooster,
  IBalancerHelpers, IBalancerHelpers__factory, IBaseRewardPool, IERC20,
  IERC20__factory, IWeightPool2Tokens,
  IWeightPool2Tokens__factory,
  PoolHelper, PoolHelper__factory, TempleERC20Token,
  TempleERC20Token__factory, TPFAMO,
  TPFAMO__factory
} from "../../typechain";
import { getSpotPriceScaled, ownerAddLiquidity } from "./common";
import { DEPLOYED_CONTRACTS } from '../../scripts/deploys/helpers';
import { impersonateAddress, resetFork, seedTempleBbaUsdPool, swapDaiForBbaUsd } from "./common";

const { MULTISIG, TEMPLE } = DEPLOYED_CONTRACTS.mainnet;

const { BALANCER_VAULT, BALANCER_HELPERS } = amoAddresses.contracts;
const { BALANCER_POOL_ID } = amoAddresses.others;
const { TEMPLE_WHALE, BINANCE_ACCOUNT_8, BBA_USD_WHALE } = amoAddresses.accounts;
const { DAI, TEMPLE_BBAUSD_LP_TOKEN, BBA_USD_TOKEN, BALANCER_TOKEN } = amoAddresses.tokens;

const TPF_SCALED = 9_700;
const ONE_ETH = toAtto(1);
const BLOCKNUMBER = 15862300;

let poolHelper: PoolHelper;
let owner: Signer;
let alan: Signer;
let ownerAddress: string;
let bptToken: IERC20;
let balancerHelpers: IBalancerHelpers;
let balancerVault: AMOIBalancerVault;
let bbaUsdToken: IERC20;
let templeToken: TempleERC20Token;
let balToken: IERC20;
let daiToken: IERC20;
let weightedPool2Tokens: IWeightPool2Tokens;
let templeWhale: Signer;
let daiWhale: Signer;
let templeMultisig: Signer;
let bbaUsdWhale: Signer;

describe.only("Pool Helper", async () => {

    beforeEach(async () => {
        await resetFork(BLOCKNUMBER);
        [owner, alan] = await ethers.getSigners();
        templeWhale = await impersonateAddress(TEMPLE_WHALE);
        daiWhale = await impersonateAddress(BINANCE_ACCOUNT_8);
        bbaUsdWhale = await impersonateAddress(BBA_USD_WHALE);
        templeMultisig = await impersonateAddress(MULTISIG);

        ownerAddress = await owner.getAddress();

        templeToken = TempleERC20Token__factory.connect(TEMPLE, templeWhale);
        daiToken = IERC20__factory.connect(DAI, daiWhale);
        bptToken = IERC20__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, owner);
        bbaUsdToken = IERC20__factory.connect(BBA_USD_TOKEN, bbaUsdWhale);
        balToken = IERC20__factory.connect(BALANCER_TOKEN, owner);
        weightedPool2Tokens = IWeightPool2Tokens__factory.connect(TEMPLE_BBAUSD_LP_TOKEN, owner);

        balancerVault = AMOIBalancerVault__factory.connect(BALANCER_VAULT, owner);
        balancerHelpers = IBalancerHelpers__factory.connect(BALANCER_HELPERS, owner);

        poolHelper = await new PoolHelper__factory(owner).deploy(
            BALANCER_VAULT,
            TEMPLE,
            BALANCER_POOL_ID
        );

        await poolHelper.setTemplePriceFloorRatio(TPF_SCALED);

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
    });

    it("admin tests", async () => {
        const alanConnect = poolHelper.connect(alan);
        // fails
        await shouldThrow(alanConnect.setTemplePriceFloorRatio(1_000), /Ownable: caller is not the owner/);

        // success
        await poolHelper.setTemplePriceFloorRatio(TPF_SCALED);
    })

    it ("sets tpf ratio", async () => {
        await expect(poolHelper.setTemplePriceFloorRatio(TPF_SCALED))
            .to.emit(poolHelper, "SetTemplePriceFloorRatio")
            .withArgs(TPF_SCALED, 10_000);
        const tpf =  await poolHelper.templePriceFloorRatio();
        expect(tpf.numerator).to.eq(TPF_SCALED);
    });

    it("gets LP balances", async () => {
        const balances = await poolHelper.getBalances();
        expect(balances[0]).gt(0);
        expect(balances[1]).gt(0);
    });

    it("gets spot price using lp ratio", async () => {
        console.log(await poolHelper.balancerPoolId());
       
        let balances;
        [,balances,] = await balancerVault.getPoolTokens(BALANCER_POOL_ID);
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

    it("gets max", async () => {
        const max = await poolHelper.getMax(1, 2);
        expect(max).to.eq(2);
    });
});