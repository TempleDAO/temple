import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { Shard__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
  DEPLOYED_CONTRACTS
} from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const relicAddress = DEPLOYED_CONTRACTS[network.name].RELIC;

    const shardFactory = new Shard__factory(owner);
    const uri = 'ipfs://QmVBhkqq3qEeQvdCDWSXQGMX7hFDymZvy7X7J4z9GsUAB3/';
    const nexusCommon = DEPLOYED_CONTRACTS[network.name].NEXUS_COMMON;
    await deployAndMine(
        'SHARD',
        shardFactory,
        shardFactory.deploy,
        relicAddress,
        nexusCommon,
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