import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { VestingPayments__factory, ERC20__factory, VestingPayments } from '../../../../typechain';
import {
  mine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedTempleGoldContracts } from '../../mainnet/templegold/contract-addresses';


async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();
    const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();

    const vesting = VestingPayments__factory.connect(TEMPLEGOLD_ADDRESSES.ADMIN.VESTING.TGLD, owner);
    const TGLD = ERC20__factory.connect(TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD, owner);

    // Uncomment to create first round of schedules
    // await createSchedulesOne(vesting, ownerAddress);

    // Uncomment to create second round of schedules
    // await createSchedulesTwo(vesting);

    // Uncomment to revoke vesting
    // await revokeVestings(vesting);

    // Uncomment for signer to release some vested amount
    // await release(vesting, ownerAddress, 0);

    // Signer is funds owner
    // approve vesting to pull funds
    // await mine(TGLD.approve(vesting.address, ethers.utils.parseEther("10000000000")));
}

async function createSchedulesOne(vesting: VestingPayments, ownerAddress: string) {
    // create schedules
    const blockTs = (await ethers.provider.getBlock('latest')).timestamp; //Math.floor(new Date().getTime() / 1000);
    const cliff = blockTs + 60 * 60; // 1 hour from now
    const start = blockTs + 5 * 60; // start 5 minutes from now
    const ONE_WEEK = 7 * 24 * 60 * 60;
    const schedules = [
        {
            cliff: cliff,
            start: start,
            duration: ONE_WEEK,
            amount: ethers.utils.parseEther("40"),
            revoked: false,
            distributed: 0,
            revokedReleasable: 0,
            recipient: "0x7Ab8375c4F1167b92a1fD649Bc2f5e8E6aa7d4c4"
        },
        {
            cliff: cliff,
            start: start,
            duration: ONE_WEEK,
            amount: ethers.utils.parseEther("10"),
            revoked: false,
            distributed: 0,
            revokedReleasable: 0,
            recipient: ownerAddress
        },
        {
            cliff: cliff + ONE_WEEK,
            start: start,
            duration: 4 * ONE_WEEK,
            amount: ethers.utils.parseEther("30"),
            revoked: false,
            distributed: 0,
            revokedReleasable: 0,
            recipient: ownerAddress
        }
    ];

    await mine(vesting.createSchedules(schedules));
} 

async function createSchedulesTwo(vesting: VestingPayments) {
    const blockTs = (await ethers.provider.getBlock('latest')).timestamp; //Math.floor(new Date().getTime() / 1000);
    const cliff = blockTs + 60 * 60; // 1 hour from now
    const start = blockTs + 5 * 60; // start 5 minutes from now
    const ONE_WEEK = 7 * 24 * 60 * 60;

    const schedules = [
        {
            cliff: cliff,
            start: start,
            duration: ONE_WEEK,
            amount: ethers.utils.parseEther("40"),
            revoked: false,
            distributed: 0,
            revokedReleasable: 0,
            recipient: "0x7Ab8375c4F1167b92a1fD649Bc2f5e8E6aa7d4c4"
        },
        {
            cliff: cliff,
            start: start,
            duration: ONE_WEEK * 8,
            amount: ethers.utils.parseEther("1"),
            revoked: false,
            distributed: 0,
            revokedReleasable: 0,
            recipient: "0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd"
        },
        {
            cliff: cliff + 4 * ONE_WEEK,
            start: start + ONE_WEEK,
            duration: 4 * ONE_WEEK,
            amount: ethers.utils.parseEther("1"),
            revoked: false,
            distributed: 0,
            revokedReleasable: 0,
            recipient: "0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd"
        },
        {
            cliff: cliff,
            start: start,
            duration: ONE_WEEK * 8,
            amount: ethers.utils.parseEther("1"),
            revoked: false,
            distributed: 0,
            revokedReleasable: 0,
            recipient: "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46"
        },
        {
            cliff: cliff + 4 * ONE_WEEK,
            start: start + ONE_WEEK,
            duration: 4 * ONE_WEEK,
            amount: ethers.utils.parseEther("1"),
            revoked: false,
            distributed: 0,
            revokedReleasable: 0,
            recipient: "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46"
        }
      ];

      await mine(vesting.createSchedules(schedules));
}

async function revokeVestings(vesting: VestingPayments) {
    const holders = ["0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd", "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46"];
    for (const holder of holders) {
      const count = (await vesting.holdersVestingCount(holder)).toNumber();
      for (let i = 0; i < count; i++) {
        const id = await vesting.computeVestingScheduleIdForAddressAndIndex(holder, i);
        if (await vesting.isActiveVestingId(id)) {
          await mine(vesting.revokeVesting(id));
        }
      }
    }
}

async function release(vesting: VestingPayments, ownerAddress: string, index: number) {
  const id = await vesting.computeVestingScheduleIdForAddressAndIndex(ownerAddress, index);
  await mine(vesting.release(id));
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });