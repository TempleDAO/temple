import { ethers, network } from "hardhat";
import { expect } from "chai";
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
  IBalancerHelpers__factory
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

describe.only("Temple Price Floor AMO", async () => {
    let amo: TPFAMO;
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

    before( async () => {
        await resetFork(15834933);
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
            await shouldThrow(connectAMO.togglePause(), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.recoverToken(TEMPLE , alanAddress, 100), /Ownable: caller is not the owner/);
            await shouldThrow(connectAMO.rebalanceDown(100, 1, true), /NotOperatorOrOwner/);
            await shouldThrow(connectAMO.rebalanceUp(100, 1),/NotOperatorOrOwner/);
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
            await expect(amo.togglePause()).to.emit(amo, "SetPauseState").withArgs(true);
            mineForwardSeconds(10_000);
            await expect(amo.rebalanceDown(100, 1, true)).to.be.revertedWith("Pausable: paused");

            // unpause
            await expect(amo.togglePause()).to.emit(amo, "SetPauseState").withArgs(false);
            amo.rebalanceDown(100, 1, true);
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

    describe.only("Liquidity", async () => {
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

        it("adds liquidity", async () => {
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
            // temporal
            let bptOut: BigNumber;
            let amountsIn: BigNumber[];
            let tx; let txx; let hash;
            [bptOut, amountsIn] = await balancerHelpers.callStatic.queryJoin(BALANCER_POOL_ID, amo.address, amo.address, joinPoolRequest);
            console.log(bptOut, amountsIn);
           
            bptOut = BigNumber.from(1);
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
            
        });
    });
});

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