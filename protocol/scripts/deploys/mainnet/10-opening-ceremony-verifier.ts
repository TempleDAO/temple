import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { OpeningCeremony__factory, VerifyQuest__factory } from '../../../typechain';
import { deployAndMine, DeployedContracts, DEPLOYED_CONTRACTS, expectAddressWithPrivateKey } from '../helpers';

async function main() {
  expectAddressWithPrivateKey();
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts;

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  const openingCeremony = new OpeningCeremony__factory(owner).attach(DEPLOYED.OPENING_CEREMONY);
  const verifierPublicKey = "0x22e6E0cF7966892E24b5764cC603A03801Df1FFd" // for mainnet
  console.log(openingCeremony.address);

  const verifyQuestFactory = new VerifyQuest__factory(owner)
  const verifyQuest = await deployAndMine(
    'QUEST_VERIFIER', verifyQuestFactory, verifyQuestFactory.deploy,
    openingCeremony.address,
    verifierPublicKey,
  );

  const txt = await openingCeremony.grantRole(await openingCeremony.CAN_ADD_VERIFIED_USER(), verifyQuest.address);
  await txt.wait()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });