import { ethers, network } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { Shard__factory } from '../../../../typechain';
import { DEPLOYED_CONTRACTS } from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const deployedContracts = DEPLOYED_CONTRACTS[network.name];
    const shardId1 = 1;
    const shardId2 = 2;
    const shardId3 = 3;

    const shard = Shard__factory.connect(deployedContracts.SHARD, owner);

    await mine(shard.setNexusCommon(deployedContracts.NEXUS_COMMON));
    const ownerAddress = await owner.getAddress();
    const minters = [ownerAddress, ownerAddress, ownerAddress, ownerAddress, ownerAddress]
    await mine(shard.setNewMinterShards(minters));

    // recipe
    {   
        const recipe = {
            inputShardIds: [shardId1, shardId2],
            inputShardAmounts: [2, 1],
            outputShardIds: [shardId3],
            outputShardAmounts: [1]
        };
        await mine(shard.addRecipe(recipe));
    }
    const shard1Uri = 'http://www.example.com/1';
    await mine(shard.setShardUri(shardId1, shard1Uri));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });