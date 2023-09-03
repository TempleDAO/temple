import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TestnetShard__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from '../../v2/sepolia/contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const relicAddress = ""

    const shardFactory = new TestnetShard__factory(owner);
    const uri = "";
    await deployAndMine(
        'SHARD',
        shardFactory,
        shardFactory.deploy,
        relicAddress,
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