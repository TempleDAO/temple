import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { 
    HoneyPot,
    HoneyPot__factory,
} from "../../../typechain";
import { shouldThrow } from "../../helpers";

describe("HoneyPot Mint Pass", async () => { 

    let honeyPot: HoneyPot
    let owner: Signer
    let nonOwner: Signer
    let verifiedMinter: Signer
    let nonVerifiedMinter: Signer

    let verifier: Wallet
    let fakeVerifier: Wallet

    beforeEach(async () => {
        [owner, nonOwner, verifiedMinter, nonVerifiedMinter] = (await ethers.getSigners()) as Signer[];
    
        verifier = ethers.Wallet.createRandom()
        fakeVerifier = ethers.Wallet.createRandom()
    
        honeyPot = await new HoneyPot__factory(owner).deploy(
             "Honey Pot Mint Pass",
             "HP",
             verifier.address,
        );
    })

    it("Only owner can change verifier", async () => {
        await shouldThrow(honeyPot.connect(nonOwner).setVerifier(await fakeVerifier.getAddress()), /Ownable:/);
        await honeyPot.connect(owner).setVerifier(await fakeVerifier.getAddress());
        expect(await honeyPot.verifier()).eq(await fakeVerifier.getAddress());
    });

    it("Only owner can pause & unpause minting", async () => {
        // Not owner
        await shouldThrow(honeyPot.connect(nonOwner).pause(), /Ownable:/);
        await shouldThrow(honeyPot.connect(nonOwner).unpause(), /Ownable:/);

        // Owner
        await honeyPot.connect(owner).pause()
        expect(await honeyPot.paused()).eq(true);

        // Can't mint when Pause
        await shouldThrow(honeyPot.connect(nonOwner).mint(0, "0xb2dbf9d78de484989ffa46e822fadc46edf4b43c3d49ab1c0e15e71d02d46f7b", "0xb2dbf9d78de484989ffa46e822fadc46edf4b43c3d49ab1c0e15e71d02d46f7b"), /Pausable: paused/);

    });

    it("verified user can mint once", async () => {

        expect(await honeyPot.minted(await verifiedMinter.getAddress())).eq(false);

        const digest = await honeyPot.digestFor(await verifiedMinter.getAddress());
        const signature = verifier._signingKey().signDigest(digest)

        await honeyPot.connect(verifiedMinter).mint(signature.v, signature.r, signature.s)
        expect(await honeyPot.minted(await verifiedMinter.getAddress())).eq(true);


        // User can't mint again
        await shouldThrow(honeyPot.connect(verifiedMinter).mint(signature.v, signature.r, signature.s), /AlreadyMinted/);
    })

    it("non-verified user can't mint", async () => {

        const digest = await honeyPot.digestFor(await verifiedMinter.getAddress());
        const signature = verifier._signingKey().signDigest(digest)

        await shouldThrow(honeyPot.connect(nonVerifiedMinter).mint(signature.v, signature.r, signature.s), /InvalidSignature/);
    })


    it("can't transfer the token", async () => {

        const digest = await honeyPot.digestFor(await verifiedMinter.getAddress());
        const signature = verifier._signingKey().signDigest(digest)
        await honeyPot.connect(verifiedMinter).mint(signature.v, signature.r, signature.s)
        await shouldThrow(honeyPot.connect(verifiedMinter).transferFrom(await verifiedMinter.getAddress(), await nonVerifiedMinter.getAddress(), 0), /NonTransferrable/);
    })

})
