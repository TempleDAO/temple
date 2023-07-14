import { Signer } from "ethers";
import { network } from "hardhat";
import { 
    DsrBaseStrategyTestnet__factory,
    FakeERC20__factory,
    LinearWithKinkInterestRateModel__factory,
    TempleCircuitBreakerAllUsersPerPeriod__factory,
    TempleCircuitBreakerProxy__factory,
    TempleDebtToken__factory,
    TempleERC20Token__factory,
    TempleLineOfCredit__factory,
    TempleTokenBaseStrategy__factory,
    TlcStrategy__factory,
    TreasuryPriceIndexOracle__factory,
    TreasuryReservesVault__factory 
} from '../../../../typechain';

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
            EXECUTOR_MSIG: "0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B",
            RESCUER_MSIG: "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46",
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
                EXECUTOR_MSIG: "0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B",
                RESCUER_MSIG: "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46",
                // No circuit breakers for DSR base strategy
            },
            TEMPLE_BASE_STRATEGY: {
                ADDRESS: "0xf0339f79445Ee8aF8E49051b0faC9F8B1B6B2cd1",
                EXECUTOR_MSIG: "0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B",
                RESCUER_MSIG: "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46",
                // No circuit breakers for Temple base strategy
            },
            // TEST_GNOSIS_SAFE_STRATEGY1: {
            //     ADDRESS: "",
            //     EXECUTOR_MSIG: "0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B",
            //     RESCUER_MSIG: "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46",
            //     UNDERLYING_GNOSIS_SAFE: "",
            //     CIRCUIT_BREAKERS: {
            //         DAI: "",
            //         TEMPLE: "",
            //     },
            // },
            // RAMOS_STRATEGY: {
            //     ADDRESS: "",
            //     EXECUTOR_MSIG: "0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B",
            //     RESCUER_MSIG: "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46",
            //     CIRCUIT_BREAKERS: {
            //         DAI: "",
            //         TEMPLE: "",
            //     },
            // },
            TLC_STRATEGY: {
                ADDRESS: "0xd6889AC17Ee4dCd62029f72eF8c33F10D7EE3358",
                EXECUTOR_MSIG: "0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B",
                RESCUER_MSIG: "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46",
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
    },
    localhost: {
      CORE: {
          TEMPLE_TOKEN: "0x470ebf5f030ed85fc1ed4c2d36b9dd02e77cf1b7",
          CIRCUIT_BREAKER_PROXY: "0xE2b5bDE7e80f89975f7229d78aD9259b2723d11F",
          // GNOSIS_SAFE_GUARD: "",
          EXECUTOR_MSIG: "0x4D6175d58C5AceEf30F546C0d5A557efFa53A950",
          RESCUER_MSIG: "",
      },
      TREASURY_RESERVES_VAULT: {
          ADDRESS: "0x4ea0Be853219be8C9cE27200Bdeee36881612FF2",
          D_USD_TOKEN: "0x46d4674578a2daBbD0CEAB0500c6c7867999db34",
          D_TEMPLE_TOKEN: "0x9155497EAE31D432C0b13dBCc0615a37f55a2c87",
          TPI_ORACLE: "0xC6c5Ab5039373b0CBa7d0116d9ba7fb9831C3f42",
      },
      TEMPLE_LINE_OF_CREDIT: {
          ADDRESS: "0xc1EeD9232A0A44c2463ACB83698c162966FBc78d",
          CIRCUIT_BREAKERS: {
              DAI: "0xC220Ed128102d888af857d137a54b9B7573A41b2",
              TEMPLE: "0xfaE849108F2A63Abe3BaB17E21Be077d07e7a9A2",
          },
          INTEREST_RATE_MODELS: {
              LINEAR_WITH_KINK: "0xfB12F7170FF298CDed84C793dAb9aBBEcc01E798",
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
              ADDRESS: "0x12456Fa31e57F91B70629c1196337074c966492a",
              EXECUTOR_MSIG: "0x4D6175d58C5AceEf30F546C0d5A557efFa53A950",
              RESCUER_MSIG: "",
              // No circuit breakers for DSR base strategy
          },
          TEMPLE_BASE_STRATEGY: {
              ADDRESS: "0xce830DA8667097BB491A70da268b76a081211814",
              EXECUTOR_MSIG: "0x4D6175d58C5AceEf30F546C0d5A557efFa53A950",
              RESCUER_MSIG: "",
              // No circuit breakers for Temple base strategy
          },
          // TEST_GNOSIS_SAFE_STRATEGY1: {
          //     ADDRESS: "",
          //     EXECUTOR_MSIG: "0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B",
          //     RESCUER_MSIG: "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46",
          //     UNDERLYING_GNOSIS_SAFE: "",
          //     CIRCUIT_BREAKERS: {
          //         DAI: "",
          //         TEMPLE: "",
          //     },
          // },
          // RAMOS_STRATEGY: {
          //     ADDRESS: "",
          //     EXECUTOR_MSIG: "0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B",
          //     RESCUER_MSIG: "0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46",
          //     CIRCUIT_BREAKERS: {
          //         DAI: "",
          //         TEMPLE: "",
          //     },
          // },
          TLC_STRATEGY: {
              ADDRESS: "0xD5bFeBDce5c91413E41cc7B24C8402c59A344f7c",
              EXECUTOR_MSIG: "0x4D6175d58C5AceEf30F546C0d5A557efFa53A950",
              RESCUER_MSIG: "",
          },
      },
      EXTERNAL: {
          MAKER_DAO: {
              DAI_TOKEN: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
              DAI_JOIN: "0x9759A6Ac90977b93B58547b4A71c78317f391A28",
              POT: "0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7",
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

export function connectToContracts(owner: Signer) {
    const TEMPLE_V2_DEPLOYED = getDeployedContracts();

    return {
        temple: TempleERC20Token__factory.connect(TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN, owner),
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
        tlcStrategy: TlcStrategy__factory.connect(TEMPLE_V2_DEPLOYED.STRATEGIES.TLC_STRATEGY.ADDRESS, owner),
        dai: FakeERC20__factory.connect(TEMPLE_V2_DEPLOYED.EXTERNAL.MAKER_DAO.DAI_TOKEN, owner)
    }
}