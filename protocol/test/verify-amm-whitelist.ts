import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { 
  AMMWhitelist,
  AMMWhitelist__factory,
  TempleFraxAMMRouter, 
  TempleFraxAMMRouter__factory,
  FakeERC20, FakeERC20__factory,
  TempleERC20Token, TempleERC20Token__factory,
  TempleTreasury, TempleTreasury__factory,
  TempleUniswapV2Pair, TempleUniswapV2Pair__factory} from "../typechain";
import { shouldThrow } from "./helpers";

describe("Verify Quest for AMM whitelist Complete tests", async () => {
  let ammRouter: TempleFraxAMMRouter;
  let ammWhitelist: AMMWhitelist;
  let templeToken: TempleERC20Token;
  let fraxToken: FakeERC20;
  let treasury: TempleTreasury;
  let pair: TempleUniswapV2Pair;
  let owner: Signer;
  let verifiedQuester: Signer;
  let nonVerifiedQuester: Signer;
  let daoVerifier: Wallet;
  let fakeVerifier: Wallet;

  beforeEach(async () => {
    [owner, verifiedQuester, nonVerifiedQuester] = (await ethers.getSigners()) as Signer[];

    daoVerifier = ethers.Wallet.createRandom()
    fakeVerifier = ethers.Wallet.createRandom()

    templeToken = await new TempleERC20Token__factory(owner).deploy();
    fraxToken = await new FakeERC20__factory(owner).deploy("STABLEC", "STABLEC");

    treasury = await new TempleTreasury__factory(owner).deploy(
      templeToken.address,
      fraxToken.address,
    );
    
    pair = await new TempleUniswapV2Pair__factory(owner).deploy(await owner.getAddress(), templeToken.address, fraxToken.address);
    ammRouter = await new TempleFraxAMMRouter__factory(owner).deploy(
      pair.address,
      templeToken.address,
      fraxToken.address,
      treasury.address,
      treasury.address, // for testing, make the earning account treasury
      {frax: 1000000, temple: 4000000},
      100000, /* threshold decay per block */
      {frax: 1000000, temple: 1000000},
      {frax: 1000000, temple: 12000000},
    );

    ammWhitelist = await new AMMWhitelist__factory(owner).deploy(
      ammRouter.address,
      daoVerifier.address
    )
    await ammRouter.connect(owner).grantRole(await ammRouter.CAN_ADD_ALLOWED_USER(), ammWhitelist.address);
  });

  it("Only owner can change verifier", async () => {
    await shouldThrow(ammWhitelist.connect(nonVerifiedQuester).setVerifier(await nonVerifiedQuester.getAddress()), /Ownable:/);
    await ammWhitelist.setVerifier(await nonVerifiedQuester.getAddress());
    expect(await ammWhitelist.verifier()).eq(await nonVerifiedQuester.getAddress());
  });

  it("Once verified, a user can whitelist themselves", async() => {
    const digest = await ammWhitelist.digestFor(await verifiedQuester.getAddress());
    const sig = daoVerifier._signingKey().signDigest(digest);

    expect((await ammRouter.allowed(await verifiedQuester.getAddress()))).is.false;
    await ammWhitelist.connect(verifiedQuester).verify(sig.v, sig.r, sig.s);
    expect((await ammRouter.allowed(await verifiedQuester.getAddress()))).is.true;
  });

  it("A verified signature can only be used once", async() => {
    const digest = await ammWhitelist.digestFor(await verifiedQuester.getAddress());
    const sig = daoVerifier._signingKey().signDigest(digest);

    expect((await ammRouter.allowed(await verifiedQuester.getAddress()))).is.false;
    await ammWhitelist.connect(verifiedQuester).verify(sig.v, sig.r, sig.s);
    expect((await ammRouter.allowed(await verifiedQuester.getAddress()))).is.true;

    await shouldThrow(ammWhitelist.connect(verifiedQuester).verify(sig.v, sig.r, sig.s), /invalid signature/);
  });

  it("Verified signatures cannot be shared", async() => {
    const digest = await ammWhitelist.digestFor(await verifiedQuester.getAddress());
    const sig = daoVerifier._signingKey().signDigest(digest);

    expect((await ammRouter.allowed(await nonVerifiedQuester.getAddress()))).is.false;
    expect((await ammRouter.allowed(await verifiedQuester.getAddress()))).is.false;

    await shouldThrow(ammWhitelist.connect(nonVerifiedQuester).verify(sig.v, sig.r, sig.s), /invalid signature/);

    expect((await ammRouter.allowed(await nonVerifiedQuester.getAddress()))).is.false;
    expect((await ammRouter.allowed(await verifiedQuester.getAddress()))).is.false;
  });

  it("Only daoVerifier can sign requests", async() => {
    const digest = await ammWhitelist.digestFor(await nonVerifiedQuester.getAddress());
    const sig = fakeVerifier._signingKey().signDigest(digest);

    expect((await ammRouter.allowed(await nonVerifiedQuester.getAddress()))).is.false;
    await shouldThrow(ammWhitelist.connect(nonVerifiedQuester).verify(sig.v, sig.r, sig.s), /invalid signature/);
    expect((await ammRouter.allowed(await nonVerifiedQuester.getAddress()))).is.false;
  });
});
