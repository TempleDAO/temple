import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import {
    ElderElection__factory,
    Templar__factory,
    TemplarMetadata__factory,
} from '../../../../typechain';
import {
    getDeployedContracts,
} from '../contract-addresses';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const DEPLOYED = getDeployedContracts();

    const templarNft = Templar__factory.connect(DEPLOYED.TEMPLAR_NFT, owner);
    const elderElection = ElderElection__factory.connect(DEPLOYED.ELDER_ELECTION, owner);
    const templarMetadata = TemplarMetadata__factory.connect(DEPLOYED.TEMPLAR_METADATA, owner);

    // Assign the discord bot contract it's necessary roles. Do this before
    // we revoke access to role admin below.
    if (DEPLOYED.DISCORD_BOT) {
      const canAssignRole = templarNft.CAN_ASSIGN();
      await mine(templarNft.grantRole(canAssignRole, DEPLOYED.DISCORD_BOT));
      const canUpdateRole = templarMetadata.CAN_UPDATE();
      await mine(templarMetadata.grantRole(canUpdateRole, DEPLOYED.DISCORD_BOT));
      const canNominate = elderElection.CAN_NOMINATE();
      await mine(elderElection.grantRole(canNominate, DEPLOYED.DISCORD_BOT));
    }

    // Assign the msig the owner/admin role
    // Then revoke from the existing owner.
    {
      const ownerRole = await templarNft.OWNER();
      const adminRole = await templarNft.DEFAULT_ADMIN_ROLE();
      await mine(templarNft.grantRole(ownerRole, DEPLOYED.MULTISIG));
      await mine(templarNft.grantRole(adminRole, DEPLOYED.MULTISIG));
      await mine(templarNft.revokeRole(ownerRole, await owner.getAddress()));
      await mine(templarNft.revokeRole(adminRole, await owner.getAddress()));
    }
    
    {
      const adminRole = await elderElection.DEFAULT_ADMIN_ROLE();
      await mine(elderElection.grantRole(adminRole, DEPLOYED.MULTISIG));
      await mine(elderElection.revokeRole(adminRole, await owner.getAddress()));
    }

    {
      const adminRole = await templarMetadata.DEFAULT_ADMIN_ROLE();
      await mine(templarMetadata.grantRole(adminRole, DEPLOYED.MULTISIG));
      await mine(templarMetadata.revokeRole(adminRole, await owner.getAddress()));
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
