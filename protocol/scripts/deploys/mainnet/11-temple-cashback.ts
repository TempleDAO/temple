import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { ExitQueue__factory, TempleCashback__factory, TempleTeamPayments__factory } from '../../../typechain';
import { deployAndMine, DeployedContracts, DEPLOYED_CONTRACTS, expectAddressWithPrivateKey, toAtto } from '../helpers';

const MAX_EXITABLE_PER_ADDRESS = toAtto(1000) ;
const MAX_EXITABLE_PER_EPOCH = toAtto(1000) ;

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

  const verifierPublicKey = "0x56308ae1FD1a70c46B246Af4c0DCd855bD87d7a7"

  const templeCashbackFactory = new TempleCashback__factory(owner);
  await deployAndMine(
    'TEMPLE_CASHBACK', templeCashbackFactory, templeCashbackFactory.deploy,
    verifierPublicKey
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });