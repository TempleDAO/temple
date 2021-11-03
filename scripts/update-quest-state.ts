import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { OpeningCeremonyQuest, OpeningCeremonyQuest__factory } from '../../../typechain';
import { POLYGON_CONTRACTS, expectAddressWithPrivateKey, PolygonContracts } from '../helpers';

async function main() {
  expectAddressWithPrivateKey();

  const [owner] = await ethers.getSigners();

  let DEPLOYED: PolygonContracts;

  if (POLYGON_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = POLYGON_CONTRACTS[network.name];
  }

  const openingCeremonyQuest: OpeningCeremonyQuest = new OpeningCeremonyQuest__factory(owner)
    .attach(DEPLOYED.OPENING_CEREMONY_QUEST);

  // await openingCeremonyQuest.setConditions(
  //     ethers.utils.keccak256(ethers.utils.formatBytes32String("1-5")),
  //     ethers.utils.keccak256(ethers.utils.formatBytes32String("3-2")))

  const userData = await openingCeremonyQuest.dataOf("0x4dB091366435eB1B8883f0728a4CD74f81c22177")
  console.log(ethers.utils.parseBytes32String(userData.stepWhenLocked));
  console.log(ethers.utils.parseBytes32String(userData.stepWhenUnlocked));

  //await openingCeremonyQuest.overrideUserData(
  //  "0x4dB091366435eB1B8883f0728a4CD74f81c22177", 
  //  Object.assign({}, userData, {
  //    stepWhenUnlocked: ethers.utils.formatBytes32String("1-5"),
  //  }))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });