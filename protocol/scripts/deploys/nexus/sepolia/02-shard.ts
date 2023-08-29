import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { Shard__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from '../../v2/sepolia/contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_DEPLOYED = getDeployedContracts();
    const relicAddress = ""

    const ownerAddress = await owner.getAddress();
    const shardFactory = new Shard__factory(owner);
    const uri = "";
    await deployAndMine(
        'SHARD',
        shardFactory,
        shardFactory.deploy,
        relicAddress,
        ownerAddress,
        ownerAddress,
        uri
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });