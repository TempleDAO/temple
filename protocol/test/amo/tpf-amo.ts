import { ethers, network } from "hardhat";
import { expect, should } from "chai";
import { fromAtto, NULL_ADDR, toAtto, shouldThrow, mineNBlocks, mineForwardSeconds } from "../helpers";
import { BigNumber, Signer } from "ethers";
import addresses from "../constants";
import { 
  TPFAMO,
  TPFAMO__factory,
  IERC20__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  IERC20
} from "../../typechain";
//import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { DEPLOYED_CONTRACTS } from '../../scripts/deploys/helpers';

const { MULTISIG, TEMPLE, TEMPLE_V2_ROUTER } = DEPLOYED_CONTRACTS.mainnet;
const { BALANCER_VAULT } = addresses.contracts;
const { FRAX_WHALE } = addresses.accounts;
const { FRAX } = addresses.tokens;
const { DAI } = addresses.tokens;
const AURA_DEPOSIT_TOKEN = "0x1aF1cdC500A56230DF8A7Cf8099511A16D6e349e"; 
const TEMPLE_DAI_LP_TOKEN = "0x1b65fe4881800b91d4277ba738b567cbb200a60d";
const PID = 38;
const REWARDS = "0xB665b3020bBE8a9020951e9a74194c1BFda5C5c4";
const AURA_BOOSTER = "0x7818A1DA7BD1E64c199029E86Ba244a9798eEE10";
const BALANCER_POOL_ID = "0x1b65fe4881800b91d4277ba738b567cbb200a60d0002000000000000000002cc";
const ONE_ETH = ethers.utils.parseEther("1");
const TEMPLE_WHALE = "0xf6C75d85Ef66d57339f859247C38f8F47133BD39";

describe.only("Temple Price Floor AMO", async () => {
    let amo: TPFAMO;
    let owner: Signer;
    let alan: Signer;
    let operator: Signer;
    let templeMultisig: Signer;
    let fraxWhale: Signer;
    let templeWhale: Signer;
    let ownerAddress: string;
    let alanAddress: string;
    let operatorAddress: string;
    let templeToken: TempleERC20Token;
    let fraxToken: IERC20;

    before( async () => {
        await resetFork(15834933);
        [owner, alan, operator] = await ethers.getSigners();
        templeMultisig = await impersonateAddress(MULTISIG);
        templeWhale = await impersonateAddress(TEMPLE_WHALE);
        fraxWhale = await impersonateAddress(FRAX_WHALE);
    
        ownerAddress = await owner.getAddress();
        alanAddress = await alan.getAddress();
        operatorAddress = await operator.getAddress();

        templeToken = TempleERC20Token__factory.connect(TEMPLE, templeWhale);
        fraxToken = IERC20__factory.connect(FRAX, fraxWhale);
    
        amo = await new TPFAMO__factory(owner).deploy(
            BALANCER_VAULT,
            TEMPLE,
            DAI,
            MULTISIG,
            TEMPLE_DAI_LP_TOKEN,
            AURA_BOOSTER,
            200
        );

        // set params
        await amo.setBalancerPoolId(BALANCER_POOL_ID);
        //await amo.setAuraBooster(AURA_BOOSTER);
        await amo.setAuraPoolInfo(PID, AURA_DEPOSIT_TOKEN, REWARDS);
        await amo.setOperator(alanAddress);
        await amo.setCoolDown(1800); // 30 mins
        await amo.setTemplePriceFloorRatio(9700);
        await amo.setRebalanceRateChangeNumerator(300); // 3%
        const cappedAmounts = {
            temple: BigNumber.from(100),
            bpt: BigNumber.from(100),
            stable: BigNumber.from(100)
        }
        await amo.setCappedRebalanceAmounts(cappedAmounts);
        await amo.setPostRebalanceSlippage(100, 100); // 1%
        await amo.setLastRebalanceAmounts(ONE_ETH, ONE_ETH, ONE_ETH); // start with 1 eth

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
            await shouldThrow(connectAMO.setBalancerPoolId(BALANCER_POOL_ID), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setAuraPoolInfo(PID, AURA_DEPOSIT_TOKEN, REWARDS), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setOperator(alanAddress), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setCoolDown(1800), /Ownable: caller is not the owner/); // 30 mins
            await shouldThrow(connectAMO.setTemplePriceFloorRatio(9700), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setRebalanceRateChangeNumerator(300), /Ownable: caller is not the owner/); // 3%
            const cappedAmounts = {
                temple: BigNumber.from(100),
                bpt: BigNumber.from(100),
                stable: BigNumber.from(100)
            }
            await shouldThrow(connectAMO.setCappedRebalanceAmounts(cappedAmounts), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.setPostRebalanceSlippage(100, 100), /Ownable: caller is not the owner/); // 1%
            await shouldThrow(connectAMO.setLastRebalanceAmounts(ONE_ETH, ONE_ETH, ONE_ETH), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.pause(), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.unpause(), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.recoverToken(TEMPLE , alanAddress, 100), /Ownable: caller is not the owner/);
            //await expect(connectAMO.rebalanceDown(100, 1, true, true)).to.be.revertedWithCustomError(connectAMO, "NotOperatorOrOwner");
            //await expect(connectAMO.rebalanceUp(100, 1)).to.be.revertedWithCustomError(connectAMO, "NotOperatorOrOwner");
            await shouldThrow(connectAMO.depositStable(100, 1), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.withdrawstable(100, 1), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.depositAndStake(100), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.depositAllAndStake(), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.withdraw(100, true), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.withdrawAll(true), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.withdrawAllAndUnwrap(true), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.withdrawAndUnwrap(100, true), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.addLiquidity(joinPoolRequest, 1, true), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.removeLiquidity(exitPoolRequest, 100), /Ownable: caller is not the owner/);

            // passes

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
            await expect(amo.setAuraPoolInfo(PID, AURA_DEPOSIT_TOKEN, REWARDS))
                .to.emit(amo, "SetAuraPoolInfo").withArgs(PID, AURA_DEPOSIT_TOKEN, REWARDS);
            const auraPoolInfo = await amo.auraPoolInfo();
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
            await amo.pause();
            mineForwardSeconds(10_000);
            await expect(amo.rebalanceDown(100, 1, true, true)).to.be.revertedWith("Pausable: paused");

            // unpause
            await amo.unpause();
            amo.rebalanceDown(100, 1, true, true);
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

    describe("Liquidity", async () => {
        it("adds liquidity", async () => {

        });
    });
});


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