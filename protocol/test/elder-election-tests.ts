import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { Templar } from "../typechain/Templar";
import { Templar__factory } from "../typechain/factories/Templar__factory";

import { ElderElection } from "../typechain/ElderElection";
import { ElderElection__factory } from "../typechain/factories/ElderElection__factory";

const DISCORD_ID_1 = 1000;
const DISCORD_ID_2 = 1001;
const DISCORD_ID_3 = 1001;

const TEMPLE_ROLE_ACOLYTE = "acolyte";
const TEMPLE_ROLE_INITIATE = "initiate";

describe("Elder Election", async () => {
  let TEMPLAR: Templar;
  let ELDER_ELECTION: ElderElection;

  let owner: Signer;
  let assigner: Signer;
  let nominator: Signer;
  let amanda: Signer;
  let ben: Signer;
  let sarah: Signer;
 
  beforeEach(async () => {
    [owner, assigner, nominator, amanda, ben, sarah] = await ethers.getSigners();
    TEMPLAR = await new Templar__factory(owner).deploy();
    ELDER_ELECTION = await new ElderElection__factory(owner).deploy(TEMPLAR.address);

    await TEMPLAR.grantRole(await TEMPLAR.CAN_ASSIGN(), await assigner.getAddress());
    await ELDER_ELECTION.grantRole(await ELDER_ELECTION.CAN_NOMINATE(), await nominator.getAddress());

    // Setup some templars.
    const templar = TEMPLAR.connect(assigner);
    await templar.assign(await amanda.getAddress(), DISCORD_ID_1, TEMPLE_ROLE_ACOLYTE);
    await templar.assign(await ben.getAddress(), DISCORD_ID_2, TEMPLE_ROLE_ACOLYTE);
    await templar.assign(await sarah.getAddress(), DISCORD_ID_3, TEMPLE_ROLE_INITIATE);

  })

  it("nominations work", async () => {
    {
      const election = ELDER_ELECTION.connect(amanda);
      await expect(election.nominate(DISCORD_ID_1))
        .to.be.revertedWith("AccessControl");
    }

    {
      const election = ELDER_ELECTION.connect(nominator);
      expect(await election.numCandidates()).to.eq(0);
      await expect(election.nominate(DISCORD_ID_1))
        .to.emit(ELDER_ELECTION, "UpdateNomination");
      expect(await election.numCandidates()).to.eq(1);

      await expect(election.nominate(0))
        .to.be.revertedWith("InvalidTemplar");
    }
  });

  it("resignations work", async () => {
    {
      const election = ELDER_ELECTION.connect(amanda);
      await expect(election.resign(DISCORD_ID_1))
        .to.be.revertedWith("AccessControl");
    }

    {
      const election = ELDER_ELECTION.connect(nominator);
      await expect(election.nominate(DISCORD_ID_1))
        .to.emit(ELDER_ELECTION, "UpdateNomination");
      expect(await election.numCandidates()).to.eq(1);
      await expect(election.resign(DISCORD_ID_1))
        .to.emit(ELDER_ELECTION, "UpdateNomination");
      expect(await election.numCandidates()).to.eq(0);

      await expect(election.resign(0))
        .to.be.revertedWith("InvalidTemplar");
    }
  });

  it("endorsements work", async () => {
    {
      const election = ELDER_ELECTION.connect(nominator);
      await election.nominate(DISCORD_ID_1);
      await election.nominate(DISCORD_ID_2);
    }

    await expect(ELDER_ELECTION.connect(ben).setEndorsements([DISCORD_ID_1]))
    .to.emit(ELDER_ELECTION, "UpdateEndorsements");
    await ELDER_ELECTION.connect(sarah).setEndorsements([DISCORD_ID_1,DISCORD_ID_2]);
    await ELDER_ELECTION.connect(sarah).setEndorsements([]);

    await expect(ELDER_ELECTION.connect(ben).setEndorsements([DISCORD_ID_1,DISCORD_ID_2,DISCORD_ID_3]))
    .to.be.revertedWith("TooManyEndorsements");
  });


});