import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { blockTimestamp, mineToTimestamp } from '../test/helpers';
import { OpeningCeremonyQuest__factory } from '../typechain';

async function main() {
  const [owner] = await ethers.getSigners();
  const quester = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';

  const openingCeremonyQuest = new OpeningCeremonyQuest__factory(owner).attach('0x7bc06c482dead17c0e297afbc32f6e63d3846650');

  const data = await openingCeremonyQuest.dataOf(quester);
  const currentStep = await openingCeremonyQuest.getCurrentStep(quester);


  const logData = {
    ...data,
    lockedUntil: new Date(data.lockedUntil.toNumber() * 1000).toLocaleTimeString(),
    currentSTEP: currentStep
  };

  console.log(JSON.stringify(logData, null, 2));
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then()
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
