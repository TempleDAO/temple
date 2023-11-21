import { ethers, network } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { Relic__factory } from '../../../../typechain';
import { DEPLOYED_CONTRACTS } from '../../helpers';


async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const deployedContracts = DEPLOYED_CONTRACTS[network.name];
    const relic = Relic__factory.connect(deployedContracts.RELIC, owner);

    // set shard
    const shardAddress = deployedContracts.SHARD;
    {
        await mine(relic.setShard(shardAddress));
    }
    // set relic minter (temple sacrifice)
    const templeSacrificeAddress = deployedContracts.TEMPLE_SACRIFICE;
    {
        await mine(relic.setRelicMinter(templeSacrificeAddress, true));
    }
    // set base uri rarity 
    {
        // 0 for Common
        const commonUri = 'ipfs://QmVBhkqq3qEeQvdCDWSXQGMX7hFDymZvy7X7J4z9GsUAB3/'
        await mine(relic.setBaseUriRarity(0, commonUri));
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });