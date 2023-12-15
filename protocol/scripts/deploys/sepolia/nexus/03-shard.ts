import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { Shard__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars
} from '../../helpers';
import { getDeployedContracts } from "./contract-addresses";

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const deployedContracts = getDeployedContracts();

    const shardFactory = new Shard__factory(owner);
    const uri = 'ipfs://QmVBhkqq3qEeQvdCDWSXQGMX7hFDymZvy7X7J4z9GsUAB3/';
    await deployAndMine(
        'NEXUS.SHARD',
        shardFactory,
        shardFactory.deploy,
        deployedContracts.NEXUS.RELIC,
        deployedContracts.NEXUS.NEXUS_COMMON,
        await owner.getAddress(), // initial executor
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