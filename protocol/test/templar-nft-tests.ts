import { ethers, network } from "hardhat";
import { ContractFactory, Signer } from "ethers";
import { expect } from "chai";

import { Templar } from "../typechain/Templar";
import { shouldThrow } from "./helpers";
import { Templar__factory } from "../typechain/factories/Templar__factory";

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
    await (await TEMPLAR.grantRole(canAssignRole, assignerAddress)).wait();

  })

  it("Only owner can setBaseUri", async () => {

    // Owner can
    await TEMPLAR.setBaseUri("https://new-base-uri/");

    // Amanda cannot
    const templar = TEMPLAR.connect(amanda);
    await expect(templar.setBaseUri("https://new-base-uri2/"))
      .to.be.revertedWith("AccessControl:");
  });

  it("Only configured role can assign", async () => {

    const amandaAddress: string = await amanda.getAddress();

    // The assigner can assign NFTs
    {
        const templar = TEMPLAR.connect(assigner);
        await templar.assign(amandaAddress, 1000, "acolyte");
    }

    // Ben cannot
    {
      const templar = TEMPLAR.connect(ben);
      await expect(templar.assign(amandaAddress, 1000, "acolyte"))
        .to.be.revertedWith("AccessControl:");
    }
  });

  it("Assignment mints an NFT", async () => {

    const amandaAddress: string = await amanda.getAddress();

    const DISCORD_ID = 1000;
    const TEMPLE_ROLE = "acolyte";
    const templar = TEMPLAR.connect(assigner);
    await (await templar.assign(amandaAddress, DISCORD_ID, TEMPLE_ROLE)).wait();

    expect(await TEMPLAR.ownerOf(DISCORD_ID)).to.eq(amandaAddress);
    expect(await TEMPLAR.templeRole(DISCORD_ID)).to.eq(TEMPLE_ROLE);
    expect(await TEMPLAR.tokenURI(DISCORD_ID)).to.eq("https://discordapp.com/users/1000");
  });

  it("Ressignment transfers an NFT, updating role if necessary", async () => {

    const amandaAddress: string = await amanda.getAddress();
    const benAddress: string = await ben.getAddress();


    const DISCORD_ID = 1000;
    const TEMPLE_ROLE = "acolyte";
    const templar = TEMPLAR.connect(assigner);

    await (await templar.assign(amandaAddress, DISCORD_ID, TEMPLE_ROLE)).wait();

    await (await templar.assign(benAddress, DISCORD_ID, "initiate")).wait();

    expect(await TEMPLAR.ownerOf(DISCORD_ID)).to.eq(benAddress);
    expect(await TEMPLAR.templeRole(DISCORD_ID)).to.eq("initiate");
    expect(await TEMPLAR.tokenURI(DISCORD_ID)).to.eq("https://discordapp.com/users/1000");
  });


  it("Updating the baseUri works as expected", async () => {

    const amandaAddress: string = await amanda.getAddress();

    const DISCORD_ID = 1000;
    const TEMPLE_ROLE = "acolyte";
    const templar = TEMPLAR.connect(assigner);
    await (await templar.assign(amandaAddress, DISCORD_ID, TEMPLE_ROLE)).wait();
    expect(await TEMPLAR.tokenURI(DISCORD_ID)).to.eq("https://discordapp.com/users/1000");

    (await TEMPLAR.setBaseUri("https://temple.dao/users/")).wait();

    expect(await TEMPLAR.tokenURI(DISCORD_ID)).to.eq("https://temple.dao/users/1000");
  });

});