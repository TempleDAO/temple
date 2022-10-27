import { network } from "hardhat";

export interface DeployedContracts {
    MULTISIG: string;
    TEMPLAR_NFT: string;
    ELDER_ELECTION: string;
    TEMPLAR_METADATA: string;
}

export const DEPLOYED_CONTRACTS: { [key: string]: DeployedContracts } = {
    gnosisChiado: {
        MULTISIG: '0x1A88587a9b48f92000a68250b190Afb786BadFE5',  // This is a new random wallet - ask frontier if you need the private key.

        TEMPLAR_NFT: '',
        // yarn hardhat verify --network gnosisChiado 0xD54e5bF777561B819de14DbEB2C2A4c371DFC8EE

        ELDER_ELECTION: '',
        // yarn hardhat verify --network gnosisChiado 0xFe85ac1a8c04B81544BCD241C4c1c15b4024F030 0xD54e5bF777561B819de14DbEB2C2A4c371DFC8EE

        TEMPLAR_METADATA: '',
        // yarn hardhat verify --network gnosisChiado XXXFIXMEXXX
    },
    gnosis: {
        MULTISIG: '',
        TEMPLAR_NFT: '',
        ELDER_ELECTION: '',
        TEMPLAR_METADATA: '',
    },
    localhost: { 
        MULTISIG: '0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199', // Account #19
        TEMPLAR_NFT: process.env.TEMPLAR_NFT || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        ELDER_ELECTION: process.env.ELDER_ELECTION || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        TEMPLAR_METADATA: process.env.TEMPLAR_METADATA || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
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
