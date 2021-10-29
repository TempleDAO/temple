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
   const INVITE_THRESHOLD: BigNumber = toAtto(10000);
   const VERIFIED_BONUS_FACTOR: {numerator: number, denominator: number} = { numerator: 51879, denominator: 100000}; // 0.1 EPY as bonus
   const GUEST_BONUS_FACTOR: {numerator: number, denominator: number} = { numerator: 45779, denominator: 100000};    // 0.9 EPY as bonus

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
    await staking.setEpy(0,100);

    lockedOGTemple = await new LockedOGTemple__factory(owner).deploy(await staking.OG_TEMPLE());

    openingCeremony = await new OpeningCeremony__factory(owner).deploy(
      stablecToken.address,
      templeToken.address,
      sandalwoodToken.address,
      staking.address,
      lockedOGTemple.address,
      treasury.address,
      treasuryManagement.address,
      HARVEST_THRESHOLD,
      INVITE_THRESHOLD,
      VERIFIED_BONUS_FACTOR,
      GUEST_BONUS_FACTOR,
    )

    await openingCeremony.setLimitStablec(toAtto(5000), toAtto(1000000), toAtto(10000));
    await openingCeremony.setLimitTemple(toAtto(5000), toAtto(1000000));

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

  describe("Management", async () => {
    it("Only owner can pause/unpause", async () => {
      // only owner can pause
      await shouldThrow(openingCeremony.connect(stakers[0]).pause(), /Ownable:/);
      await openingCeremony.pause();

      // All methods should be disabled when paused
      const address = await stakers[0].getAddress()
      await shouldThrow(openingCeremony.connect(stakers[0]).mintAndStakeFor(address, 0), /Pausable:/);
      await shouldThrow(openingCeremony.connect(stakers[0]).mintAndStake(0), /Pausable:/);
      await shouldThrow(openingCeremony.connect(stakers[0]).stakeFor(address, 0), /Pausable:/);
      await shouldThrow(openingCeremony.connect(stakers[0]).stake(0), /Pausable:/);

      // Only owner can unpause
      await shouldThrow(openingCeremony.connect(stakers[0]).unpause(), /Ownable:/);
      await openingCeremony.unpause();
    });

    it("Only owner can update unlock delay", async() => {
      await shouldThrow(openingCeremony.connect(stakers[0]).setUnlockDelay(100), /Ownable:/);
      await openingCeremony.setUnlockDelay(100);
      expect(await openingCeremony.unlockDelaySeconds()).eq(100);
    });

    it("Only owner can update mint multiple", async() => {
      await shouldThrow(openingCeremony.connect(stakers[0]).setMintMultiple(1), /Ownable:/);
      await openingCeremony.setMintMultiple(1);
      expect(await openingCeremony.mintMultiple()).eq(1);
    });

    it("Only owner can update harvest threshold", async() => {
      await shouldThrow(openingCeremony.connect(stakers[0]).setHarvestThreshold(toAtto(50000)), /Ownable:/);
      await openingCeremony.setHarvestThreshold(toAtto(50000));
      expect(await openingCeremony.harvestThresholdStablec()).eql(toAtto(50000));
    });

    it("Only owner can update invite threshold", async() => {
      await shouldThrow(openingCeremony.connect(stakers[0]).setInviteThreshold(toAtto(50000)), /Ownable:/);
      await openingCeremony.setInviteThreshold(toAtto(50000));
      expect(await openingCeremony.inviteThresholdStablec()).eql(toAtto(50000));
    });

    it("Only owner can change bonus factor for verified users", async() => {
      await shouldThrow(openingCeremony.connect(stakers[0]).setVerifiedBonusFactor(1, 100), /Ownable:/);
      await openingCeremony.setVerifiedBonusFactor(1, 100);
      const factor = await openingCeremony.verifiedBonusFactor();
      expect(factor.numerator).eq(1)
      expect(factor.denominator).eq(100);
    });

    it("Only owner can change bonus factor for guest users", async() => {
      await shouldThrow(openingCeremony.connect(stakers[0]).setGuestBonusFactor(1, 100), /Ownable:/);
      await openingCeremony.setGuestBonusFactor(1, 100);
      const factor = await openingCeremony.guestBonusFactor();
      expect(factor.numerator).eq(1)
      expect(factor.denominator).eq(100);
    });

    it("Only owner can change mint limit", async() => {
      await shouldThrow(openingCeremony.connect(stakers[0]).setLimitStablec(3, 2, 1), /Ownable:/);
      await openingCeremony.setLimitStablec(3, 2, 1);
      const limit = await openingCeremony.limitStablec();
      expect(limit.guestMax).eq(3);
      expect(limit.verifiedMax).eq(2);
      expect(limit.verifiedDayOne).eq(1);
    });

    it("Only owner can change stake limit", async() => {
      await shouldThrow(openingCeremony.connect(stakers[0]).setLimitTemple(1, 2), /Ownable:/);
      await openingCeremony.setLimitTemple(1, 2);
      const limit = await openingCeremony.limitTemple();
      expect(limit.guestMax).eq(1);
      expect(limit.verifiedMax).eq(2);
    });

    it("Only owner can add/remove verifiers", async() => {
      const can_add_verifier_role = await openingCeremony.CAN_ADD_VERIFIED_USER()
      const verifier = await (await ethers.getSigners())[10].getAddress()

      await shouldThrow(openingCeremony.connect(stakers[0]).grantRole(can_add_verifier_role, verifier), /AccessControl:.* is missing role 0x0/)
      await openingCeremony.grantRole(can_add_verifier_role, verifier)
      expect(await openingCeremony.hasRole(can_add_verifier_role, verifier)).is.true

      await shouldThrow(openingCeremony.connect(stakers[0]).revokeRole(can_add_verifier_role, verifier), /AccessControl:.* is missing role 0x0/)
      await openingCeremony.revokeRole(can_add_verifier_role, verifier)
      expect(await openingCeremony.hasRole(can_add_verifier_role, verifier)).is.false
    });

    it("Only addresses with the CAN_ADD_VERIFIED_USER role, can add a verified user", async() => {
      const can_add_verifier_role = await openingCeremony.CAN_ADD_VERIFIED_USER()
      const verifier = (await ethers.getSigners())[10]
      await openingCeremony.grantRole(can_add_verifier_role, await verifier.getAddress())

      await shouldThrow(openingCeremony.connect(stakers[0]).addVerifiedUser(await stakers[0].getAddress()), /Caller cannot add verified user/)
      
      await sandalwoodToken.transfer(await verifier.getAddress(), toAtto(1));
      await sandalwoodToken.connect(verifier).increaseAllowance(openingCeremony.address, toAtto(1));
      await openingCeremony.connect(verifier).addVerifiedUser(await stakers[0].getAddress());

      expect((await openingCeremony.users(await stakers[0].getAddress())).isVerified).is.true;
    });

    xit("Only verified users who have sacrificed 10,000 frax can invite guests", async() => {
    })
  });

  xdescribe("mintAndStakeFor", async () => {
    xit("Must be guest or verified", async() => {});
    xit("Guest limit enforced", async() => {});

    xit("Insufficient stablec allowance", async () => {
      const stakerAddr = await stakers[0].getAddress()
      await stablecToken.increaseAllowance(openingCeremony.address, toAtto(999));
      await shouldThrow(openingCeremony.mintAndStakeFor(stakerAddr, toAtto(1000)), /ERC20: transfer amount exceeds allowance/);
    });

    xit("Happy path for guest", async() => {});

    xit("Happy path for Verified user (with and without harvest)", async () => {
      const stakerAddr = await stakers[0].getAddress()
      const startingIV = 1/100;

      // mint and stake twice
      await stablecToken.increaseAllowance(openingCeremony.address, toAtto(100000));
      await sandalwoodToken.increaseAllowance(openingCeremony.address, toAtto(100));
      await openingCeremony.mintAndStakeFor(stakerAddr, toAtto(9000));
      await openingCeremony.mintAndStakeFor(stakerAddr, toAtto(11000));

      // check mint, stake and locks are as expected
      const mintEvents = await openingCeremony.queryFilter(openingCeremony.filters.MintComplete())
      const lockEvents = await lockedOGTemple.queryFilter(lockedOGTemple.filters.OGTempleLocked());
      expect(mintEvents.length).eq(lockEvents.length);

      for (const i in mintEvents) {
        const m = mintEvents[i];
        const l = lockEvents[i];
        const block = await l.getBlock();
          
        expect(fromAtto(m.args.mintedTemple)).eq(fromAtto(m.args.acceptedStablec) / startingIV / MINT_MULTIPLE)
        expect(fromAtto(m.args.bonusTemple)).eq(fromAtto(m.args.acceptedStablec) / startingIV / MINT_MULTIPLE * VERIFIED_BONUS_FACTOR.numerator / VERIFIED_BONUS_FACTOR.denominator)
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

    xit("Quester limit increases daily", async() => {});
  })

  describe("stakeFor", async () => {
    xit("Must be guest or verified", async() => {});
    xit("Guest limit enforced", async() => {});
    xit("Quester limit enforced", async() => {});

    xit("Insufficient temple allowance", async () => {
      const stakerAddr = await stakers[0].getAddress()
      await sandalwoodToken.increaseAllowance(openingCeremony.address, toAtto(1));
      await templeToken.mint(await owner.getAddress(), toAtto(100000));
      await templeToken.increaseAllowance(openingCeremony.address, toAtto(999));
      await shouldThrow(openingCeremony.stakeFor(stakerAddr, toAtto(1000)), /ERC20: transfer amount exceeds allowance/);
    });

    xit("Happy path for guest", async() => {});
    xit("Happy path", async () => {
      const stakerAddr = await stakers[0].getAddress()
      await templeToken.mint(await owner.getAddress(), toAtto(100000));
      await templeToken.increaseAllowance(openingCeremony.address, toAtto(100000));
      await sandalwoodToken.increaseAllowance(openingCeremony.address, toAtto(100));

      await openingCeremony.stakeFor(stakerAddr, toAtto(10000));

      // check stake and locks are as expected
      const stakeEvents = await openingCeremony.queryFilter(openingCeremony.filters.StakeComplete())
      const lockEvents = await lockedOGTemple.queryFilter(lockedOGTemple.filters.OGTempleLocked());
      expect(stakeEvents.length).eq(lockEvents.length);

      for (const i in stakeEvents) {
        const s = stakeEvents[i];
        const l = lockEvents[i];
        const block = await l.getBlock();
          
        expect(fromAtto(s.args.bonusTemple)).eq(fromAtto(s.args.acceptedTemple) * VERIFIED_BONUS_FACTOR.numerator / VERIFIED_BONUS_FACTOR.denominator)
        expect(fromAtto(s.args.mintedOGTemple)).gt(1); // expect OG Temple, calcs themselves tested elsewhere
        expect(fromAtto(s.args.mintedOGTemple)).eq(fromAtto(l.args._amount))
        expect(l.args._lockedUntil.toNumber()).eq(block.timestamp + UNLOCK_DELAY_SECONDS);
      }
    });
  })
});