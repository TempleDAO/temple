import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { TestnetShard__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
  DEPLOYED_CONTRACTS
} from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const relicAddress = DEPLOYED_CONTRACTS[network.name].RELIC;

    const shardFactory = new TestnetShard__factory(owner);
    const uri = 'ipfs://QmVBhkqq3qEeQvdCDWSXQGMX7hFDymZvy7X7J4z9GsUAB3/';
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