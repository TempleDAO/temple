import { ethers } from "hardhat";
import { expect } from "chai";

import { TempleERC20Token } from "../typechain/TempleERC20Token";
import { FakeERC20 } from "../typechain/FakeERC20";
import { TempleTreasury } from "../typechain/TempleTreasury";
import { TempleERC20Token__factory } from "../typechain/factories/TempleERC20Token__factory";
import { FakeERC20__factory } from "../typechain/factories/FakeERC20__factory";
import { TempleTreasury__factory } from "../typechain/factories/TempleTreasury__factory";
import { TestTreasuryAllocation__factory } from "../typechain/factories/TestTreasuryAllocation__factory";
import { BigNumber, BigNumberish, ContractTransaction, Overrides, Signer } from "ethers";
import { fromAtto, shouldThrow, toAtto } from "./helpers";
import { TestTreasuryAllocation } from "../typechain/TestTreasuryAllocation";
import { TreasuryManagementProxy, TreasuryManagementProxy__factory } from "../typechain";

describe("Temple Treasury management", async () => {
  let TEMPLE: TempleERC20Token;
  let STABLEC: FakeERC20;
  let TREASURY: TempleTreasury;
  let treasuryManagement: TreasuryManagementProxy;
  let owner: Signer;
  let nonOwner: Signer;

 
  beforeEach(async () => {
    [owner, nonOwner] = await ethers.getSigners();

    TEMPLE = await new TempleERC20Token__factory(owner).deploy()
    STABLEC = await new FakeERC20__factory(owner).deploy("STABLEC", "STABLEC");
    TREASURY = await new TempleTreasury__factory(owner).deploy(
        TEMPLE.address,
        STABLEC.address,
    );

    treasuryManagement = await new TreasuryManagementProxy__factory(owner).deploy(
      await owner.getAddress(),
      TREASURY.address,
    )

    TEMPLE.addMinter(TREASURY.address);
    await Promise.all([
      STABLEC.mint(await owner.getAddress(), toAtto(10000)),
      STABLEC.mint(await nonOwner.getAddress(), toAtto(10000)),
    ]);
  })

  it("Only owner can seed, and seed once", async () => {
    await shouldThrow(TREASURY.connect(nonOwner).seedMint(100,100), /Ownable: caller is not the owner/);

    // owner needs to allocate allowance before seeding
    await shouldThrow(TREASURY.seedMint(100,100), /ERC20: transfer amount exceeds allowance/);

    // owner can seed once
    const ownerAddress = await owner.getAddress()
    STABLEC.increaseAllowance(TREASURY.address, 100);
    expect(await TREASURY.intrinsicValueRatio()).to.deep.eq([0,0].map(BigNumber.from))
    await TREASURY.seedMint(100,100);
    expect(await TREASURY.intrinsicValueRatio()).to.deep.eq([100,100].map(BigNumber.from))
    expect(await TEMPLE.balanceOf(ownerAddress)).eq(100);
    expect(await TREASURY.seeded()).eq(true);
    await shouldThrow(TREASURY.seedMint(100,100), /Owner has already seeded treasury/);
  });

  type HarvestTestFacade = (distributionPercent: BigNumberish, overrides?: Overrides & { from?: string | Promise<string> }) => Promise<ContractTransaction>

  // helper to run the same test with and without the managgement proxy
  const withAndWithoutProxyVariants = (testCase: (treasury: TempleTreasury, mgmt: TreasuryManagementProxy, harvest: HarvestTestFacade) => Promise<void>) => {
    it("withProxy", async () => {
      await STABLEC.increaseAllowance(TREASURY.address, toAtto(100));
      await TREASURY.seedMint(toAtto(100),toAtto(1000));
      await TREASURY.transferOwnership(treasuryManagement.address);

      // facade for harvest which uses treasuryManagement (but first updates
      // % of harvest). Always called as owner
      async function harvestTestFacade(
          distributionPercent: BigNumberish,
          overrides?: Overrides & { from?: string | Promise<string> }
          ): Promise<ContractTransaction> {
       
        await treasuryManagement.setHarvestDistributionPercentage(distributionPercent);
        return await treasuryManagement.harvest();
      }
      
      await testCase(TREASURY, treasuryManagement, harvestTestFacade);
    })

    it("withoutProxy", async () => {
      await STABLEC.increaseAllowance(TREASURY.address, toAtto(100));
      await TREASURY.seedMint(toAtto(100),toAtto(1000));
      await testCase(TREASURY, TREASURY as unknown as TreasuryManagementProxy, TREASURY.harvest.bind(TREASURY));
    })
  }

  describe("Only owners can mint and allocate TEMPLE", async () => {
    withAndWithoutProxyVariants(async (treasury: TempleTreasury, mgmt: TreasuryManagementProxy, harvest: HarvestTestFacade) => {
      const nonOwnerAddress = await nonOwner.getAddress()

      // Only owner can add or inccrease minted temple allocated
      await shouldThrow(mgmt.connect(nonOwner).mintAndAllocateTemple(nonOwnerAddress, toAtto(500)), /caller is not the owner/);
      await mgmt.mintAndAllocateTemple(nonOwnerAddress, toAtto(500));
      expect(fromAtto(await TEMPLE.allowance(await treasury.MINT_ALLOWANCE(), nonOwnerAddress))).eq(500);
      await shouldThrow(mgmt.connect(nonOwner).mintAndAllocateTemple(nonOwnerAddress, toAtto(500)), /caller is not the owner/);
      await mgmt.mintAndAllocateTemple(nonOwnerAddress, toAtto(500));
      expect(fromAtto(await TEMPLE.allowance(await treasury.MINT_ALLOWANCE(), nonOwnerAddress))).eq(1000);

      // Minted temple sits in the mint allowance contract, and doesn't effect IV
      expect(fromAtto(await TEMPLE.allowance(await treasury.MINT_ALLOWANCE(), nonOwnerAddress))).eq(1000);
      expect(fromAtto(await TEMPLE.balanceOf(nonOwnerAddress))).eq(0);
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(1/10);

      // Once we pull minted temple, this will effect the IV
      await TEMPLE.connect(nonOwner).transferFrom(await treasury.MINT_ALLOWANCE(), nonOwnerAddress, toAtto(500));
      expect(fromAtto(await TEMPLE.allowance(await treasury.MINT_ALLOWANCE(), nonOwnerAddress))).eq(500);
      expect(fromAtto(await TEMPLE.balanceOf(nonOwnerAddress))).eq(500);
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(1/10);
      await mgmt.resetIV()
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(1/15);

      // Only owner can remove and burn unallocated temple
      await shouldThrow(mgmt.connect(nonOwner).unallocateAndBurnUnusedMintedTemple(nonOwnerAddress), /caller is not the owner/);
      await mgmt.unallocateAndBurnUnusedMintedTemple(nonOwnerAddress);
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(1/15); // no change to IV
      expect(fromAtto(await TEMPLE.balanceOf(nonOwnerAddress))).eq(500);
      expect(fromAtto(await TEMPLE.allowance(await treasury.MINT_ALLOWANCE(), nonOwnerAddress))).eq(0);
    })
  });

  describe("Minting and allocating temple shouldn't change IV", async () => {
    withAndWithoutProxyVariants(async (treasury: TempleTreasury, mgmt: TreasuryManagementProxy, harvest: HarvestTestFacade) => {
      const nonOwnerAddress = await nonOwner.getAddress()

      await mgmt.mintAndAllocateTemple(nonOwnerAddress, toAtto(500));
      expect(fromAtto(await TEMPLE.allowance(await treasury.MINT_ALLOWANCE(), nonOwnerAddress))).eq(500);
      const iv = toRatio(await treasury.intrinsicValueRatio());
      await harvest(0);
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(iv);
    });
  });

  describe("Only owners can allocate STABLEC", async () => {
    withAndWithoutProxyVariants(async (treasury: TempleTreasury, mgmt: TreasuryManagementProxy, harvest: HarvestTestFacade) => {
      const treasuryAllocation = await new TestTreasuryAllocation__factory(owner).deploy(STABLEC.address);

      // Only owner can add pool
      await shouldThrow(mgmt.connect(nonOwner).allocateTreasuryStablec(treasuryAllocation.address, toAtto(10)), /caller is not the owner/);
      await mgmt.allocateTreasuryStablec(treasuryAllocation.address, toAtto(10));

      // STABLEC should be transferred immediately on allocation
      expect(fromAtto(await treasuryAllocation.reval())).eq(10);
      expect(fromAtto(await STABLEC.balanceOf(treasuryAllocation.address))).eq(10);

      // Allocated STABLEC shouldn't effect IV, unless we decide to update the book value
      // simulated in test by spending STABLEC.
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(1/10);
      await treasuryAllocation.transfer(await owner.getAddress(), toAtto(5));
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(1/10);
      await mgmt.updateMarkToMarket(treasuryAllocation.address);
      await mgmt.resetIV();
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(95/1000);

      // STABLEC returned to treasury shouldn't effect IV
      await treasuryAllocation.increaseAllowance(treasury.address, toAtto(5));
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(95/1000);
      await mgmt.updateMarkToMarket(treasuryAllocation.address);
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(95/1000);
      await mgmt.withdraw(treasuryAllocation.address);
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(95/1000);
      await mgmt.resetIV();
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(95/1000);
    });
  });

  describe("Only owners can unsafe withdraw", async () => {
    withAndWithoutProxyVariants(async (treasury: TempleTreasury, mgmt: TreasuryManagementProxy, harvest: HarvestTestFacade) => {
      const treasuryAllocation = await new TestTreasuryAllocation__factory(owner).deploy(STABLEC.address);
      await mgmt.allocateTreasuryStablec(treasuryAllocation.address, toAtto(10));

      // Only owner should be able to eject a treasury allocation (to be used to recover funds)
      // when a treasury allocation contract stops working how we expect
      await shouldThrow(mgmt.connect(nonOwner).ejectTreasuryAllocation(treasuryAllocation.address), /caller is not the owner/);

      // Unsafe withdraw should hard reset all STABLEC allocations for the contract
      await treasuryAllocation.increaseAllowance(treasury.address, toAtto(10));
      expect(fromAtto(await treasury.totalAllocationStablec())).eq(10);
      expect(fromAtto(await treasury.treasuryAllocationsStablec(treasuryAllocation.address))).eq(10);
      await mgmt.ejectTreasuryAllocation(treasuryAllocation.address);
      expect(fromAtto(await treasury.totalAllocationStablec())).eq(0);
      expect(fromAtto(await treasury.treasuryAllocationsStablec(treasuryAllocation.address))).eq(0);

      // The above test should have no change to IV (just updating book keeping)
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(1/10);
      await mgmt.resetIV();
      expect(toRatio(await treasury.intrinsicValueRatio())).eq(1/10);
    });
  });

  describe("Only owners can add or remove pools", async () => {
    withAndWithoutProxyVariants(async (treasury: TempleTreasury, mgmt: TreasuryManagementProxy, harvest: HarvestTestFacade) => {
      const nonOwnerAddress = await nonOwner.getAddress()

      // Only owner can set/change a pool's share of harvest
      await shouldThrow(mgmt.connect(nonOwner).upsertPool(nonOwnerAddress, 1), /caller is not the owner/);
      await mgmt.upsertPool(nonOwnerAddress, 1);
      expect(await treasury.poolHarvestShare(nonOwnerAddress)).eq(1);
      expect(await treasury.totalHarvestShares()).eq(1);

      // Only owner can change a pool's share of harvest
      await shouldThrow(mgmt.connect(nonOwner).upsertPool(nonOwnerAddress, 2), /caller is not the owner/);
      await mgmt.upsertPool(nonOwnerAddress, 2);
      expect(await treasury.poolHarvestShare(nonOwnerAddress)).eq(2);
      expect(await treasury.totalHarvestShares()).eq(2);

      // Pools must have a share > 0
      await shouldThrow(mgmt.upsertPool(nonOwnerAddress, 0), /Harvest share must be > 0/);

      // Only treasury can remove a pool completely (effectively 
      // setting it's share to 0, and removing the contract from the
      // list of contracts that get distributed too)
      await shouldThrow(mgmt.connect(nonOwner).removePool(0, nonOwnerAddress), /caller is not the owner/);
      await shouldThrow(mgmt.removePool(1, nonOwnerAddress), /No pool at the specified index/);
      await shouldThrow(mgmt.removePool(0, await owner.getAddress()), /Pool at index and passed in address don't match/);
      await mgmt.removePool(0, nonOwnerAddress);
      expect(await treasury.poolHarvestShare(nonOwnerAddress)).eq(0);
      expect(await treasury.totalHarvestShares()).eq(0);
    });
  });

  describe("Adding/Remove multiple pools", async () => {
    withAndWithoutProxyVariants(async (treasury: TempleTreasury, mgmt: TreasuryManagementProxy, harvest: HarvestTestFacade) => {
      const pools: string[] = await Promise.all((await ethers.getSigners()).slice(3).map(s => s.getAddress()));
      const poolHarvestShare: { [key: string]: number; } = {}

      let expectedTotalHarvestShares = 0;
      for (let i = 1; i < pools.length; i++) {
        await mgmt.upsertPool(pools[i], 10*i);
        expectedTotalHarvestShares += 10*i;
        poolHarvestShare[pools[i]] = 10*i;
      }

      // check all pools exist
      for (let i = 1; i < pools.length; i++) {
        const addr = await treasury.pools(i-1);
        expect(addr).not.eq("");
        expect(await treasury.poolHarvestShare(addr)).eq(i*10);
      }

      // check bookkeeping of totalHarvestShare
      expect(await treasury.totalHarvestShares()).eq(expectedTotalHarvestShares);

      // Update first 4 pools share of harvest, and check the changes propogate as expected
      for (let i = 1; i < 5; i++) {
        await mgmt.upsertPool(pools[i], 5);
        expectedTotalHarvestShares = expectedTotalHarvestShares - 10*i + 5;
        poolHarvestShare[pools[i]] = 5;
      }

      // re-check pool shares
      for (let i = 1; i < 5; i++) {
        const addr = await treasury.pools(i-1);
        expect(await treasury.poolHarvestShare(addr)).eq(5);
      }
      expect(await treasury.totalHarvestShares()).eq(expectedTotalHarvestShares);

      // Closeout all pools, checking conditions along the way
      for (let i = 1; i < pools.length; i++) {
        const poolAddress = await treasury.pools(0);
        await mgmt.removePool(0, poolAddress);

        expectedTotalHarvestShares -= poolHarvestShare[poolAddress];
        expect(await treasury.poolHarvestShare(poolAddress)).eq(0);
        expect(await treasury.totalHarvestShares()).eq(expectedTotalHarvestShares)
      }
      await shouldThrow(treasury.pools(0), /Transaction reverted without a reason/);
    });
  });
});

describe("Temple Treasury Mechanics", async () => {
  let TEMPLE: TempleERC20Token;
  let STABLEC: FakeERC20;
  let TREASURY: TempleTreasury;
  let owner: Signer;
  let nonOwner: Signer;

  // used in tests to verify calcs
  let totalTemple: number
  let totalDai: number

  beforeEach(async () => {
    [owner, nonOwner] = await ethers.getSigners();

    TEMPLE = await new TempleERC20Token__factory(owner).deploy()
    STABLEC = await new FakeERC20__factory(owner).deploy("STABLEC", "STABLEC");
    TREASURY = await new TempleTreasury__factory(owner).deploy(
        TEMPLE.address,
        STABLEC.address,
    );

    await Promise.all([
      TEMPLE.addMinter(TREASURY.address),
      TEMPLE.addMinter(await owner.getAddress()),
      STABLEC.mint(await owner.getAddress(), 10000),
      STABLEC.mint(await nonOwner.getAddress(), 10000),
      STABLEC.connect(owner).increaseAllowance(TREASURY.address, 10000),
    ]);

    totalDai = 100;
    totalTemple = 1000;
    await TREASURY.seedMint(totalDai, totalTemple);
  })

  const mint = async (to: Signer, daiPaid: number) => {
    const iv = await TREASURY.intrinsicValueRatio();
    const ivMultiple = 2; // for test mints, we set the IV multiple two double IV
    const templeMinted = daiPaid / (iv.stablec.toNumber() /iv.temple.toNumber() * ivMultiple);

    totalDai += daiPaid;
    totalTemple += templeMinted;

    await STABLEC.connect(to).transfer(TREASURY.address, daiPaid);
    await TEMPLE.mint(await to.getAddress(), templeMinted.toFixed(0));
  }

  it("Calculate harvest", async () => {
    const toNumber = (x:BigNumber) => x.toNumber();

    let totalHarvestTemple = 0;
    const harvestAndCheck = async (harvestPercentage: number, expectedHarvestIncreaseTemple: number) => {
      await TREASURY.harvest(harvestPercentage);

      totalTemple += expectedHarvestIncreaseTemple;
      totalHarvestTemple += expectedHarvestIncreaseTemple;

      expect((await TREASURY.intrinsicValueRatio()).map(toNumber)).eql([totalDai, totalTemple]);
      expect(await TREASURY.harvestedRewardsTemple()).eq(totalHarvestTemple);
    }

    // calling harvest when there has been no new mint should have no effect
    await harvestAndCheck(0, 0);
    await harvestAndCheck(100, 0);

    // exchange 100 stablec for temple, and harvest 100% of IV growth in rewards
    await mint(nonOwner, 100);
    await harvestAndCheck(100, 500);

    // exchange 100 stablec for temple, and harvest 50% of IV growth in rewards
    await mint(nonOwner, 100);
    await harvestAndCheck(50, 250);

    // Each mint to date has been 1 dai for 5 temple, the next will be 1:4.58
    // (that is IV has increased). If we harvest 0% of IV, IV should grow
    // by the amount of temple minted
    await mint(nonOwner, 120);
    await harvestAndCheck(0, 0);

    // If (for whatever reason) TEMPLE is transferred into treasury that isn't
    // accounted for explicitly, burn it. This will increase IV (depending
    // on what portion of supply decrease is harvested)
    await TEMPLE.transfer(TREASURY.address, 100); 
    totalTemple -= 100;
    await harvestAndCheck(0, 0);

    totalTemple -= 100;
    await TEMPLE.transfer(TREASURY.address, 100); 
    await harvestAndCheck(100, 100);

    // 30%
    totalTemple -= 100;
    await TEMPLE.transfer(TREASURY.address, 100); 
    await harvestAndCheck(30, 30);

    // If IV Drops, harvest should fail, until we reset IV
    await TEMPLE.mint(await nonOwner.getAddress(), 100); 
    await shouldThrow(TREASURY.harvest(50), /Cannot run harvest when IV drops/);
    await TREASURY.resetIV();
    totalTemple += 100;
    await harvestAndCheck(0, 0);
  });

  it("Distribute Harvest", async () => {
    // Setup - mint and harvest all IV increase as rewards
    await mint(nonOwner, 600);
    await TREASURY.harvest(100);
    const rewardsHarvested = 3000;
    expect(await TREASURY.harvestedRewardsTemple()).eq(rewardsHarvested);

    const pool: TestTreasuryAllocation[] = [];

    // Setup - add a few strategies
    let totalHarvestShares = 0;
    for (let i = 0; i < 3; i++) {
      pool.push(await new TestTreasuryAllocation__factory(owner).deploy(STABLEC.address));
      await TREASURY.upsertPool(pool[i].address, (i+1) * 100);
      totalHarvestShares += (i+1) * 100;
    }
    expect(await TREASURY.totalHarvestShares()).eq(totalHarvestShares);

    // Check distribution
    await TREASURY.distributeHarvest();
    for (let i = 0; i < 3; i++) {
      expect((await TEMPLE.balanceOf(pool[i].address)).toNumber()).eq((rewardsHarvested * ((i+1)*100)) / totalHarvestShares);
    }
    expect(await TREASURY.harvestedRewardsTemple()).eq(0);
  });

  it("Can migrate treasury", async () => {
    const alloc = await new TestTreasuryAllocation__factory(owner).deploy(STABLEC.address);
    await STABLEC.mint(await owner.getAddress(), toAtto(1000000000))
    await STABLEC.transfer(TREASURY.address, toAtto(1000000000));
    const treasuryStablec = await STABLEC.balanceOf(TREASURY.address);

    await TREASURY.allocateTreasuryStablec(alloc.address, await STABLEC.balanceOf(TREASURY.address));
    expect(fromAtto(await STABLEC.balanceOf(TREASURY.address))).eq(0);
    expect(await STABLEC.balanceOf(alloc.address)).eql(treasuryStablec);
  });
});

describe("Temple Treasury Scenarios", async () => {
  let TEMPLE: TempleERC20Token;
  let DAI: FakeERC20;
  let TREASURY: TempleTreasury;
  let owner: Signer;
  let nonOwner: Signer;

  beforeEach(async () => {
    [owner, nonOwner] = await ethers.getSigners();

    TEMPLE = await new TempleERC20Token__factory(owner).deploy()
    DAI = await new FakeERC20__factory(owner).deploy("DAI", "DAI");
    TREASURY = await new TempleTreasury__factory(owner).deploy(
        TEMPLE.address,
        DAI.address,
    );

    await Promise.all([
      TEMPLE.addMinter(TREASURY.address),
      TEMPLE.addMinter(await owner.getAddress()),
      DAI.mint(await owner.getAddress(), toAtto(10000)),
      DAI.mint(await nonOwner.getAddress(), toAtto(10000)),
      DAI.connect(owner).increaseAllowance(TREASURY.address, toAtto(10000)),
    ]);

    await TREASURY.seedMint(toAtto(100), toAtto(1000));
  })

  interface AddPool {kind: 'add-pool', share: number} 
  interface RemovePool {kind: 'remove-pool', idx: number} 
  interface Harvest {kind: 'harvest', inflowDai: number, inflowTemple: number, distributePercentage: number, newIV: number} 
  interface Distribute {kind: 'distribute'} 

  const addPool = (share: number): AddPool => ({kind: 'add-pool', share})
  const removePool = (idx: number): RemovePool => ({kind: 'remove-pool', idx})
  const harvest = (inflowDai: number, inflowTemple: number, distributePercentage: number, newIV: number): Harvest =>
    ({kind: 'harvest', inflowDai, inflowTemple, distributePercentage, newIV})
  const distribute = (): Distribute => ({kind: 'distribute'})

  // description | share of each harvest pool | time series of dai,temple,newIV
  const cases: [string, (AddPool | RemovePool | Harvest | Distribute)[]][] = [
    ["No pools", [
      harvest(100, 600, 0, 0.125),
      harvest(200, 400, 0, 0.2),
      distribute(),
      harvest(200, 400, 100, 0.2),
      distribute(),
    ] ],
    ["One pools gets 20% of harvest", [
      addPool(1),
      harvest(100, 600, 20, 0.119047619),
      harvest(200, 400, 20, 0.1712328767),
      distribute(),
      harvest(200, 400, 20, 0.207641196),
      distribute(),
    ] ],
    ["5 pool, varying shares 60% of harvest", [
      addPool(1), addPool(2), addPool(3), addPool(4), addPool(5),
      harvest(100, 600, 60, 0.1086956522),
      harvest(200, 400, 60, 0.1288659794),
      distribute(),
      harvest(200, 400, 60, 0.143020595),
      distribute(),
    ] ],
    // TODO: Add more
  ];

  for (const c of cases) {
    const [description, actions] = c
    it(description, async () => {
      // address, share, balance
      const pools: [string, number, number][] = [];
      let totalShares = 0;

      for (const a of actions) {
        switch (a.kind) {
          case 'add-pool':
            pools.push([await (await ethers.Wallet.createRandom()).getAddress(), a.share, 0])
            await TREASURY.upsertPool(await pools[pools.length-1][0], a.share);
            totalShares += a.share;
            break;
          case 'remove-pool':
            await TREASURY.removePool(a.idx, pools[a.idx][0]);
            const [[_ ,share, _1]] = pools.splice(a.idx, 1);
            totalShares -= share;
            break;
          case 'harvest':
            await DAI.mint(TREASURY.address, toAtto(a.inflowDai));
            await TEMPLE.mint(await owner.getAddress(), toAtto(a.inflowTemple));
            await TREASURY.harvest(a.distributePercentage);
            {
              const [dai,temple] = await TREASURY.intrinsicValueRatio();
              expect(a.newIV, `Unexpected IV after harvest(${a.distributePercentage})`).approximately(fromAtto(dai) / fromAtto(temple), 1e-5);
            }
            break;
          case 'distribute':
            const undistributedHarvest = fromAtto(await TREASURY.harvestedRewardsTemple());
            await TREASURY.distributeHarvest();

            for (const p of pools) {
              const [address, share, oldBalance] = p;
              const expectedIncrease = (undistributedHarvest * share / totalShares);
              expect(fromAtto(await TEMPLE.balanceOf(address))).approximately(oldBalance + expectedIncrease, 1e-5)
              p[2] = oldBalance + expectedIncrease;
            }
            break;
        }
      }
    })
  }
});

function toRatio(iv: [BigNumber, BigNumber]): number {
  const [stablec,temple] = iv;
  return fromAtto(stablec) / fromAtto(temple);
}
