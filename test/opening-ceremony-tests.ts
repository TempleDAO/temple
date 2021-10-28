import { expect } from "chai";
import { BigNumber, Signer } from "ethers";
import { ethers } from "hardhat";
import { isTemplateLiteralToken } from "typescript";
import { expectAddressWithPrivateKey } from "../scripts/deploys/helpers";
import { 
  ExitQueue,
  ExitQueue__factory,
  FakeERC20,
  FakeERC20__factory,
  LockedOGTemple,
  LockedOGTemple__factory,
  OpeningCeremony, 
  OpeningCeremony__factory, 
  SandalwoodToken, 
  SandalwoodToken__factory, 
  TempleERC20Token, 
  TempleERC20Token__factory, 
  TempleStaking, 
  TempleStaking__factory, 
  TempleTreasury, 
  TempleTreasury__factory, 
  TreasuryManagementProxy, 
  TreasuryManagementProxy__factory 
} from "../typechain";
import { blockTimestamp, fromAtto, mineToEpoch, shouldThrow, toAtto } from "./helpers";


describe("Test Opening Ceremony", async () => {
   const EPOCH_SIZE: number = 600;
   const MINT_MULTIPLE: number = 6;
   const UNLOCK_DELAY_SECONDS: number = 10;
   const HARVEST_THRESHOLD: BigNumber = toAtto(10000);
   const BONUS_FACTOR: {numerator: number, denominator: number} = { numerator: 51879, denominator: 100000};

   let stablecToken: FakeERC20;
   let sandalwoodToken: SandalwoodToken;
   let templeToken: TempleERC20Token;
   let treasury: TempleTreasury;
   let treasuryManagement: TreasuryManagementProxy;
   let exitQueue: ExitQueue
   let staking: TempleStaking;
   let lockedOGTemple: LockedOGTemple;
   let openingCeremony: OpeningCeremony;

   let owner: Signer;
   let stakers: Signer[];

   beforeEach(async () => {
    [owner] = (await ethers.getSigners()) as Signer[];

    stablecToken = await new FakeERC20__factory(owner).deploy("STABLCEC", "STABLCEC");
    templeToken = await new TempleERC20Token__factory(owner).deploy()
    sandalwoodToken = await new SandalwoodToken__factory(owner).deploy()
    
    treasury = await new TempleTreasury__factory(owner).deploy(templeToken.address, stablecToken.address);
    treasuryManagement = await new TreasuryManagementProxy__factory(owner).deploy(
      await owner.getAddress(),
      treasury.address);

    exitQueue = await new ExitQueue__factory(owner).deploy(
      templeToken.address,
      200, /* max per epoch */
      100, /* max per address per epoch */
      EPOCH_SIZE,
    )
     
    staking = await new TempleStaking__factory(owner).deploy(
      templeToken.address,
      exitQueue.address,
      EPOCH_SIZE,
      (await blockTimestamp()) - 1,
    );
    await staking.setEpy(1,100);

    lockedOGTemple = await new LockedOGTemple__factory(owner).deploy(await staking.OG_TEMPLE());

    openingCeremony = await new OpeningCeremony__factory(owner).deploy(
      stablecToken.address,
      templeToken.address,
      sandalwoodToken.address,
      staking.address,
      lockedOGTemple.address,
      treasury.address,
      treasuryManagement.address,
      MINT_MULTIPLE,
      UNLOCK_DELAY_SECONDS,
      HARVEST_THRESHOLD,
      BONUS_FACTOR
    )

    await templeToken.addMinter(treasury.address);
    await templeToken.addMinter(openingCeremony.address);
    await templeToken.addMinter(await owner.getAddress());

    stakers = (await ethers.getSigners()).slice(1, 5);

    for (const s of stakers) {
      await stablecToken.mint(await s.getAddress(), toAtto(1000000))
      await sandalwoodToken.transfer(await s.getAddress(), toAtto(1000))
      await stablecToken.connect(s).increaseAllowance(openingCeremony.address, toAtto(1000000))
      await sandalwoodToken.connect(s).increaseAllowance(openingCeremony.address, toAtto(1000))
    }

    await Promise.all([
      stablecToken.mint(await owner.getAddress(), toAtto(100000)),
      stablecToken.connect(owner).increaseAllowance(treasury.address, toAtto(100000)),
    ]);

    await treasury.seedMint(1,100);
    await treasury.transferOwnership(treasuryManagement.address);
  })

  it("Only owner can pause/unpause", async () => {
    // only owner can pause
    await shouldThrow(openingCeremony.connect(stakers[0]).pause(), /Ownable:/);
    await openingCeremony.pause();

    // All methods should be disabled when paused
    const address = await stakers[0].getAddress()
    await shouldThrow(openingCeremony.connect(stakers[0]).mintAndStakeFor(address, 0, 0), /Pausable:/);
    await shouldThrow(openingCeremony.connect(stakers[0]).mintAndStake(0, 0), /Pausable:/);
    await shouldThrow(openingCeremony.connect(stakers[0]).stakeFor(address, 0, 0), /Pausable:/);
    await shouldThrow(openingCeremony.connect(stakers[0]).stake(0, 0), /Pausable:/);

    // Only owner can unpause
    await shouldThrow(openingCeremony.connect(stakers[0]).unpause(), /Ownable:/);
    await openingCeremony.unpause();
  });

  describe("mintAndStakeFor", async () => {
    it("Insufficient sandalwood", async () => {
      const stakerAddr = await stakers[0].getAddress()
      await shouldThrow(openingCeremony.mintAndStakeFor(stakerAddr, toAtto(1), toAtto(10)), /Incorrect Sandalwood offered/);
      await shouldThrow(openingCeremony.mintAndStakeFor(stakerAddr, toAtto(1), toAtto(1001)), /Incorrect Sandalwood offered/);
    });

    it("Insufficient stablec allowance", async () => {
      const stakerAddr = await stakers[0].getAddress()
      await stablecToken.increaseAllowance(openingCeremony.address, toAtto(999));
      await shouldThrow(openingCeremony.mintAndStakeFor(stakerAddr, toAtto(1), toAtto(1000)), /ERC20: transfer amount exceeds allowance/);
    });

    it("Insufficient sandalwood allowance", async () => {
      const stakerAddr = await stakers[0].getAddress()
      await stablecToken.increaseAllowance(openingCeremony.address, toAtto(1000));
      await sandalwoodToken.increaseAllowance(openingCeremony.address, toAtto(1).sub(1));
      await shouldThrow(openingCeremony.mintAndStakeFor(stakerAddr, toAtto(1), toAtto(1000)), /ERC20: burn amount exceeds allowance/);
    });

    it("Happy path (with and without harvest)", async () => {
      const stakerAddr = await stakers[0].getAddress()
      const startingIV = 1/100;

      // mint and stake twice
      await stablecToken.increaseAllowance(openingCeremony.address, toAtto(100000));
      await sandalwoodToken.increaseAllowance(openingCeremony.address, toAtto(100));
      await openingCeremony.mintAndStakeFor(stakerAddr, toAtto(9), toAtto(9000));
      await openingCeremony.mintAndStakeFor(stakerAddr, toAtto(11), toAtto(11000));

      // check mint, stake and locks are as expected
      const mintEvents = await openingCeremony.queryFilter(openingCeremony.filters.MintComplete())
      const lockEvents = await lockedOGTemple.queryFilter(lockedOGTemple.filters.OGTempleLocked());
      expect(mintEvents.length).eq(lockEvents.length);

      for (const i in mintEvents) {
        const m = mintEvents[i];
        const l = lockEvents[i];
        const block = await l.getBlock();
          
        expect(fromAtto(m.args.mintedTemple)).eq(fromAtto(m.args.acceptedStablec) / startingIV / MINT_MULTIPLE)
        expect(fromAtto(m.args.bonusTemple)).eq(fromAtto(m.args.acceptedStablec) / startingIV / MINT_MULTIPLE * BONUS_FACTOR.numerator / BONUS_FACTOR.denominator)
        expect(fromAtto(m.args.mintedOGTemple)).gt(1); // expect OG Temple, calcs themselves tested elsewhere
        expect(fromAtto(m.args.mintedOGTemple)).eq(fromAtto(l.args._amount))
        expect(l.args._lockedUntil.toNumber()).eq(block.timestamp + UNLOCK_DELAY_SECONDS);
      }

      // expect a single harvest to be run, and iv to have increased
      const harvestEvents = await treasury.queryFilter(treasury.filters.RewardsHarvested());
      const [ivStablec, ivTemple] = await treasury.intrinsicValueRatio();
      expect(harvestEvents.length).eq(1);
      expect(fromAtto(ivStablec) / fromAtto(ivTemple)).gt(startingIV);
    });
  })

  describe("stakeFor", async () => {
    it("Insufficient sandalwood", async () => {
      const stakerAddr = await stakers[0].getAddress()
      await shouldThrow(openingCeremony.stakeFor(stakerAddr, toAtto(1), toAtto(10)), /Incorrect Sandalwood offered/);
      await shouldThrow(openingCeremony.stakeFor(stakerAddr, toAtto(1), toAtto(1001)), /Incorrect Sandalwood offered/);
    });

    it("Insufficient sandalwood allowance", async () => {
      const stakerAddr = await stakers[0].getAddress()
      await sandalwoodToken.increaseAllowance(openingCeremony.address, toAtto(1).sub(1));
      await shouldThrow(openingCeremony.stakeFor(stakerAddr, toAtto(1), toAtto(1000)), /ERC20: burn amount exceeds allowance/);
    });

    it("Insufficient temple allowance", async () => {
      const stakerAddr = await stakers[0].getAddress()
      await sandalwoodToken.increaseAllowance(openingCeremony.address, toAtto(1));
      await templeToken.mint(await owner.getAddress(), toAtto(100000));
      await templeToken.increaseAllowance(openingCeremony.address, toAtto(999));
      await shouldThrow(openingCeremony.stakeFor(stakerAddr, toAtto(1), toAtto(1000)), /ERC20: transfer amount exceeds allowance/);
    });

    it("Happy path", async () => {
      const stakerAddr = await stakers[0].getAddress()
      await templeToken.mint(await owner.getAddress(), toAtto(100000));
      await templeToken.increaseAllowance(openingCeremony.address, toAtto(100000));
      await sandalwoodToken.increaseAllowance(openingCeremony.address, toAtto(100));

      await openingCeremony.stakeFor(stakerAddr, toAtto(10), toAtto(10000));

      // check stake and locks are as expected
      const stakeEvents = await openingCeremony.queryFilter(openingCeremony.filters.StakeComplete())
      const lockEvents = await lockedOGTemple.queryFilter(lockedOGTemple.filters.OGTempleLocked());
      expect(stakeEvents.length).eq(lockEvents.length);

      for (const i in stakeEvents) {
        const s = stakeEvents[i];
        const l = lockEvents[i];
        const block = await l.getBlock();
          
        expect(fromAtto(s.args.bonusTemple)).eq(fromAtto(s.args.acceptedTemple) * BONUS_FACTOR.numerator / BONUS_FACTOR.denominator)
        expect(fromAtto(s.args.mintedOGTemple)).gt(1); // expect OG Temple, calcs themselves tested elsewhere
        expect(fromAtto(s.args.mintedOGTemple)).eq(fromAtto(l.args._amount))
        expect(l.args._lockedUntil.toNumber()).eq(block.timestamp + UNLOCK_DELAY_SECONDS);
      }
    });
  })
});