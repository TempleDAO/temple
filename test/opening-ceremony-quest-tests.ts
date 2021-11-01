import { arrayify } from '@ethersproject/bytes';
import { expect } from 'chai';
import { BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { OpeningCeremonyQuest, OpeningCeremonyQuest__factory } from '../typechain';
import { mineForwardSeconds, shouldThrow } from './helpers';

describe('Test Opening Ceremony Quest', async () => {
  const aclErr = /AccessControl: account .* is missing role .*/;

  let quest: OpeningCeremonyQuest;
  let owner: Signer;
  let stateChanger: Signer;
  let nonOwner: Signer;
  const testVersion = BigNumber.from(1);

  beforeEach(async () => {
    [owner, stateChanger, nonOwner] = (await ethers.getSigners()) as Signer[];
    quest = await new OpeningCeremonyQuest__factory(owner).deploy();

    await quest.setConditions(
      ethers.utils.keccak256(ethers.utils.formatBytes32String("1")),
      ethers.utils.keccak256(ethers.utils.formatBytes32String("2")))

    await quest.grantRole(await quest.CAN_CHANGE_STATE(), await stateChanger.getAddress())
  });

  it('Only admin can set conditions', async () => {
    const setEnclaveCondition = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["a"]));
    const setCompletedCondition = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["b"]));

    await shouldThrow(quest.connect(stateChanger).setConditions(
      setEnclaveCondition,
      setCompletedCondition),
      aclErr);
    await shouldThrow(quest.connect(nonOwner).setConditions(
      setEnclaveCondition,
      setCompletedCondition),
      aclErr);
    await quest.setConditions(
      setEnclaveCondition,
      setCompletedCondition,
    );

    expect(await quest.setEnclaveCondition()).eq(setEnclaveCondition);
    expect(await quest.setCompletedCondition()).eq(setCompletedCondition);
  });

  it('Only address with the CAN_CHANGE_STATE role can change a user state', async () => {
    const questerAddr = await nonOwner.getAddress();

    const step2 = ethers.utils.formatBytes32String("2")
    const step3 = ethers.utils.formatBytes32String("3")

    await shouldThrow(quest.connect(nonOwner).setCurrentStep(questerAddr, step2), aclErr);
    await shouldThrow(quest.connect(nonOwner).setCurrentStepWithLock(questerAddr, step2, 10, step3), aclErr);

    await quest.connect(stateChanger).setCurrentStep(questerAddr, step2);
    expect(await quest.getCurrentStep(questerAddr)).eq(step2);
    await quest.connect(stateChanger).setCurrentStepWithLock(await nonOwner.getAddress(), step3, 10, step2);
    expect(await quest.getCurrentStep(questerAddr)).eq(step3);
    await mineForwardSeconds(10);
    expect(await quest.getCurrentStep(questerAddr)).eq(step2);
  });

  it('Cannot change users state while locked', async () => {
    const questerAddr = await nonOwner.getAddress();

    const step2 = ethers.utils.formatBytes32String("2")
    const step3 = ethers.utils.formatBytes32String("3")

    await quest.connect(stateChanger).setCurrentStepWithLock(await nonOwner.getAddress(), step3, 20, step2);
    await shouldThrow(quest.connect(stateChanger).setCurrentStep(questerAddr, step2), /Locked on current step/);
    await shouldThrow(quest.connect(stateChanger).setCurrentStepWithLock(questerAddr, step2, 10, step3), /Locked on current step/);
  });

  it('Only address with CAN_CHANGE_STATE role can set enclave/completed flag', async () => {
    await shouldThrow(quest.connect(nonOwner).setCompleted(await nonOwner.getAddress()), aclErr);
    await shouldThrow(quest.connect(nonOwner).setEnclave(await nonOwner.getAddress(), ethers.utils.formatBytes32String("structure")), aclErr);
  });

  it('Can only set enclave/completed flag when the user is in a given part of the quest', async () => {
    await shouldThrow(quest.connect(stateChanger).setEnclave(await nonOwner.getAddress(), ethers.utils.formatBytes32String("structure")), /Cannot set enclave at current quest step/);
    await quest.connect(stateChanger).setCurrentStep(await nonOwner.getAddress(), ethers.utils.formatBytes32String("1"));
    await quest.connect(stateChanger).setEnclave(await nonOwner.getAddress(), ethers.utils.formatBytes32String("structure"));
    expect(ethers.utils.parseBytes32String((await quest.dataOf(await nonOwner.getAddress())).enclave)).eq("structure")

    await shouldThrow(quest.connect(stateChanger).setCompleted(await nonOwner.getAddress()), /Cannot set quest as completed at current step/);
    await quest.connect(stateChanger).setCurrentStep(await nonOwner.getAddress(), ethers.utils.formatBytes32String("2"));
    await quest.connect(stateChanger).setCompleted(await nonOwner.getAddress());
    expect((await quest.dataOf(await nonOwner.getAddress())).completed).is.true;
  });

  it('Only admin can speed run/reset a users state', async () => {
    await shouldThrow(quest.connect(stateChanger).removeLock(await nonOwner.getAddress()), aclErr);
    await shouldThrow(quest.connect(stateChanger).overrideUserData(await nonOwner.getAddress(), {
      stepWhenLocked: ethers.utils.formatBytes32String("1"),
      stepWhenUnlocked: ethers.utils.formatBytes32String("2"),
      lockedUntil: 0,
      enclave: ethers.utils.formatBytes32String(""),
      completed: false
    }), aclErr);

    await quest.connect(stateChanger).setCurrentStepWithLock(
      await nonOwner.getAddress(), 
      ethers.utils.formatBytes32String("2"), 
      1000, 
      ethers.utils.formatBytes32String("1"));
    expect(await quest.getCurrentStep(await nonOwner.getAddress())).eq(ethers.utils.formatBytes32String("2"));
    await quest.removeLock(await nonOwner.getAddress());
    expect(await quest.getCurrentStep(await nonOwner.getAddress())).eq(ethers.utils.formatBytes32String("1"));

    await quest.overrideUserData(await nonOwner.getAddress(), {
      stepWhenLocked: ethers.utils.formatBytes32String("1"),
      stepWhenUnlocked: ethers.utils.formatBytes32String("2"),
      lockedUntil: 0,
      enclave: ethers.utils.formatBytes32String(""),
      completed: true
    });
    expect((await quest.dataOf(await nonOwner.getAddress())).completed).is.true;
  });
});
