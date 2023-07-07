import { network } from "hardhat";

export interface GovernanceDeployedContracts {
    TEMPLE: {
        MULTISIG: string,
        GOV_TIMELOCK: string,
    },
}

const GOV_DEPLOYED_CONTRACTS: {[key: string]: GovernanceDeployedContracts} = {
    polygonMumbai: {
        TEMPLE: {
            // A hot wallet, Mumbai isn't in Gnosis - ask @frontier for the PK if required.
            MULTISIG: '0x69E5F7487090EeFd92c16A803b3e6a689d8Ec165',
            
            GOV_TIMELOCK: '',
            // yarn hardhat verify --network polygonMumbai 0xXXX --constructor-args arguments.js
        }
    },
}

export function getDeployedContracts(): GovernanceDeployedContracts {
    if (GOV_DEPLOYED_CONTRACTS[network.name] === undefined) {
      console.log(`No contracts configured for ${network.name}`);
      throw new Error(`No contracts configured for ${network.name}`);
    } else {
      return GOV_DEPLOYED_CONTRACTS[network.name];
    }
}
