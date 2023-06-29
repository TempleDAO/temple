import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { network } from "hardhat";
import { DsrBaseStrategyTestnet__factory, LinearWithKinkInterestRateModel__factory, TempleCircuitBreakerAllUsersPerPeriod__factory, TempleCircuitBreakerProxy__factory, TempleDebtToken__factory, TempleERC20Token__factory, TempleLineOfCredit__factory, TempleTokenBaseStrategy__factory, TlcStrategy__factory, TreasuryPriceIndexOracle__factory, TreasuryReservesVault__factory } from '../../../../typechain';

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
            RESCUER_MSIG: string
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
            ADDRESS: "0xDa398D50EA06112C37f17e6E78bf688809caCd3D",
            CIRCUIT_BREAKERS: {
                DAI: "0x4431116580Af83b49279e9b6D088DcBa006c4Ff5",
                TEMPLE: "0xc058feCaC78bCdb497ea03dca1111ED3251b1832",
            },
            INTEREST_RATE_MODELS: {
                LINEAR_WITH_KINK: "0x1b86AF2A27fa7ac467ecbE287359620512bF2881",
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
                ADDRESS: "0x490fe5619dC690C0B8021c9dd024fbe23e4754DF",
                EXECUTOR_MSIG: "0x...",
                RESCUER_MSIG: "0x...",
                // No circuit breakers for DSR base strategy
            },
            TEMPLE_BASE_STRATEGY: {
                ADDRESS: "0xf0339f79445Ee8aF8E49051b0faC9F8B1B6B2cd1",
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
                ADDRESS: "0xd6889AC17Ee4dCd62029f72eF8c33F10D7EE3358",
                EXECUTOR_MSIG: "0x...",
                RESCUER_MSIG: "0x..."
            },
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: "0x33FA9618365F67c5345066d5Cfd7f3A2f183599A",
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

export function connectToContracts(owner: SignerWithAddress) {
    const TEMPLE_V2_DEPLOYED = getDeployedContracts();

    return {
        templeToken: TempleERC20Token__factory.connect(TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN, owner),
        circuitBreakerProxy: TempleCircuitBreakerProxy__factory.connect(TEMPLE_V2_DEPLOYED.CORE.CIRCUIT_BREAKER_PROXY, owner),
        trv: TreasuryReservesVault__factory.connect(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS, owner),
        dusd: TempleDebtToken__factory.connect(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.D_USD_TOKEN, owner),
        dtemple: TempleDebtToken__factory.connect(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN, owner),
        tpiOracle: TreasuryPriceIndexOracle__factory.connect(TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.TPI_ORACLE, owner),
        tlc: TempleLineOfCredit__factory.connect(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.ADDRESS, owner),
        tlcCircuitBreakerDai: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.DAI, owner),
        tlcCircuitBreakerTemple: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.TEMPLE, owner),
        tlcLinearKink: LinearWithKinkInterestRateModel__factory.connect(TEMPLE_V2_DEPLOYED.TEMPLE_LINE_OF_CREDIT.INTEREST_RATE_MODELS.LINEAR_WITH_KINK, owner),
        dsrBaseStrategy: DsrBaseStrategyTestnet__factory.connect(TEMPLE_V2_DEPLOYED.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS, owner),
        templeBaseStrategy: TempleTokenBaseStrategy__factory.connect(TEMPLE_V2_DEPLOYED.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS, owner),
        tlcStrategy: TlcStrategy__factory.connect(TEMPLE_V2_DEPLOYED.STRATEGIES.TLC_STRATEGY.ADDRESS, owner)
    }
}