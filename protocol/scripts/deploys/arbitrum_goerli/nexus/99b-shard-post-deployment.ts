import { ethers, network } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { TestnetShard__factory } from '../../../../typechain';
import { DEPLOYED_CONTRACTS } from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();
    const deployedContracts = DEPLOYED_CONTRACTS[network.name];
    const shardId1 = 123;
    const shardId2 = 456;
    const shardId3 = 789;
    const shardId4 = 420;
    const uri1 = "http://example1.com";
    const uri2 = "http://example2.com";
    const uri3 = "http://example3.com";
    const uri4 = "http://example4.com";
    const shard = TestnetShard__factory.connect(deployedContracts.SHARD, owner);

    // minters and partners
    {
        const shardIds = [shardId4];
        const allowed = [true];
        await mine(shard.setPartnerAllowedShardIds(ownerAddress, shardIds, allowed));
        await mine(shard.setPartnerAllowedShardCaps(ownerAddress, shardIds, [99999]));
    }
    // uri and recipe
    {   
        const recipe = {
            inputShardIds: [shardId1, shardId2],
            inputShardAmounts: [2, 1],
            outputShardIds: [shardId3],
            outputShardAmounts: [1]
        };
        const recipeId = 1;
        await mine(shard.setRecipe(recipeId, recipe));
        await mine(shard.setShardUri(shardId1, uri1));
        await mine(shard.setShardUri(shardId2, uri2));
        await mine(shard.setShardUri(shardId3, uri3));
        await mine(shard.setShardUri(shardId4, uri4));
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