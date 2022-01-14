import { ethers } from "hardhat";
import { expect } from "chai";

import { FakeERC20, FakeERC20__factory,  TempleERC20Token, TempleERC20Token__factory, TempleFraxAMMRouter, TempleFraxAMMRouter__factory, TempleTreasury, TempleTreasury__factory, TempleUniswapV2Pair, TempleUniswapV2Pair__factory, LockedOGTemple, LockedOGTemple__factory, TempleStaking, TempleStaking__factory, Faith, Faith__factory, Devotion, Devotion__factory, OGTemple, OGTemple__factory} from "../../typechain";

import { Signer } from "ethers";
import { mineNBlocks, toAtto, shouldThrow, fromFixedPoint112x112, blockTimestamp, fromAtto } from "../helpers";

describe("Devotion", async () => {
    let templeToken: TempleERC20Token;
    let fraxToken: FakeERC20;
    let treasury: TempleTreasury;
    let owner: Signer;
    let alan: Signer;
    let ben: Signer
    let pair: TempleUniswapV2Pair;
    let templeRouter: TempleFraxAMMRouter;
    let faith: Faith;
    let devotion: Devotion;
    let ogTemple: OGTemple;
    let lockedOGTemple: LockedOGTemple;
    let templeStaking: TempleStaking;

    const expiryDate = (): number =>  Math.floor(Date.now() / 1000) + 9000;
   
    beforeEach(async () => {
      [owner, alan, ben] = await ethers.getSigners();

      templeToken = await new TempleERC20Token__factory(owner).deploy();
      fraxToken = await new FakeERC20__factory(owner).deploy("STABLEC", "STABLEC");

      faith = await new Faith__factory(owner).deploy();

      await templeToken.addMinter(await owner.getAddress()),

      await Promise.all([
        fraxToken.mint(await owner.getAddress(), toAtto(100000000000)),
        templeToken.mint(await owner.getAddress(), toAtto(100000000000)),
      ]);

      treasury = await new TempleTreasury__factory(owner).deploy(
        templeToken.address,
        fraxToken.address,
      );

      templeStaking = await new TempleStaking__factory(owner).deploy(
        templeToken.address,
         await alan.getAddress(), // Random exit queue address
         20, /* epoch size, in seconds */
        (await blockTimestamp()) - 1,
      );

      await templeStaking.setEpy(10,10);

      ogTemple = new OGTemple__factory(owner).attach(await templeStaking.OG_TEMPLE())

      lockedOGTemple = await new LockedOGTemple__factory(owner).deploy(ogTemple.address)

      await templeToken.addMinter(treasury.address),
      await fraxToken.increaseAllowance(treasury.address, toAtto(100));
      await treasury.seedMint(toAtto(100), toAtto(50));

      pair = await new TempleUniswapV2Pair__factory(owner).deploy(await owner.getAddress(), templeToken.address, fraxToken.address);
      templeRouter = await new TempleFraxAMMRouter__factory(owner).deploy(
        pair.address,
        templeToken.address,
        fraxToken.address,
        treasury.address,
        treasury.address, // for testing, make the earning account treasury
        {frax: 100000, temple: 9000},
        1, /* threshold decay per block */
        {frax: 1000000, temple: 1000000},
        {frax: 1000000, temple: 100000},
      );

      await pair.setRouter(templeRouter.address);
      await templeToken.addMinter(templeRouter.address);


      devotion = await new Devotion__factory(owner).deploy(
        templeToken.address,
        faith.address,
        pair.address,
        lockedOGTemple.address,
        templeStaking.address,
        60
      );

      await faith.addManager(devotion.address);
      await faith.addManager(await owner.getAddress());
      await devotion.addDevotionMaster(await owner.getAddress());

      // Add liquidity to both AMMs
      await templeToken.increaseAllowance(templeRouter.address, toAtto(10000000000));
      await fraxToken.increaseAllowance(templeRouter.address, toAtto(10000000000));
      await templeRouter.addLiquidity(toAtto(100000), toAtto(100000), 1, 1, await owner.getAddress(), expiryDate());


      // Make temple router open access (useful state for most tests)
      await templeRouter.toggleOpenAccess();
    })

    describe("Add Devotion master", async() => {

        it("Owner can add temple master", async() => {
            expect(await devotion.devotionMaster(await alan.getAddress())).to.be.false;
            await devotion.addDevotionMaster(await alan.getAddress());
            expect(await devotion.devotionMaster(await alan.getAddress())).to.be.true;
        })

        it("Non Owner can't remove devotion master", async() => {
            await shouldThrow(devotion.connect(alan).addDevotionMaster(await alan.getAddress()), /Ownable: caller is not the owner/);  
        })
    })

    describe("Remove Devotion master", async() => {

        it("Owner can remove devotion  master", async() => {
            expect(await devotion.devotionMaster(await owner.getAddress())).to.be.true;
            await devotion.removeDevotionMaster(await owner.getAddress());
            expect(await devotion.devotionMaster(await owner.getAddress())).to.be.false;
        })

        it("Non Owner can't remove devotion master", async() => {
            await shouldThrow(devotion.connect(alan).removeDevotionMaster(await alan.getAddress()), /Ownable: caller is not the owner/);  
        })
    })

    describe("Withdraw balance", async() => {

        it("Only owner can withdraw", async() => {
            await templeToken.transfer(devotion.address, toAtto(100));
            expect(await templeToken.balanceOf(devotion.address)).to.eq(toAtto(100))
            await devotion.withdrawBalance(templeToken.address, await alan.getAddress(), toAtto(100));
            expect(await templeToken.balanceOf(devotion.address)).to.eq(toAtto(0))
            expect(await templeToken.balanceOf(await alan.getAddress())).to.eq(toAtto(100))
        })

        it("Non Owner can't withdraw", async() => {
            await shouldThrow(devotion.connect(alan).withdrawBalance(templeToken.address, await alan.getAddress(), await alan.getAddress()), /Ownable: caller is not the owner/);  
        })
    })


    it("Only Owner can add temple masters", async() => {
        await shouldThrow(devotion.connect(alan).addDevotionMaster(await alan.getAddress()), /Ownable: caller is not the owner/);  
    })

    describe("Start Devotion Round", async() => {
      it("Shouldn't have an active round, unless startDevotion is called", async() => {
          let currentRound = await devotion.currentRound()
          expect(currentRound).to.eq(0);
          expect((await devotion.roundStatus(currentRound)).stage).to.eq(2);
          await devotion.startDevotion(10, 10);
          expect(await devotion.currentRound()).to.eq(currentRound + 1);
      })
      
      it("Increase round by 1", async() => {
          let currentRound = await devotion.currentRound()
          await devotion.startDevotion(10, 10);
          expect(await devotion.currentRound()).to.eq(currentRound + 1);
      })

      it("changes round stage correctly", async() => {
        let currentRound = await devotion.currentRound()
        await devotion.startDevotion(10, 10);
        let roundStats = await devotion.roundStatus(currentRound+1)
        expect(roundStats.stage).to.eq(0)
        expect(roundStats.isWon).to.be.false
      })

      it("changes round stage correctly as we wrap around (currentRound is a uint8", async() => {
        for (let i = 0; i < 256; i++) {
          await devotion.startDevotion(10, 10);
        }

        let currentRound = await devotion.currentRound()
        expect(currentRound).to.eq(0);
        let roundStats = await devotion.roundStatus(currentRound)
        expect(roundStats.stage).to.eq(0)
        expect(roundStats.isWon).to.be.false
      })

      it("Sets price target", async() => {
        await devotion.startDevotion(13, 9); // 1.3$ target price
        let priceTarget = await devotion.targetPriceAverageTemple();
        expect(fromFixedPoint112x112(priceTarget)).approximately(13/9, 0.01)
      })

      it("not a devotion master", async() => {
        await shouldThrow(devotion.connect(alan).startDevotion(13, 9), /Devotion: Only Game Master/);
      })
      
  })

  describe("Initiate final hour", async() => {

    beforeEach(async () => {
        await devotion.startDevotion(13, 9); // Initiate target price at 1$
    })
  
    it("changes round stage correctly", async() => {
      let currentRound = await devotion.currentRound()
      await devotion.initiateDevotionFinalHour();
      let roundStats = await devotion.roundStatus(currentRound)
      expect(roundStats.stage).to.eq(1)
      expect(roundStats.isWon).to.be.false
      expect(await devotion.currentRound()).to.eq(1)
    })

    it("stores cumulative price data", async() => {
        let currentRound = await devotion.currentRound()
        await devotion.initiateDevotionFinalHour()
        let blockTimeStampLast = (await devotion.priceCumulativeLastTimestamp()).toNumber()
        expect(blockTimeStampLast).to.eq(await blockTimestamp())
    })


    it("verify faith/no locked OG-Temple", async() => {
        await devotion.initiateDevotionFinalHour()
        await shouldThrow(devotion.verifyFaith(), /!VERIFY: LOCK NOT ENOUGH/);
    })

    it("verify faith/has locked OG-Temple but not locked enough", async() => {
        await devotion.initiateDevotionFinalHour()

        // Stake and lock temple
        await templeToken.increaseAllowance(templeStaking.address, toAtto(100))
        await templeStaking.stake(toAtto(100));

        let amountOgTemple = await ogTemple.balanceOf(await owner.getAddress())
        await ogTemple.increaseAllowance(lockedOGTemple.address, amountOgTemple)
        await lockedOGTemple.lock(await ogTemple.balanceOf(await owner.getAddress()), 59)

        await shouldThrow(devotion.verifyFaith(), /!VERIFY: LOCK NOT ENOUGH/);
    })

    it("verify faith/has locked OG-Temple", async() => {
        await devotion.initiateDevotionFinalHour()

        // Stake and lock temple
        await templeToken.increaseAllowance(templeStaking.address, toAtto(100))
        await templeStaking.stake(toAtto(100));

        let amountOgTemple = await ogTemple.balanceOf(await owner.getAddress())
        await ogTemple.increaseAllowance(lockedOGTemple.address, amountOgTemple)
        await lockedOGTemple.lock(await ogTemple.balanceOf(await owner.getAddress()), 60*60*60)

        await devotion.verifyFaith()
        let faithBalance = await faith.balances(await owner.getAddress())

        expect(faithBalance.lifeTimeFaith).eq(fromAtto(amountOgTemple))
        expect(faithBalance.usableFaith).eq(fromAtto(amountOgTemple))
    })

    it("lock and verify faith/has Og-temple", async() => {
        await devotion.initiateDevotionFinalHour()

        // Stake and lock temple
        await templeToken.increaseAllowance(templeStaking.address, toAtto(100))
        await templeStaking.stake(toAtto(100));

        let amountOgTemple = await ogTemple.balanceOf(await owner.getAddress())
        await ogTemple.increaseAllowance(devotion.address, amountOgTemple)
    
        await devotion.lockAndVerify(amountOgTemple);
        let faithBalance = await faith.balances(await owner.getAddress())
        expect(faithBalance.lifeTimeFaith).eq(fromAtto(amountOgTemple))
        expect(faithBalance.usableFaith).eq(fromAtto(amountOgTemple))
    })

    it("not a devotion master", async() => {
        await shouldThrow(devotion.connect(alan).initiateDevotionFinalHour(), /Devotion: Only Game Master/);
    })
  })

  describe("End Devotion game/Game is won", async() => {

    beforeEach(async () => {
        await devotion.startDevotion(13, 9); // Initiate target price at 1.4$ current amm price is at 1$
        // Push price up 
        await templeRouter.swapExactFraxForTemple(toAtto(23000), 1, await alan.getAddress(), expiryDate()); // Set price to 1.51
        await mineNBlocks(3);
        await devotion.initiateDevotionFinalHour();
        await mineNBlocks(3);
    })
  
    it("changes round status", async() => {
        await devotion.endDevotionRound()
        let currentRound = await devotion.currentRound()
        let roundStats = await devotion.roundStatus(currentRound)
        expect(await devotion.currentRound()).to.eq(1)
        expect(roundStats.stage).to.eq(2)
        expect(roundStats.isWon).to.be.true // Current round is victory
    })

    it("verify faith/no locked OG-Temple", async() => {
        await shouldThrow(devotion.verifyFaith(), /!VERIFY: LOCK NOT ENOUGH/);
    })

    it("not a devotion master", async() => {
        await shouldThrow(devotion.connect(alan).endDevotionRound(), /Devotion: Only Game Master/);
    })

    it("claim OG Temple (single player)", async() => {
        await devotion.endDevotionRound()

        // Transfer them temple to contract
        await templeToken.transfer(devotion.address, toAtto(1000));

        // Give user some faith and calculate expected reward
        await faith.gain(await alan.getAddress(), 25);
        const expectedTempleClaim = 1000 * 25 / (await faith.totalSupply()).toNumber();

        // Claim temple and confirm reward matches expected
        await devotion.connect(alan).claimTempleReward(25);
        const rewardEvent = await devotion.queryFilter(devotion.filters.ClaimTempleRewards());
        let event  = rewardEvent[0]
        let amountTempleRewarded = fromAtto(event.args.templeRewarded)
        expect(amountTempleRewarded).to.eq(expectedTempleClaim);
    })

    it("claim OG Temple (multi-player)", async() => {
        await devotion.endDevotionRound()

        const players: [Signer, number][] = [
          [alan,30], [ben,50], [owner, 100]
        ]

        // Transfer them temple to contract
        await templeToken.transfer(devotion.address, toAtto(1000));

        // Give user some faith
        for (const [player,numFaith] of players) {
          await faith.gain(await player.getAddress(), numFaith);
        }

        const totalSupplyPreClaim = (await faith.totalSupply()).toNumber();

        for (const [player,numFaith] of players) {
          await devotion.connect(player).claimTempleReward(numFaith)
        }

        const rewardEvents = await devotion.queryFilter(devotion.filters.ClaimTempleRewards())
        for (let i = 0; i < players.length; i++) {
          const [_,numFaith] = players[i];
          let event  = rewardEvents[i]
          let amountTempleRewarded = fromAtto(event.args.templeRewarded)
          expect(amountTempleRewarded).to.eq(1000 * numFaith / totalSupplyPreClaim)
        }
    })
  })

  describe("Initiate final hour/Game is lost", async() => {

    beforeEach(async () => {
        await devotion.startDevotion(13, 9); // Initiate target price at 1.4$ current amm price is at 1$
        // Push price up 
        await templeRouter.swapExactFraxForTemple(toAtto(10000), 1, await alan.getAddress(), expiryDate()); // Set price to 1.51
        await mineNBlocks(3);
        await devotion.initiateDevotionFinalHour();
        await mineNBlocks(3);  
    })
  
    it("changes round status", async() => {
        await devotion.endDevotionRound()
        let currentRound = await devotion.currentRound()
        let roundStats = await devotion.roundStatus(currentRound)
        expect(await devotion.currentRound()).to.eq(1)
        expect(roundStats.stage).to.eq(2)
        expect(roundStats.isWon).to.be.false // Current round is a loss
    })

      
    it("claim rewards", async() => {
        await devotion.endDevotionRound()

        // Transfer them temple to contract
        await templeToken.transfer(devotion.address, toAtto(1000));

        // Give user some faith
        await faith.gain(await alan.getAddress(), 25);
        await shouldThrow(devotion.connect(alan).claimTempleReward(25), /VERIFY: UNAVAILABLE/);
    })
  })

})