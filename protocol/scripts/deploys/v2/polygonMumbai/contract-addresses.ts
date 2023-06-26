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
            TEMPLE_DEBT_TOKEN: '0x1894037752b79CD81d8093A67174722f3b516EFD',
            // yarn hardhat verify --network polygonMumbai 0x1894037752b79CD81d8093A67174722f3b516EFD "Temple Debt Token" dUSD 0xA7F0F04efB55eaEfBC4649C523F7a773f91D5526 0xA7F0F04efB55eaEfBC4649C523F7a773f91D5526 34304803691990293

            TEMPLE_DEBT_TOKEN_TESTNET_ADMIN: '0x102b2CC5459df5865E53A30D56B414b6BE40640d',
            // yarn hardhat verify --network polygonMumbai 0x102b2CC5459df5865E53A30D56B414b6BE40640d 0x1894037752b79CD81d8093A67174722f3b516EFD
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
