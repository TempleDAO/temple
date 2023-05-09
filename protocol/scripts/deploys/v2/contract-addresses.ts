import { network } from "hardhat";

export interface DeployedContracts {
    THRESHOLD_SAFE_GUARD: string;
}

export const DEPLOYED_CONTRACTS: { [key: string]: DeployedContracts } = {
    goerli: {
        THRESHOLD_SAFE_GUARD: '0x3a320fF715dCBbF097e15257B7051dd08fdfb7A2',
        // yarn hardhat verify --network goerli 0xe8a333221D4E1DB183f032F9e9062184f8a4d2Bb 0xA7F0F04efB55eaEfBC4649C523F7a773f91D5526 3
    },
    localhost: { 
        THRESHOLD_SAFE_GUARD: '',
    },
};

export function getDeployedContracts(): DeployedContracts {
    if (DEPLOYED_CONTRACTS[network.name] === undefined) {
      console.log(`No contracts configured for ${network.name}`);
      throw new Error(`No contracts configured for ${network.name}`);
    } else {
      return DEPLOYED_CONTRACTS[network.name];
    }
}
