import { ethers } from "hardhat";
import { expect } from "chai";
import { blockTimestamp, fromAtto, mineForwardSeconds, toAtto } from "../helpers";
import { Signer } from "ethers";
import { 
  JoiningFee,
  JoiningFee__factory,
} from "../../typechain";

describe("Joining Fee", async () => {
    let joiningFee: JoiningFee;

    let owner: Signer;

    async function deployJoiningFee() {
        joiningFee = await new JoiningFee__factory(owner).deploy(
            toAtto(1),
        );
    }

    beforeEach(async () => {
        [owner] = await ethers.getSigners();

        await deployJoiningFee();
    });

    it('Can set joining fee (both custom and default)', async () => {
        await joiningFee.setHourlyJoiningFeeFor(ethers.constants.AddressZero, toAtto(2));

        const defaultHourlyFee = await joiningFee.defaultHourlyJoiningFee();
        expect(defaultHourlyFee).equals(toAtto(2));

        await joiningFee.setHourlyJoiningFeeFor(await owner.getAddress(), toAtto(3));
        const ownerFee = await joiningFee.hourlyJoiningFeeFor(await owner.getAddress());
        expect(ownerFee).equals(toAtto(3));

        // setting a custom fee for a particular vault leaves the default unchanged
        expect(await joiningFee.defaultHourlyJoiningFee()).equals(defaultHourlyFee);
    });

    it('Linear progression on fee until next cycle', async () => {
        const expectedFees = [
            {fees:[0,24,48,72,96,120,144,168,192,216,0], period: 864000, defaultFee: toAtto(1)},
            {fees:[0,0.24,0.48,0.72,0.96,1.2,1.44,1.68,1.92,2.16,0], period:864000, defaultFee: toAtto(0.01)},
            {fees:[0,0.0024,0.0048,0.0072,0.0096,0.012,0.0144,0.0168,0.0192,0.0216,0.024
                   ,0.0264,0.0288,0.0312,0.0336,0.036,0.0384,0.0408,0.0432,0.0456,0.048,0.0504,
                   0.0528,0.0552,0.0576,0.06,0.0624,0.0648,0.0672,0.0696,0], period: 2592000, defaultFee: toAtto(0.0001)}
        ]
        
        for (let i = 0; i < expectedFees.length; i++) {    
            await deployJoiningFee();
            const testParams = expectedFees[i];
            const timestamp = await blockTimestamp();
            await joiningFee.setHourlyJoiningFeeFor(ethers.constants.AddressZero, testParams.defaultFee);
            expect(testParams.defaultFee).equals(await joiningFee.defaultHourlyJoiningFee());
            for (let j = 0; j < testParams.fees.length; j++) {
                const fee = await joiningFee.calc(timestamp, testParams.period, ethers.constants.AddressZero);
                expect(fromAtto(fee)).equals(testParams.fees[j]);
                await mineForwardSeconds(86400);
            }
            
            await ethers.provider.send("hardhat_reset", []);
        }
    })
});