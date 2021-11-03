import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { 
  VerifyQuest,
  VerifyQuest__factory,
  OpeningCeremony, 
  OpeningCeremony__factory} from "../typechain";
import { shouldThrow } from "./helpers";
import { splitSignature } from "@ethersproject/bytes";
import { hashMessage } from "@ethersproject/hash";


describe.only("Verify Quest Complete tests", async () => {
  let openingCeremony: OpeningCeremony;
  let verifyQuest: VerifyQuest;

  let owner: Signer;
  let verifiedQuester: Signer;
  let nonVerifiedQuester: Signer;
  let daoVerifier: Wallet;
  let fakeVerifier: Wallet;

  beforeEach(async () => {
    [owner, verifiedQuester, nonVerifiedQuester] = (await ethers.getSigners()) as Signer[];

    daoVerifier = ethers.Wallet.createRandom()
    fakeVerifier = ethers.Wallet.createRandom()

    // initialise with dummy values, as we don't need any of them to
    // test addVerifiedUser
    openingCeremony = await new OpeningCeremony__factory(owner).deploy(
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      0,
      0,
      0,
      {numerator: 1, denominator: 100},
      {numerator: 1, denominator: 100},
    );

    verifyQuest = await new VerifyQuest__factory(owner).deploy(
      openingCeremony.address,
      daoVerifier.address
    )

    await openingCeremony.grantRole(await openingCeremony.CAN_ADD_VERIFIED_USER(), verifyQuest.address);
  })

  it("Only owner can change verifier", async () => {
    await shouldThrow(verifyQuest.connect(nonVerifiedQuester).setVerifier(await nonVerifiedQuester.getAddress()), /Ownable:/);
    await verifyQuest.setVerifier(await nonVerifiedQuester.getAddress());
    expect(await verifyQuest.verifier()).eq(await nonVerifiedQuester.getAddress());
  });

  it("Once verified, a user can whitelist themselves", async() => {
    const digest = await verifyQuest.digestFor(await verifiedQuester.getAddress());
    const sig = daoVerifier._signingKey().signDigest(digest);

    expect((await openingCeremony.users(await verifiedQuester.getAddress())).isVerified).is.false;
    await verifyQuest.connect(verifiedQuester).verify(sig.v, sig.r, sig.s);
    expect((await openingCeremony.users(await verifiedQuester.getAddress())).isVerified).is.true;
  });

  it("A verified signature can only be used once", async() => {
    const digest = await verifyQuest.digestFor(await verifiedQuester.getAddress());
    const sig = daoVerifier._signingKey().signDigest(digest);

    expect((await openingCeremony.users(await verifiedQuester.getAddress())).isVerified).is.false;
    await verifyQuest.connect(verifiedQuester).verify(sig.v, sig.r, sig.s);
    expect((await openingCeremony.users(await verifiedQuester.getAddress())).isVerified).is.true;

    await shouldThrow(verifyQuest.connect(verifiedQuester).verify(sig.v, sig.r, sig.s), /invalid signature/);
  });

  it("Can't verify twice", async() => {
    expect((await openingCeremony.users(await verifiedQuester.getAddress())).isVerified).is.false;

    const verify = async () => {
      const digest = await verifyQuest.digestFor(await verifiedQuester.getAddress());
      const sig = daoVerifier._signingKey().signDigest(digest);
      await verifyQuest.connect(verifiedQuester).verify(sig.v, sig.r, sig.s);
    }

    await verify();
    await shouldThrow(verify(), /Address already verified/);
  });

  it("Verified signatures cannot be shared", async() => {
    const digest = await verifyQuest.digestFor(await verifiedQuester.getAddress());
    const sig = daoVerifier._signingKey().signDigest(digest);

    expect((await openingCeremony.users(await nonVerifiedQuester.getAddress())).isVerified).is.false;
    expect((await openingCeremony.users(await verifiedQuester.getAddress())).isVerified).is.false;

    await shouldThrow(verifyQuest.connect(nonVerifiedQuester).verify(sig.v, sig.r, sig.s), /invalid signature/);

    expect((await openingCeremony.users(await nonVerifiedQuester.getAddress())).isVerified).is.false;
    expect((await openingCeremony.users(await verifiedQuester.getAddress())).isVerified).is.false;
  });

  it("Only daoVerifier can sign requests", async() => {
    const digest = await verifyQuest.digestFor(await nonVerifiedQuester.getAddress());
    const sig = fakeVerifier._signingKey().signDigest(digest);

    expect((await openingCeremony.users(await nonVerifiedQuester.getAddress())).isVerified).is.false;
    await shouldThrow(verifyQuest.connect(nonVerifiedQuester).verify(sig.v, sig.r, sig.s), /invalid signature/);
    expect((await openingCeremony.users(await nonVerifiedQuester.getAddress())).isVerified).is.false;
  });
});