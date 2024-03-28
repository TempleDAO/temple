import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { TypedDataDomain, TypedDataField, TypedDataSigner } from "@ethersproject/abstract-signer";
import { expect } from "chai";

import { 
  Templar, Templar__factory, 
  TemplarMetadata, TemplarMetadata__factory,
  ElderElection, ElderElection__factory,
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const DISCORD_ID_1 = 1000;
const DISCORD_ID_2 = 1001;
const DISCORD_ID_3 = 1001;

const TEMPLE_ROLE_ACOLYTE = "acolyte";
const TEMPLE_ROLE_INITIATE = "initiate";

type MySigner = SignerWithAddress & TypedDataSigner;

describe("Elder Election", async () => {
  let TEMPLAR: Templar;
  let TEMPLAR_METADATA: TemplarMetadata;
  let ELDER_ELECTION: ElderElection;

  let owner: MySigner;
  let assigner: MySigner;
  let nominator: MySigner;
  let amanda: MySigner;
  let ben: MySigner;
  let sarah: MySigner;
 
  beforeEach(async () => {
    [owner, assigner, nominator, amanda, ben, sarah] = (await ethers.getSigners() as MySigner[]);
    TEMPLAR = await new Templar__factory(owner).deploy();
    TEMPLAR_METADATA = await new TemplarMetadata__factory(owner).deploy(TEMPLAR.address);
    ELDER_ELECTION = await new ElderElection__factory(owner).deploy(TEMPLAR.address);

    await TEMPLAR.grantRole(await TEMPLAR.CAN_ASSIGN(), await assigner.getAddress());
    await TEMPLAR_METADATA.grantRole(await TEMPLAR_METADATA.CAN_UPDATE(), await assigner.getAddress());
    await ELDER_ELECTION.grantRole(await ELDER_ELECTION.CAN_NOMINATE(), await nominator.getAddress());

    // Setup some templars.
    const templar = TEMPLAR.connect(assigner);
    const templarMetadata = TEMPLAR_METADATA.connect(assigner);

    await templar.assign(await amanda.getAddress(), DISCORD_ID_1);
    await templarMetadata.setRole(DISCORD_ID_1, TEMPLE_ROLE_ACOLYTE);
    await templar.assign(await ben.getAddress(), DISCORD_ID_2);
    await templarMetadata.setRole(DISCORD_ID_2, TEMPLE_ROLE_ACOLYTE);
    await templar.assign(await sarah.getAddress(), DISCORD_ID_3);
    await templarMetadata.setRole(DISCORD_ID_3, TEMPLE_ROLE_INITIATE);
  })

  it("nominations work", async () => {
    {
      const election = ELDER_ELECTION.connect(amanda);
      await expect(election.nominate(DISCORD_ID_1))
        .to.be.revertedWithCustomError(ELDER_ELECTION, "AccessControlUnauthorizedAccount");
    }

    {
      const election = ELDER_ELECTION.connect(nominator);
      expect(await election.numCandidates()).to.eq(0);
      await expect(election.nominate(DISCORD_ID_1))
        .to.emit(ELDER_ELECTION, "UpdateNomination");
      expect(await election.numCandidates()).to.eq(1);

      await expect(election.nominate(0))
        .to.be.revertedWithCustomError(TEMPLAR, "InvalidTemplar")
        .withArgs(0);
    }
  });

  it("resignations work", async () => {
    {
      const election = ELDER_ELECTION.connect(amanda);
      await expect(election.resign(DISCORD_ID_1))
        .to.be.revertedWithCustomError(ELDER_ELECTION, "AccessControlUnauthorizedAccount");
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
        .to.be.revertedWithCustomError(TEMPLAR, "InvalidTemplar")
        .withArgs(0);
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
      .to.be.revertedWithCustomError(ELDER_ELECTION, "TooManyEndorsements");
  });

  it("relayed endorsements work", async () => {

    const provider = ethers.getDefaultProvider();
    const chainId = 31337;

    {
      const election = ELDER_ELECTION.connect(nominator);
      await election.nominate(DISCORD_ID_1);
      await election.nominate(DISCORD_ID_2);
    }

    async function signedReq(voter: MySigner, discordIds: number[]):
       Promise<{req: ElderElection.EndorsementReqStruct, signature: Uint8Array}> {

      const block = await provider.getBlock(await provider.getBlockNumber());
      const now = block.timestamp;

      const account = await voter.getAddress();
      const deadline = now + 3600;
      const nonce = await ELDER_ELECTION.nonces(account);

      const req: ElderElection.EndorsementReqStruct = {
        account,
        discordIds,
        deadline: deadline,
        nonce: nonce,
      };

      const domain: TypedDataDomain = {
        name: 'ElderElection',
        version: '1',
        chainId,
      };

      const types: Record<string, TypedDataField[]> = {
        EndorsementReq: [
          { name: 'account', type: 'address' },
          { name: 'discordIds', type: 'uint256[]' },
          { name: 'deadline', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },

        ]
      };

      const value: Record<string, unknown> = {
        account: req.account,
        discordIds: req.discordIds,
        deadline: deadline,
        nonce: nonce,
      };

      const signature = await voter._signTypedData(domain, types, value);

      return {
        req,
        signature: ethers.utils.arrayify(signature),
      }
    } 

    {
      const  {req} = await signedReq(ben, [DISCORD_ID_1]);
      const  {signature} = await signedReq(amanda, [DISCORD_ID_1]);
      await expect(ELDER_ELECTION.relayedSetEndorsementsFor(
        req,
        signature,
      )).to.be.revertedWithCustomError(ELDER_ELECTION, "InvalidSignature")
        .withArgs(req.account);
    }

    {
      // A correctly signed request will succeed
      const  {req, signature} = await signedReq(ben, [DISCORD_ID_1]);
      await expect(ELDER_ELECTION.relayedSetEndorsementsFor(
        req,
        signature,
      )).to.emit(ELDER_ELECTION, "UpdateEndorsements");

      // Replaying a correctly signed request should fail
      await expect(ELDER_ELECTION.relayedSetEndorsementsFor(
        req,
        signature,
      )).to.be.revertedWithCustomError(ELDER_ELECTION, "InvalidNonce")
        .withArgs(req.account);
    }

    {
      // Check multiple endorsements
      const  {req, signature} = await signedReq(amanda, [DISCORD_ID_2, DISCORD_ID_3]);
      await expect(ELDER_ELECTION.relayedSetEndorsementsFor(
        req,
        signature,
      )).to.emit(ELDER_ELECTION, "UpdateEndorsements");
    }

    {      
      const {req, signature} = await signedReq(ben, [DISCORD_ID_1]);
      await expect(ELDER_ELECTION.relayedSetEndorsementsFor(
        { ...req,
          deadline: BigNumber.from(req.deadline).sub(7200),
        },
        signature,
      )).to.be.revertedWithCustomError(ELDER_ELECTION, "DeadlineExpired");
    }
  });

});
