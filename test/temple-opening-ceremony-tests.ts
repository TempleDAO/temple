import { expect } from 'chai';
import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { TempleOpeningCeremony, TempleOpeningCeremony__factory } from '../typechain';
import { shouldThrow } from './helpers';

describe('Test Opening Ceremony', async () => {
  const ownableErr = /Ownable: caller is not the owner/;
  const DEFAULT_DATA = {
    roles: ['r1', 'r2'],
    lastCompletedStep: 4,
  };
  const templarDataStringify = JSON.stringify(DEFAULT_DATA);
  let TEMPLE_OPENING_CEREMONY: TempleOpeningCeremony;
  let owner: Signer;
  let nonOwner: Signer;
  const testVersion = 'beta';


  beforeEach(async () => {
    [owner, nonOwner] = (await ethers.getSigners()) as Signer[];
    TEMPLE_OPENING_CEREMONY = await new TempleOpeningCeremony__factory(owner).deploy();
  });

  it('Only owner can set data', async () => {
    const nonOwnerAddress = await nonOwner.getAddress();
    const ownerAddress = await owner.getAddress();

    // Check that nonOwner can NOT update templar data
    await shouldThrow(TEMPLE_OPENING_CEREMONY.connect(nonOwner).setData(nonOwnerAddress, testVersion, templarDataStringify), ownableErr);


    // Check that Owner CAN update templar data
    await TEMPLE_OPENING_CEREMONY.setData(nonOwnerAddress, testVersion, templarDataStringify);
    const templarData = await TEMPLE_OPENING_CEREMONY.dataOf(nonOwnerAddress);
    expect(templarData.version, testVersion);
    expect(templarData.data, templarDataStringify);
  });


  it('Owner can change templar data', async () => {
    const nonOwnerAddress = await nonOwner.getAddress();
    const ownerAddress = await owner.getAddress();

    // Set data and chek original values
    await TEMPLE_OPENING_CEREMONY.setData(nonOwnerAddress, testVersion, templarDataStringify);
    const templarData = await TEMPLE_OPENING_CEREMONY.dataOf(nonOwnerAddress);
    expect(templarData.version, testVersion);
    expect(templarData.data, templarDataStringify);

    // Update data
    const newData = JSON.parse(templarData.data);
    newData.roles.push('r3');
    let newDataStringify = JSON.stringify(newData);
    await TEMPLE_OPENING_CEREMONY.setData(nonOwnerAddress, testVersion, newDataStringify);

    const templarDataUpdated = await TEMPLE_OPENING_CEREMONY.dataOf(nonOwnerAddress);
    expect(templarDataUpdated.data, newDataStringify);
  });
});
