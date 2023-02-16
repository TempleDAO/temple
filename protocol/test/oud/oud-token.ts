import { expect } from "chai";
import { OudToken, OudToken__factory } from "../../typechain";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumberish, Signer, TypedDataDomain, TypedDataField } from "ethers";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { splitSignature } from "ethers/lib/utils";
import { blockTimestamp } from "../helpers";
 
describe("Oud Token", async () => {
    let token: OudToken;
    let owner: SignerWithAddress;
    let minter: SignerWithAddress;
    let alan: SignerWithAddress;
    let spender: SignerWithAddress;

    before(async () => {
        [owner, minter, alan, spender] = await ethers.getSigners();
    });

    async function setup() {
        token = await new OudToken__factory(owner).deploy("Oud Test Token", "Oud");

        return {
            token,
        };
    }

    beforeEach(async () => {
        ({
            token,
        } = await loadFixture(setup));
    });

    it("Init", async () => {
        expect(await token.symbol()).eq("Oud");
        expect(await token.name()).eq("Oud Test Token");
        expect(await token.totalSupply()).eq(0);
    });

    it("admin", async () => {
        await expect(token.connect(alan).recoverToken(token.address, alan.getAddress(), 10)).to.revertedWith("Ownable: caller is not the owner");

        // Happy paths
        await expect(token.recoverToken(token.address, alan.getAddress(), 10))
            .to.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("owner can recover tokens", async () => {
        const amount = 50;
        await token.addMinter(owner.getAddress());
        await token.mint(token.address, amount);
        // TODO await recoverToken(token, amount, token, owner);
    });

    it("Only specified roles can mint", async () => {
        const alanAddress: string = await alan.getAddress();
        const minterAddress: string = await minter.getAddress();

        // mint should fail when no minter set.
        await expect(token.mint(alanAddress, 10))
            .to.revertedWithCustomError(token, "CannotMintOrBurn")
            .withArgs(await owner.getAddress());

        // Only admin can add a minter
        await expect(token.connect(alan).addMinter(alanAddress)).to.revertedWith("Ownable: caller is not the owner");
        await expect(token.addMinter(minterAddress))
            .to.emit(token, "AddedMinter")
            .withArgs(minterAddress);
        expect(await token.isMinter(minterAddress)).to.be.true;

        // Only minter can, well mint
        await token.connect(minter).mint(alanAddress, 10);
        expect(await token.balanceOf(alanAddress)).equals(10);
        await expect(token.mint(alanAddress, 10))
            .to.revertedWithCustomError(token, "CannotMintOrBurn")
            .withArgs(await owner.getAddress());

        // Only admin can remove a minter
        await expect(token.connect(alan).removeMinter(minterAddress)).to.revertedWith("Ownable: caller is not the owner");
        await expect(token.removeMinter(minterAddress))
            .to.emit(token, "RemovedMinter")
            .withArgs(minterAddress);

        expect(await token.totalSupply()).eq(10);
    });

    it("only specified roles can burn", async () => {
        const alanAddress: string = await alan.getAddress();
        const minterAddress: string = await minter.getAddress();

        // mint should fail when no minter set.
        await expect(token.burn(alanAddress, 10))
            .to.revertedWithCustomError(token, "CannotMintOrBurn")
            .withArgs(await owner.getAddress());

        await token.addMinter(minterAddress);

        // Only minter can burn
        await token.connect(minter).mint(alanAddress, 100);
        await token.connect(minter).burn(alanAddress, 10);
        expect(await token.balanceOf(alanAddress)).equals(90);
        await expect(token.burn(alanAddress, 10))
            .to.revertedWithCustomError(token, "CannotMintOrBurn")
            .withArgs(await owner.getAddress());

        expect(await token.totalSupply()).eq(90);
    });

    it("permit works as expected", async () => {

        const signedPermit = async (
            signer: SignerWithAddress,
            token: OudToken,
            spender: string,
            amount: BigNumberish,
            deadline: number,
        ) => {
            const chainId = await signer.getChainId();
            const signerAddr = await signer.getAddress();
            const nonce = await token.nonces(signerAddr);

            const domain: TypedDataDomain = {
                name: await token.name(),
                version: '1',
                chainId,
                verifyingContract: token.address
            };

            const permit: Record<string, TypedDataField[]> = {
                Permit: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' },
                ],
            };

            const value = {
                owner: signerAddr,
                spender,
                value: amount,
                nonce,
                deadline,
            };

            const signature = await signer._signTypedData(domain, permit, value);
            return splitSignature(signature);
        }

        const testErc20Permit = async (
            token: OudToken,
            signer: SignerWithAddress,
            spender: Signer,
            amount: BigNumberish
        ) => {
            const now = await blockTimestamp();
            const allowanceBefore = await token.allowance(signer.getAddress(), spender.getAddress());

            // Check for expired deadlines
            {
                const deadline = now - 1;
                const { v, r, s } = await signedPermit(signer, token, await spender.getAddress(), amount, deadline);
                await expect(token.permit(
                    signer.getAddress(),
                    spender.getAddress(),
                    amount,
                    deadline,
                    v,
                    r,
                    s
                )).to.revertedWith("ERC20Permit: expired deadline");
            }

            // Permit successfully increments the allowance
            const deadline = now + 3600;
            const { v, r, s } = await signedPermit(signer, token, await spender.getAddress(), amount, deadline);
            {
                await token.permit(
                    signer.getAddress(),
                    spender.getAddress(),
                    amount,
                    deadline,
                    v,
                    r,
                    s,
                );

                expect(await token.allowance(signer.getAddress(), spender.getAddress())).to.eq(allowanceBefore.add(amount));
            }

            // Can't re-use the same signature for another permit (the nonce was incremented)
            {
                await expect(token.permit(
                    signer.getAddress(),
                    spender.getAddress(),
                    amount,
                    deadline,
                    v,
                    r,
                    s,
                )).to.revertedWith("ERC20Permit: invalid signature");
            }
        }
    });
});
