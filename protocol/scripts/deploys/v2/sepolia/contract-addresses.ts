import { network } from "hardhat";

export interface V2DeployedContracts {
    CORE: {
        TEMPLE_TOKEN: string,
        CIRCUIT_BREAKER_PROXY: string,
        GNOSIS_SAFE_GUARD: string,
        EXECUTOR_MSIG: string,
        RESCUER_MSIG: string,
    },
    TREASURY_RESERVES_VAULT: {
        ADDRESS: string,
        D_USD_TOKEN: string,
        D_TEMPLE_TOKEN: string,
        TPI_ORACLE: string,
    },
    TEMPLE_LINE_OF_CREDIT: {
        ADDRESS: string,
        CIRCUIT_BREAKERS: {
            DAI: string,
            TEMPLE: string,
        },
        INTEREST_RATE_MODELS: {
            LINEAR_WITH_KINK: string,
        },
    },
    RAMOS: {
        TEMPLE_DAI: {
            ADDRESS: string,
            AURA_STAKING: string,
            FEE_COLLECTOR: string,
            BPT_TOKEN: string,
            POOL_ID: string,
        }
    }
    STRATEGIES: {
        DSR_BASE_STRATEGY: {
            ADDRESS: string,
            EXECUTOR_MSIG: string,
            RESCUER_MSIG: string,
            // No circuit breakers for DSR base strategy
        }
        TEMPLE_BASE_STRATEGY: {
            ADDRESS: string,
            EXECUTOR_MSIG: string,
            RESCUER_MSIG: string,
            // No circuit breakers for Temple base strategy
        },
        TEST_GNOSIS_SAFE_STRATEGY1: {
            ADDRESS: string,
            EXECUTOR_MSIG: string,
            RESCUER_MSIG: string,
            UNDERLYING_GNOSIS_SAFE: string,
            CIRCUIT_BREAKERS: {
                DAI: string,
                TEMPLE: string,
            },
        },
        RAMOS_STRATEGY: {
            ADDRESS: string,
            EXECUTOR_MSIG: string,
            RESCUER_MSIG: string,
            CIRCUIT_BREAKERS: {
                DAI: string,
                TEMPLE: string,
            },
        },
        TLC_STRATEGY: {
            ADDRESS: string,
            EXECUTOR_MSIG: string,
            RESCUER_MSIG: string,
            CIRCUIT_BREAKERS: {
                DAI: string,
                TEMPLE: string,
            },
        },
    },
    EXTERNAL: {
        MAKER_DAO: {
            DAI_TOKEN: string,
            DAI_JOIN: string,
            POT: string,
        },
        BALANCER: {
            VAULT: string,
        },
    }
}

// @todo
// const V2_DEPLOYED_CONTRACTS: {[key: string]: V2DeployedContracts} = {
//     sepolia: {
//         // ...
//     },
// }

// export function getDeployedContracts(): V2DeployedContracts {
//     if (V2_DEPLOYED_CONTRACTS[network.name] === undefined) {
//       console.log(`No contracts configured for ${network.name}`);
//       throw new Error(`No contracts configured for ${network.name}`);
//     } else {
//       return V2_DEPLOYED_CONTRACTS[network.name];
//     }
// }
