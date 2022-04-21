import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { deployAndMine, expectAddressWithPrivateKey, EchoingWhispers__factory, EchoingWhispers } from '../helpers';

async function main() {
  expectAddressWithPrivateKey();

  const [owner] = await ethers.getSigners();

  const openingCeremonyQuestFactory = new EchoingWhispers__factory(owner);

  const openingCeremonyQuest: EchoingWhispers = await deployAndMine(
    'OPENING_CEREMONY_QUEST', openingCeremonyQuestFactory, openingCeremonyQuestFactory.deploy,
  );

  await openingCeremonyQuest.setConditions(
      ethers.utils.keccak256(ethers.utils.formatBytes32String("1-5")),
      ethers.utils.keccak256(ethers.utils.formatBytes32String("3-2")))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });