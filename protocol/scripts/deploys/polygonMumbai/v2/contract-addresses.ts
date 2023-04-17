import { network } from "hardhat";

export interface V2DeployedContracts {
    TEMPLE: {
        TEMPLE_DEBT_TOKEN: string,
        TEMPLE_DEBT_TOKEN_TESTNET_ADMIN: string,
    },
}

const V2_DEPLOYED_CONTRACTS: {[key: string]: V2DeployedContracts} = {
    polygonMumbai: {
        TEMPLE: {
            TEMPLE_DEBT_TOKEN: '0x014a9d284ef12e5E0D79a153a954e72FA9963Fb0',
            // yarn hardhat verify --network polygonMumbai 0x014a9d284ef12e5E0D79a153a954e72FA9963Fb0 "Temple Debt Token" dUSD 0xA7F0F04efB55eaEfBC4649C523F7a773f91D5526 10000000000000000

            TEMPLE_DEBT_TOKEN_TESTNET_ADMIN: '0x0e216536cAcd0c137b087924E929212bF4F62e2f',
            // yarn hardhat verify --network polygonMumbai 0x0e216536cAcd0c137b087924E929212bF4F62e2f 0xFE0A7607f9D5f0A6669ed010Aba8fC64a7c86874
        }
    },
}

export function getDeployedContracts(): V2DeployedContracts {
    if (V2_DEPLOYED_CONTRACTS[network.name] === undefined) {
      console.log(`No contracts configured for ${network.name}`);
      throw new Error(`No contracts configured for ${network.name}`);
    } else {
      return V2_DEPLOYED_CONTRACTS[network.name];
    }
}
