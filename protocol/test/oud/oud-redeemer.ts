import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumberish, TypedDataDomain, TypedDataField } from "ethers";
import { toAtto } from "../helpers";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { getAddress, splitSignature } from "ethers/lib/utils";
import {
    OudToken,
    OudToken__factory,
    OudRedeemer,
    OudRedeemer__factory,
    TempleERC20Token,
    TempleERC20Token__factory,
    FakeERC20__factory,
    FakeERC20,
    FakeTempleLineOfCredit,
    FakeTempleLineOfCredit__factory
} from "../../typechain";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TPI = 9800;
const OPENING_BALANCE = 10_000;
const OUD_AMOUNT = 1
const STABLE_AMOUNT = OUD_AMOUNT * (TPI / 10^4);

describe("Oud Redeemer", async () => {
    let oudToken: OudToken;
    let oudRedeemer: OudRedeemer;
    let templeToken: TempleERC20Token;
    let stableToken: FakeERC20;
    let templeLineOfCredit: FakeTempleLineOfCredit;
    let owner: SignerWithAddress;
    let alan: SignerWithAddress;
    let alanAddress: string;

    before(async () => {
        [owner, alan] = await ethers.getSigners();
        alanAddress = alan.address;
    });

    async function setup() {

        oudToken = await new OudToken__factory(owner).deploy("Oud Test Token", "Oud");
        await oudToken.addMinter(owner.address);
        await oudToken.connect(owner).mint(alanAddress, toAtto(OPENING_BALANCE));
        templeToken = await new TempleERC20Token__factory(owner).deploy();
        await templeToken.addMinter(owner.address);
        stableToken = await new FakeERC20__factory(owner).deploy("Stable token", "STBL");
        stableToken.connect(owner).mint(alanAddress, toAtto(OPENING_BALANCE));
        templeLineOfCredit = await new FakeTempleLineOfCredit__factory(owner).deploy();
        oudRedeemer = await new OudRedeemer__factory(owner).deploy(
            oudToken.address,
            templeToken.address,
            stableToken.address,
            templeLineOfCredit.address,
            TPI
        );
        await templeToken.addMinter(oudRedeemer.address);
        await oudToken.addMinter(oudRedeemer.address);


        return {
            oudToken, templeToken, stableToken, oudRedeemer
        };
    }

    beforeEach(async () => {
        ({
            oudToken, templeToken, stableToken, oudRedeemer
        } = await loadFixture(setup));
    });

    describe("Admin", () => {
        describe("Constructor Values", () => {
            it("Returns correct TPI", async () => {
                expect(await oudRedeemer.treasuryPriceIndex()).to.eq(TPI);
                await oudRedeemer.connect(owner).setTreasuryPriceIndex(1400);
                expect(await oudRedeemer.treasuryPriceIndex()).to.eq(1400);

            });
            it("Returns correct precision", async () => {
                expect(await oudRedeemer.TPI_PRECISION()).to.eq(4);
            });
        });
        it("Only owner can set TPI", async () => {
            await expect(oudRedeemer.connect(alan).setTreasuryPriceIndex(2000))
                .to.revertedWith("Ownable: caller is not the owner");
            await oudRedeemer.connect(owner).setTreasuryPriceIndex(2000);
            expect(await oudRedeemer.treasuryPriceIndex()).to.eq(2000);
        });
        it("Only owner can set Stable coin to valid address", async () => {
            await expect(oudRedeemer.connect(alan).setStableCoin(templeToken.address))
                .to.revertedWith("Ownable: caller is not the owner");
            await expect(oudRedeemer.connect(owner).setStableCoin(ZERO_ADDRESS))
                .to.be.revertedWithCustomError(oudRedeemer,"AddressZero");
            await oudRedeemer.connect(owner).setStableCoin(templeToken.address);
            expect(await oudRedeemer.stable()).to.eq(getAddress(templeToken.address));
        });
    });

    describe("Redemption TXS", () => {
        it("Correct amount of Oud is burned for redemption", async () => {
            expect(await oudToken.balanceOf(alanAddress)).to.eq(toAtto(OPENING_BALANCE));
            await stableToken.connect(alan).approve(oudRedeemer.address,toAtto(STABLE_AMOUNT));         
            expect(await oudRedeemer.connect(alan).redeem(toAtto(OUD_AMOUNT)))
                .to.changeTokenBalance(oudToken, alanAddress, toAtto(OPENING_BALANCE - OUD_AMOUNT));
        });
        it("Correct amount of Temple is redeemed for Oud + Stable(at TPI)", async () => {
            expect(await templeToken.balanceOf(alanAddress)).to.eq(0);
            await stableToken.connect(alan).approve(oudRedeemer.address,toAtto(STABLE_AMOUNT));         
            expect(await oudRedeemer.connect(alan).redeem(toAtto(OUD_AMOUNT)))
                .to.changeTokenBalance(templeToken, alanAddress, toAtto(OUD_AMOUNT));
        });
        it("Correct amount of Stable(at TPI) is charged", async () => {
            expect(await stableToken.balanceOf(alanAddress)).to.eq(toAtto(OPENING_BALANCE));
            await stableToken.connect(alan).approve(oudRedeemer.address,toAtto(STABLE_AMOUNT));
            expect(await oudRedeemer.connect(alan).redeem(toAtto(OUD_AMOUNT)))
                .to.changeTokenBalance(stableToken, alanAddress, toAtto(OPENING_BALANCE-STABLE_AMOUNT));
        });
        it("Redeem deposits correct amount to TLC", async () => {
            expect(await stableToken.balanceOf(templeLineOfCredit.address)).to.eq(0);
            await stableToken.connect(alan).approve(oudRedeemer.address,toAtto(STABLE_AMOUNT));
            expect(await oudRedeemer.connect(alan).redeem(toAtto(OUD_AMOUNT)))
                .to.changeTokenBalance(stableToken, templeLineOfCredit, toAtto(STABLE_AMOUNT));
        });
        it("Should emit the correct event", async () => {
            await stableToken.connect(alan).approve(oudRedeemer.address,toAtto(STABLE_AMOUNT));
            expect(await oudRedeemer.connect(alan).redeem(toAtto(1))).to.emit(oudRedeemer, "OudRedeemed")
                .withArgs(alanAddress,toAtto(1),TPI,toAtto(1)); 

        });
        it("Reverts 0 Oud redemption", async () => {
            await expect(oudRedeemer.connect(alan).redeem(toAtto(0)))
                .to.be.revertedWithCustomError(oudRedeemer,"RedeemAmountZero");
        });
        it("Reverts with insufficient Stable allowance", async () => {
            await expect(oudRedeemer.connect(alan).redeem(toAtto(1)))
                .to.be.revertedWith("ERC20: insufficient allowance");
        });

    });








});
