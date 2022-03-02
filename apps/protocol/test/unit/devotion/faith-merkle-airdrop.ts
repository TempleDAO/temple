import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Signer } from "ethers";
import { FaithMerkleAirdrop, FaithMerkleAirdrop__factory, 
  Faith, Faith__factory } from "../../../typechain";
import { shouldThrow, blockTimestamp, mineForwardSeconds } from "../helpers";
import BalanceTree from "../../../scripts/merkle/balance-tree";

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000'

describe("Faith Merkle Airdrop", async () => {
  let owner: Signer;
  let clint: Signer;
  let alan: Signer;
  let vince: Signer;
  let curry: Signer;
  let lebron: Signer;
  let jokic: Signer;
  let faithAirdrop: FaithMerkleAirdrop;
  let faithAirdropZeroMerkle: FaithMerkleAirdrop;
  let faith: Faith;
  let tree: BalanceTree;

  describe("smol tree", async () => {
    beforeEach( async () => {
      [owner, clint, alan, vince, curry, lebron, jokic] = await ethers.getSigners();
  
      tree = new BalanceTree([
        { account: await clint.getAddress(), amount: BigNumber.from(100) },
        { account: await alan.getAddress(), amount: BigNumber.from(101) },
        { account: await vince.getAddress(), amount: BigNumber.from(50) },
        { account: await curry.getAddress(), amount: BigNumber.from(51) },
        { account: await lebron.getAddress(), amount: BigNumber.from(96) },
        { account: await jokic.getAddress(), amount: BigNumber.from(99) }
      ]);
  
      faith = await new Faith__factory(owner).deploy();
      faithAirdrop = await new FaithMerkleAirdrop__factory(owner).deploy(faith.address, tree.getHexRoot());
      faithAirdropZeroMerkle = await new FaithMerkleAirdrop__factory(owner).deploy(faith.address, ZERO_BYTES32);
  
      // let airdrop distributor manage faith
      await faith.addManager(faithAirdrop.address);
  
      // set time to start claim
      await faithAirdrop.setClaimStartTime(await blockTimestamp() + 1);
      await faithAirdrop.setClaimEndTime(await blockTimestamp() + 1000);
      await faithAirdropZeroMerkle.setClaimStartTime(await blockTimestamp() + 1);
      await faithAirdropZeroMerkle.setClaimEndTime(await blockTimestamp() + 1000);
    });
  
    it("admin tests", async () => {
      // only admin can set owner
      await shouldThrow(faithAirdrop.connect(alan).setOwner(await alan.getAddress()), /not owner/);
      await faithAirdrop.setOwner(await clint.getAddress())
      expect(await faithAirdrop.owner()).to.eq(await clint.getAddress());
  
      // only admin can set claim start time
      const now = await blockTimestamp();
      await shouldThrow(faithAirdrop.connect(alan).setClaimStartTime(now), /not owner/);
      await faithAirdrop.connect(clint).setClaimStartTime(now + 1);

      // only admin can set end time
      await shouldThrow(faithAirdrop.connect(alan).setClaimEndTime(now + 1000), /not owner/);
      await faithAirdrop.connect(clint).setClaimEndTime(now + 1000);
    });
  
    it("sets time correctly", async () => {
      const now = await blockTimestamp() + 1;
      // can't set start time before current time
      await shouldThrow(faithAirdrop.setClaimStartTime(now - 10), /invalid time/);
      await faithAirdrop.setClaimStartTime(now);

      // end time
      await shouldThrow(faithAirdrop.setClaimEndTime(now - 10), /invalid time/);
      await faithAirdrop.setClaimEndTime(now + 100);
      const [start, end] = await faithAirdrop.getClaimPeriod();

      expect(start).to.eq(now);
      expect(end).to.eq(now + 100);
    });
  
    it("returns faith address", async () => {
      expect(await faithAirdrop.faith()).to.eq(faith.address);
      expect(await faithAirdropZeroMerkle.faith()).to.eq(faith.address);
    });
  
    it("returns the zero merkle root", async () => {
      expect(await faithAirdropZeroMerkle.merkleRoot()).to.eq(ZERO_BYTES32);
    });
  
    it('fails for empty proof', async () => {
      await expect(faithAirdropZeroMerkle.claim(0, await clint.getAddress(), 100, [])).to.be.revertedWith(
        'MerkleDistributor: Invalid proof.'
      );
    });
  
    it('fails for invalid index', async () => {
      await expect(faithAirdropZeroMerkle.claim(0, await alan.getAddress(), 10, [])).to.be.revertedWith(
        'MerkleDistributor: Invalid proof.'
      );
    });
  
    it("successfully claims", async () => {
      const proof0 = tree.getProof(0, await clint.getAddress(), BigNumber.from(100));
      await expect(faithAirdrop.claim(0, await clint.getAddress(), 100, proof0))
        .to.emit(faithAirdrop, 'Claimed')
        .withArgs(0, await clint.getAddress(), 100);
  
      const proof1 = tree.getProof(1, await alan.getAddress(), BigNumber.from(101));
      await expect(faithAirdrop.claim(1, await alan.getAddress(), 101, proof1))
        .to.emit(faithAirdrop, 'Claimed')
        .withArgs(1, await alan.getAddress(), 101);
    });
  
    it("transfers faith", async () => {
      const proof0 = tree.getProof(0, await clint.getAddress(), BigNumber.from(100));
      const faithBalanceBefore = await faith.balances(await clint.getAddress());
      expect(faithBalanceBefore.lifeTimeFaith).to.eq(0);
      expect(faithBalanceBefore.usableFaith).to.eq(0);
      await faithAirdrop.claim(0, await clint.getAddress(), 100, proof0);
      const faithBalanceAfter = await faith.balances(await clint.getAddress());
      expect(faithBalanceAfter.lifeTimeFaith).to.eq(100);
      expect(faithBalanceAfter.usableFaith).to.eq(100);
    });
  
    it("sets #isClaimed", async () => {
      const proof0 = tree.getProof(0, await clint.getAddress(), BigNumber.from(100))
      expect(await faithAirdrop.isClaimed(0)).to.eq(false);
      expect(await faithAirdrop.isClaimed(1)).to.eq(false);
      await faithAirdrop.claim(0, await clint.getAddress(), 100, proof0);
      expect(await faithAirdrop.isClaimed(0)).to.eq(true);
      expect(await faithAirdrop.isClaimed(1)).to.eq(false);
    });
  
    it("cannot allow two claims", async () => {
      const proof0 = tree.getProof(0, await clint.getAddress(), BigNumber.from(100))
      await faithAirdrop.claim(0, await clint.getAddress(), 100, proof0);
      await expect(faithAirdrop.claim(0, await clint.getAddress(), 100, proof0)).to.be.revertedWith(
        'MerkleDistributor: Drop already claimed.'
      );
    });
  
    it("cannot claim more than once: 0 and then 1", async () => {
      await faithAirdrop.claim(
        0,
        await clint.getAddress(),
        100,
        tree.getProof(0, await clint.getAddress(), BigNumber.from(100)),
      );
      await faithAirdrop.claim(
        1,
        await alan.getAddress(),
        101,
        tree.getProof(1, await alan.getAddress(), BigNumber.from(101))
      );
  
      await expect(
        faithAirdrop.claim(0, await clint.getAddress(), 100, tree.getProof(0, await clint.getAddress(), BigNumber.from(100)))
      ).to.be.revertedWith('MerkleDistributor: Drop already claimed.');
    });
  
    it("cannot claim more than once: 1 and then 0", async () => {
      await faithAirdrop.claim(
        1,
        await alan.getAddress(),
        101,
        tree.getProof(1, await alan.getAddress(), BigNumber.from(101))
      );
      await faithAirdrop.claim(
        0,
        await clint.getAddress(),
        100,
        tree.getProof(0, await clint.getAddress(), BigNumber.from(100))
      );
  
      await expect(
        faithAirdrop.claim(1, await alan.getAddress(), 101, tree.getProof(1, await alan.getAddress(), BigNumber.from(101)))
      ).to.be.revertedWith('MerkleDistributor: Drop already claimed.');
    });
  
    it("cannot claim for address other than proof", async () => {
      const proof0 = tree.getProof(0, await clint.getAddress(), BigNumber.from(100));
      await expect(faithAirdrop.claim(1, await alan.getAddress(), 101, proof0)).to.be.revertedWith(
        'MerkleDistributor: Invalid proof.'
      );
    });
  
    it("cannot claim more than proof", async () => {
      const proof0 = tree.getProof(0, await clint.getAddress(), BigNumber.from(100));
      await expect(faithAirdrop.claim(0, await clint.getAddress(), 101, proof0)).to.be.revertedWith(
        'MerkleDistributor: Invalid proof.'
      );
    });
  
    it("claim multiple", async () => {
      const proofVince = tree.getProof(2, await vince.getAddress(), BigNumber.from(50));
      await expect(faithAirdrop.claim(2, await vince.getAddress(), 50, proofVince))
        .to.emit(faithAirdrop, 'Claimed')
        .withArgs(2, await vince.getAddress(), 50);
  
      const proofCurry = tree.getProof(3, await curry.getAddress(), BigNumber.from(51));
      await expect(faithAirdrop.claim(3, await curry.getAddress(), 51, proofCurry))
        .to.emit(faithAirdrop, 'Claimed')
        .withArgs(3, await curry.getAddress(), 51);
  
      const proofLebron = tree.getProof(4, await lebron.getAddress(), BigNumber.from(96));
      await expect(faithAirdrop.claim(4, await lebron.getAddress(), 96, proofLebron))
        .to.emit(faithAirdrop, 'Claimed')
        .withArgs(4, await lebron.getAddress(), 96);
  
      const proofJokic = tree.getProof(5, await jokic.getAddress(), BigNumber.from(99));
      await expect(faithAirdrop.claim(5, await jokic.getAddress(), 99, proofJokic))
        .to.emit(faithAirdrop, 'Claimed')
        .withArgs(5, await jokic.getAddress(), 99);
    });

    it("cannot claim after claim period", async () => {
      // clint can claim
      const proof0 = tree.getProof(0, await clint.getAddress(), BigNumber.from(100));
      const faithBalanceBefore = await faith.balances(await clint.getAddress());
      expect(faithBalanceBefore.lifeTimeFaith).to.eq(0);
      expect(faithBalanceBefore.usableFaith).to.eq(0);
      await faithAirdrop.claim(0, await clint.getAddress(), 100, proof0);
      const faithBalanceAfter = await faith.balances(await clint.getAddress());
      expect(faithBalanceAfter.lifeTimeFaith).to.eq(100);
      expect(faithBalanceAfter.usableFaith).to.eq(100);

      // fast forward and try for alan
      const now = await blockTimestamp();
      const fastForward = now + (86400 * 3);
      await mineForwardSeconds(fastForward);
      const proof1 = tree.getProof(1, await alan.getAddress(), BigNumber.from(101));
      await shouldThrow(faithAirdrop.claim(0, await alan.getAddress(), 101, proof1), /invalid claim period/);
    });
  });


  describe("realistic size tree", async () => {
    let faithAirdrop: FaithMerkleAirdrop;
    let tree: BalanceTree;
    
    const NUM_LEAVES = 100_000;
    const NUM_SAMPLES = 25;
    const elements: { account: string; amount: BigNumber }[] = [];
    
    beforeEach( async () => {
      
      for (let i = 0; i < NUM_LEAVES; i++) {
        const node = { account: await clint.getAddress(), amount: BigNumber.from(100) }
        elements.push(node)
      }
      tree = new BalanceTree(elements);

      faith = await new Faith__factory(owner).deploy();
      faithAirdrop = await new FaithMerkleAirdrop__factory(owner).deploy(faith.address, tree.getHexRoot());

      // let airdrop distributor manage faith
      await faith.addManager(faithAirdrop.address);
  
      // set time to start claim
      await faithAirdrop.setClaimStartTime(await blockTimestamp() + 1);
      await faithAirdrop.setClaimEndTime(await blockTimestamp() + 1000);
    });

    it("proof verification works", async () => {
      const root = Buffer.from(tree.getHexRoot().slice(2), 'hex')
      for (let i = 0; i < NUM_LEAVES; i += NUM_LEAVES / NUM_SAMPLES) {
        const proof = tree
          .getProof(i, await clint.getAddress(), BigNumber.from(100))
          .map((el) => Buffer.from(el.slice(2), 'hex'))
        const validProof = BalanceTree.verifyProof(i, await clint.getAddress(), BigNumber.from(100), proof, root)
        expect(validProof).to.be.true
      }
    });

    it("no double claims in random distribution", async () => {
      for (let i = 0; i < 25; i += Math.floor(Math.random() * (NUM_LEAVES / NUM_SAMPLES))) {
        const proof = tree.getProof(i, await clint.getAddress(), BigNumber.from(100));
        await faithAirdrop.claim(i, await clint.getAddress(), 100, proof);
        await expect(faithAirdrop.claim(i, await clint.getAddress(), 100, proof)).to.be.revertedWith(
          'MerkleDistributor: Drop already claimed.'
        );
      }
    });

  });
}); 