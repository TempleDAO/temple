import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { 
  Templar, Templar__factory, 
} from "../typechain";
const DISCORD_ID = 1000;

describe("Templar NFT", async () => {
  let TEMPLAR: Templar;
  let owner: Signer
  let assigner: Signer
  let amanda: Signer
  let ben: Signer;
 
  beforeEach(async () => {
    [owner, assigner, amanda, ben] = await ethers.getSigners();
    TEMPLAR = await new Templar__factory(owner).deploy();

    const assignerAddress: string = await assigner.getAddress();
    const canAssignRole: string  = await TEMPLAR.CAN_ASSIGN();
    await TEMPLAR.grantRole(canAssignRole, assignerAddress);
  })

  it("Only owner can grant roles", async () => {    
    await expect(
      TEMPLAR.connect(amanda).grantRole(TEMPLAR.CAN_ASSIGN(), amanda.getAddress()))
      .to.be.revertedWithCustomError(TEMPLAR, "AccessControlUnauthorizedAccount");
  });

  it("Only owner can setBaseUri", async () => {

    // Owner can
    await expect(TEMPLAR.setBaseUri("https://new-base-uri/"))
      .to.emit(TEMPLAR, "BaseUriUpdated");

    expect(await TEMPLAR.baseUri()).to.eq("https://new-base-uri/");

    // Amanda cannot
    const templar = TEMPLAR.connect(amanda);
    await expect(
      templar.setBaseUri("https://new-base-uri2/"))
      .to.be.revertedWithCustomError(templar, "AccessControlUnauthorizedAccount");
  });

  it("Only configured role can assign", async () => {

    const amandaAddress: string = await amanda.getAddress();

    // The assigner can assign NFTs
    {
        const templar = TEMPLAR.connect(assigner);
        await templar.assign(amandaAddress, 1000);
    }

    // Ben cannot
    {
      const templar = TEMPLAR.connect(ben);
      await expect(
        templar.assign(amandaAddress, 1000))
        .to.be.revertedWithCustomError(templar, "AccessControlUnauthorizedAccount");
    }
  });

  it("Can't assign to address 0", async () => {
    const templar = TEMPLAR.connect(assigner);
    await expect (templar.assign(ethers.constants.AddressZero, 1000))
      .to.be.revertedWithCustomError(templar, "InvalidAddress")
      .withArgs(ethers.constants.AddressZero);
  });

  it("Assignment mints an NFT", async () => {
    const amandaAddress: string = await amanda.getAddress();

    const templar = TEMPLAR.connect(assigner);
    await templar.assign(amandaAddress, DISCORD_ID);

    expect(await TEMPLAR.ownerOf(DISCORD_ID)).to.eq(amandaAddress);
    expect(await TEMPLAR.tokenURI(DISCORD_ID)).to.eq("https://discordapp.com/users/1000");
  });

  it("Ressignment transfers an NFT", async () => {

    const amandaAddress: string = await amanda.getAddress();
    const benAddress: string = await ben.getAddress();

    const templar = TEMPLAR.connect(assigner);

    {
      const receipt = await (await templar.assign(amandaAddress, DISCORD_ID)).wait();
      const events = receipt.events?.filter((ev) => ev.event == "Transfer")
      expect(events).to.have.length(1);
    }
    {
      const receipt = await (await templar.assign(benAddress, DISCORD_ID)).wait();
      const events = receipt.events?.filter((ev) => ev.event == "Transfer")
      expect(events).to.have.length(1);
    }

    expect(await TEMPLAR.ownerOf(DISCORD_ID)).to.eq(benAddress);
    expect(await TEMPLAR.tokenURI(DISCORD_ID)).to.eq("https://discordapp.com/users/1000");
  });


  it("Updating the baseUri works as expected", async () => {

    const amandaAddress: string = await amanda.getAddress();

    const templar = TEMPLAR.connect(assigner);
    await templar.assign(amandaAddress, DISCORD_ID);
    expect(await TEMPLAR.tokenURI(DISCORD_ID)).to.eq("https://discordapp.com/users/1000");

    await TEMPLAR.setBaseUri("https://temple.dao/users/");

    expect(await TEMPLAR.tokenURI(DISCORD_ID)).to.eq("https://temple.dao/users/1000");
  });

  it("checkExists works as expected", async () => {
    const amandaAddress: string = await amanda.getAddress();

    const templar = TEMPLAR.connect(assigner);
    await templar.assign(amandaAddress, DISCORD_ID);

    await TEMPLAR.checkExists(DISCORD_ID);
    await expect (TEMPLAR.checkExists(0))
      .to.be.revertedWithCustomError(TEMPLAR, "InvalidTemplar")
      .withArgs(0);
  });

});