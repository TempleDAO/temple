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
    const initialRescuer = "";
    const initialExecutor = "";
    const relicAddress = DEPLOYED_CONTRACTS[network.name].RELIC;;
    const uri = "";

    const shardFactory = new Shard__factory(owner);
    await deployAndMine(
        'SHARD',
        shardFactory,
        shardFactory.deploy,
        relicAddress,
        initialRescuer,
        initialExecutor,
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