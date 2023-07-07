import { network } from "hardhat";

export interface DeployedContracts {
    THRESHOLD_SAFE_GUARD: string;
}

export const DEPLOYED_CONTRACTS: { [key: string]: DeployedContracts } = {
    goerli: {
        THRESHOLD_SAFE_GUARD: '0x061911E88A1b00b17e54dd29f2e3e014703B7eda',
        // yarn hardhat verify --network goerli 0x061911E88A1b00b17e54dd29f2e3e014703B7eda 0xA7F0F04efB55eaEfBC4649C523F7a773f91D5526 3
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
