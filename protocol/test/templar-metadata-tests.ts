import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { 
  Templar, Templar__factory, 
  TemplarMetadata, TemplarMetadata__factory,
} from "../typechain";

const DISCORD_ID_1 = 1000;
const DISCORD_ID_2 = 1001;
const DISCORD_ID_3 = 1001;

describe("Templar Metadata", async () => {
  let TEMPLAR: Templar;
  let TEMPLAR_METADATA: TemplarMetadata;

  let owner: Signer;
  let assigner: Signer;
  let amanda: Signer;
  let ben: Signer;
  let sarah: Signer;
 
  beforeEach(async () => {
    [owner, assigner, amanda, ben, sarah] = await ethers.getSigners();
    TEMPLAR = await new Templar__factory(owner).deploy();
    TEMPLAR_METADATA = await new TemplarMetadata__factory(owner).deploy(TEMPLAR.address);

    await TEMPLAR.grantRole(await TEMPLAR.CAN_ASSIGN(), await assigner.getAddress());
    await TEMPLAR_METADATA.grantRole(await TEMPLAR_METADATA.CAN_UPDATE(), await assigner.getAddress());

    // Setup some templars.
    const templar = TEMPLAR.connect(assigner);
    await templar.assign(await amanda.getAddress(), DISCORD_ID_1);
    await templar.assign(await ben.getAddress(), DISCORD_ID_2);
    await templar.assign(await sarah.getAddress(), DISCORD_ID_3);
  })

  it("Only configured access role can update", async () => {
    // The assigner can set roles
    {
      const templarMetadata = TEMPLAR_METADATA.connect(assigner);
      await templarMetadata.setRole(DISCORD_ID_1, "acolyte");
    }

    // Ben cannot
    {
      const templarMetadata = TEMPLAR_METADATA.connect(ben);
      await expect(templarMetadata.setRole(DISCORD_ID_1, "acolyte"))
        .to.be.revertedWithCustomError(templarMetadata, "AccessControlUnauthorizedAccount");
    }
  });

  it("Setting roles works as expected", async () => {

    // Roles can't be set when there isn't yet an NFT minted.
    const templarMetadata = TEMPLAR_METADATA.connect(assigner);
    await expect(templarMetadata.setRole(4500, "acolyte"))
      .to.be.revertedWithCustomError(TEMPLAR, "InvalidTemplar");

    // updates work
    await expect(templarMetadata.setRole(DISCORD_ID_1, "initiate"))
        .to.emit(TEMPLAR_METADATA, "UpdateTempleRole");

    // noops don't emit events.
    await expect(templarMetadata.setRole(DISCORD_ID_1, "initiate"))
        .to.not.emit(TEMPLAR_METADATA, "UpdateTempleRole");

    await expect(templarMetadata.setRole(DISCORD_ID_1, "acolyte"))
        .to.emit(TEMPLAR_METADATA, "UpdateTempleRole");
  });

});
