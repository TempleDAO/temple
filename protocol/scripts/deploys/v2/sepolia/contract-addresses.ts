import { network } from "hardhat";

export interface V2DeployedContracts {
    CORE: {
        TEMPLE_TOKEN: string,
        CIRCUIT_BREAKER_PROXY: string,
        // GNOSIS_SAFE_GUARD: string,
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
    // RAMOS: {
    //     TEMPLE_DAI: {
    //         ADDRESS: string,
    //         AURA_STAKING: string,
    //         FEE_COLLECTOR: string,
    //         BPT_TOKEN: string,
    //         POOL_ID: string,
    //     }
    // }
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
        // TEST_GNOSIS_SAFE_STRATEGY1: {
        //     ADDRESS: string,
        //     EXECUTOR_MSIG: string,
        //     RESCUER_MSIG: string,
        //     UNDERLYING_GNOSIS_SAFE: string,
        //     CIRCUIT_BREAKERS: {
        //         DAI: string,
        //         TEMPLE: string,
        //     },
        // },
        // RAMOS_STRATEGY: {
        //     ADDRESS: string,
        //     EXECUTOR_MSIG: string,
        //     RESCUER_MSIG: string,
        //     CIRCUIT_BREAKERS: {
        //         DAI: string,
        //         TEMPLE: string,
        //     },
        // },
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
        // BALANCER: {
        //     VAULT: string,
        // },
    }
}

const V2_DEPLOYED_CONTRACTS: {[key: string]: V2DeployedContracts} = {
    sepolia: {
        CORE: {
            TEMPLE_TOKEN: "0x64a925B0fA211c44337148C0807f959Bd44b0B67",
            CIRCUIT_BREAKER_PROXY: "0xD112Fb2e38305829136971732c4805A782bcb459",
            // GNOSIS_SAFE_GUARD: "",
            EXECUTOR_MSIG: "0x...",
            RESCUER_MSIG: "0x...",
        },
        TREASURY_RESERVES_VAULT: {
            ADDRESS: "0x770E440064B1AC1f5A245655C5e4211439baB295",
            D_USD_TOKEN: "0xB089694e2930FFda2066c00Bd2A8e512a3B4fA43",
            D_TEMPLE_TOKEN: "0xAE53dcfE0E357DF2b5Ef1FF935dF29F57f76c751",
            TPI_ORACLE: "0x65946d23f3AF782c62ebd584Df58B3dd4CBd6Cbf",
        },
        TEMPLE_LINE_OF_CREDIT: {
            ADDRESS: "",
            CIRCUIT_BREAKERS: {
                DAI: "",
                TEMPLE: "",
            },
            INTEREST_RATE_MODELS: {
                LINEAR_WITH_KINK: "",
            },
        },
        // RAMOS: {
        //     TEMPLE_DAI: {
        //         ADDRESS: "",
        //         AURA_STAKING: "",
        //         FEE_COLLECTOR: "",
        //         BPT_TOKEN: "",
        //         POOL_ID: "",
        //     }
        // }
        STRATEGIES: {
            DSR_BASE_STRATEGY: {
                ADDRESS: "",
                EXECUTOR_MSIG: "0x...",
                RESCUER_MSIG: "0x...",
                // No circuit breakers for DSR base strategy
            },
            TEMPLE_BASE_STRATEGY: {
                ADDRESS: "",
                EXECUTOR_MSIG: "0x...",
                RESCUER_MSIG: "0x...",
                // No circuit breakers for Temple base strategy
            },
            // TEST_GNOSIS_SAFE_STRATEGY1: {
            //     ADDRESS: "",
            //     EXECUTOR_MSIG: "",
            //     RESCUER_MSIG: "",
            //     UNDERLYING_GNOSIS_SAFE: "",
            //     CIRCUIT_BREAKERS: {
            //         DAI: "",
            //         TEMPLE: "",
            //     },
            // },
            // RAMOS_STRATEGY: {
            //     ADDRESS: "",
            //     EXECUTOR_MSIG: "",
            //     RESCUER_MSIG: "",
            //     CIRCUIT_BREAKERS: {
            //         DAI: "",
            //         TEMPLE: "",
            //     },
            // },
            TLC_STRATEGY: {
                ADDRESS: "",
                EXECUTOR_MSIG: "0x...",
                RESCUER_MSIG: "0x...",
                CIRCUIT_BREAKERS: {
                    DAI: "",
                    TEMPLE: "",
                },
            },
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: "",
                DAI_JOIN: "",
                POT: "",
            },
            // BALANCER: {
            //     VAULT: "",
            // },
        }
    }
}

export function getDeployedContracts(): V2DeployedContracts {
    if (V2_DEPLOYED_CONTRACTS[network.name] === undefined) {
      console.log(`No contracts configured for ${network.name}`);
      throw new Error(`No contracts configured for ${network.name}`);
    } else {
      return V2_DEPLOYED_CONTRACTS[network.name];
    }
}
