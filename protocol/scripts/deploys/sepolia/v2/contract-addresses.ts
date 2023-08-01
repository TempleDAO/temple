import { network } from "hardhat";
import { 
    BalancerPoolHelper, BalancerPoolHelper__factory,
    DsrBaseStrategyTestnet, DsrBaseStrategyTestnet__factory,
    FakeERC20, FakeERC20__factory,
    GnosisStrategy,
    GnosisStrategy__factory,
    LinearWithKinkInterestRateModel, LinearWithKinkInterestRateModel__factory,
    Ramos, Ramos__factory,
    RamosStrategy, RamosStrategy__factory,
    RamosTestnetAuraStaking, RamosTestnetAuraStaking__factory,
    TempleCircuitBreakerAllUsersPerPeriod, TempleCircuitBreakerAllUsersPerPeriod__factory,
    TempleCircuitBreakerProxy, TempleCircuitBreakerProxy__factory,
    TempleDebtToken, TempleDebtToken__factory,
    TempleERC20Token, TempleERC20Token__factory,
    TempleLineOfCredit, TempleLineOfCredit__factory,
    TempleTokenBaseStrategy, TempleTokenBaseStrategy__factory,
    TlcStrategy, TlcStrategy__factory,
    TreasuryPriceIndexOracle, TreasuryPriceIndexOracle__factory,
    TreasuryReservesVault, TreasuryReservesVault__factory 
} from '../../../../typechain';
import { Signer } from "ethers";

export interface ContractAddresses {
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
  RAMOS: {
      AUTOMATION_EOA: string,
      TEMPLE_DAI: {
          ADDRESS: string,
          POOL_HELPER: string,
          AURA_STAKING: string,
          FEE_COLLECTOR: string,
          BPT_TOKEN: string,
          POOL_ID: string,
      },
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
      GNOSIS_SAFE_STRATEGY1: {
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
          RESCUER_MSIG: string
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
          HELPERS: string,
      },
  }
}

const V2_DEPLOYED_CONTRACTS: {[key: string]: ContractAddresses} = {
    sepolia: {
        CORE: {
            TEMPLE_TOKEN: '0x64a925B0fA211c44337148C0807f959Bd44b0B67',
            CIRCUIT_BREAKER_PROXY: '0xD112Fb2e38305829136971732c4805A782bcb459',
            // GNOSIS_SAFE_GUARD: '',
            EXECUTOR_MSIG: '0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B',
            RESCUER_MSIG: '0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46',
        },
        TREASURY_RESERVES_VAULT: {
            ADDRESS: '0x770E440064B1AC1f5A245655C5e4211439baB295',
            D_USD_TOKEN: '0xB089694e2930FFda2066c00Bd2A8e512a3B4fA43',
            D_TEMPLE_TOKEN: '0xAE53dcfE0E357DF2b5Ef1FF935dF29F57f76c751',
            TPI_ORACLE: '0x65946d23f3AF782c62ebd584Df58B3dd4CBd6Cbf',
        },
        TEMPLE_LINE_OF_CREDIT: {
            ADDRESS: '0xDa398D50EA06112C37f17e6E78bf688809caCd3D',
            CIRCUIT_BREAKERS: {
                DAI: '0x4431116580Af83b49279e9b6D088DcBa006c4Ff5',
                TEMPLE: '0xc058feCaC78bCdb497ea03dca1111ED3251b1832',
            },
            INTEREST_RATE_MODELS: {
                LINEAR_WITH_KINK: '0x1b86AF2A27fa7ac467ecbE287359620512bF2881',
            },
        },
        RAMOS: {
            AUTOMATION_EOA: '0x81960c465605cddD9772a8653111D4aBE580Ce1e',
            TEMPLE_DAI: {
                ADDRESS: '0x8A475A537309Ec054B08A509835860fE023fC6e6',
                POOL_HELPER: '0xe06dE436DC1cb94b6b33Bb8f3a769f925477FcbF',
                AURA_STAKING: '0x1F4A1c08CC0D9b75E5559dCBba97d3Bf5c90a855',
                FEE_COLLECTOR: '0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B',
                BPT_TOKEN: '0x825250921A357eE1e5411D33B88C83bfc0f34A2A',
                POOL_ID: '0x825250921a357ee1e5411d33b88c83bfc0f34a2a000200000000000000000011',
            },
        },
        STRATEGIES: {
            DSR_BASE_STRATEGY: {
                ADDRESS: '0x490fe5619dC690C0B8021c9dd024fbe23e4754DF',
                EXECUTOR_MSIG: '0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B',
                RESCUER_MSIG: '0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46',
                // No circuit breakers for DSR base strategy
            },
            TEMPLE_BASE_STRATEGY: {
                ADDRESS: '0xf0339f79445Ee8aF8E49051b0faC9F8B1B6B2cd1',
                EXECUTOR_MSIG: '0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B',
                RESCUER_MSIG: '0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46',
                // No circuit breakers for Temple base strategy
            },
            GNOSIS_SAFE_STRATEGY1: {
                ADDRESS: '0x10Dc371F7d3c0c3C857134de2390aE869F067895',
                EXECUTOR_MSIG: '0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B',
                RESCUER_MSIG: '0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46',
                UNDERLYING_GNOSIS_SAFE: '0x81960c465605cddD9772a8653111D4aBE580Ce1e', // The deployer wallet
                CIRCUIT_BREAKERS: {
                    DAI: '0xDdF6379c958a0783477f4458F19c3de53537c3Bd',
                    TEMPLE: '0x57d8D2C2e2b249Fc6a7292Fa83260604eC2A99e8',
                },
            },
            RAMOS_STRATEGY: {
                ADDRESS: '0xB9507b59f91FF320631d30f774142631b30C537A',
                EXECUTOR_MSIG: '0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B',
                RESCUER_MSIG: '0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46',
                CIRCUIT_BREAKERS: {
                    DAI: '0x3934dc8b1984904e6940348352Df2D1443B0Fda2',
                    TEMPLE: '0xf4A19c9f8a50d3A0d2f2F28B9e8658518c65151C',
                },
            },
            TLC_STRATEGY: {
                ADDRESS: '0xd6889AC17Ee4dCd62029f72eF8c33F10D7EE3358',
                EXECUTOR_MSIG: '0xF8Ab0fF572e48059c45eF3fa804e5A369d2b9b2B',
                RESCUER_MSIG: '0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46',
            },
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: '0x33FA9618365F67c5345066d5Cfd7f3A2f183599A',
                DAI_JOIN: '',
                POT: '',
            },
            BALANCER: {
                VAULT: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
                HELPERS: '0xdAE7e32ADc5d490a43cCba1f0c736033F2b4eFca',
            },
        }
    },
}

export function getDeployedContracts(): ContractAddresses {
    if (V2_DEPLOYED_CONTRACTS[network.name] === undefined) {
      console.log(`No contracts configured for ${network.name}`);
      throw new Error(`No contracts configured for ${network.name}`);
    } else {
      return V2_DEPLOYED_CONTRACTS[network.name];
    }
}

export interface ContractInstances {
    CORE: {
        TEMPLE_TOKEN: TempleERC20Token,
        CIRCUIT_BREAKER_PROXY: TempleCircuitBreakerProxy,
    },
    TREASURY_RESERVES_VAULT: {
        INSTANCE: TreasuryReservesVault,
        D_USD_TOKEN: TempleDebtToken,
        D_TEMPLE_TOKEN: TempleDebtToken,
        TPI_ORACLE: TreasuryPriceIndexOracle,
    },
    TEMPLE_LINE_OF_CREDIT: {
        INSTANCE: TempleLineOfCredit,
        CIRCUIT_BREAKERS: {
            DAI: TempleCircuitBreakerAllUsersPerPeriod,
            TEMPLE: TempleCircuitBreakerAllUsersPerPeriod,
        },
        INTEREST_RATE_MODELS: {
            LINEAR_WITH_KINK: LinearWithKinkInterestRateModel,
        },
    },
    RAMOS: {
        TEMPLE_DAI: {
            INSTANCE: Ramos,
            POOL_HELPER: BalancerPoolHelper,
            AURA_STAKING: RamosTestnetAuraStaking,
        }
    },
    STRATEGIES: {
        DSR_BASE_STRATEGY: {
            INSTANCE: DsrBaseStrategyTestnet,
        }
        TEMPLE_BASE_STRATEGY: {
            INSTANCE: TempleTokenBaseStrategy,
        },
        RAMOS_STRATEGY: {
            INSTANCE: RamosStrategy,
            CIRCUIT_BREAKERS: {
                DAI: TempleCircuitBreakerAllUsersPerPeriod,
                TEMPLE: TempleCircuitBreakerAllUsersPerPeriod,
            },
        },
        TLC_STRATEGY: {
            INSTANCE: TlcStrategy,
        },
        GNOSIS_SAFE_STRATEGY1: {
            INSTANCE: GnosisStrategy,
            CIRCUIT_BREAKERS: {
                DAI: TempleCircuitBreakerAllUsersPerPeriod,
                TEMPLE: TempleCircuitBreakerAllUsersPerPeriod,
            },
        },
    },
    EXTERNAL: {
        MAKER_DAO: {
            DAI_TOKEN: FakeERC20,
        },
    },
}

export function connectToContracts(owner: Signer): ContractInstances {
    const TEMPLE_V2_ADDRESSES = getDeployedContracts();

    return {
        CORE: {
            TEMPLE_TOKEN: TempleERC20Token__factory.connect(TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN, owner),
            CIRCUIT_BREAKER_PROXY: TempleCircuitBreakerProxy__factory.connect(TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY, owner),
        },
        TREASURY_RESERVES_VAULT: {
            INSTANCE: TreasuryReservesVault__factory.connect(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS, owner),
            D_USD_TOKEN: TempleDebtToken__factory.connect(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.D_USD_TOKEN, owner),
            D_TEMPLE_TOKEN: TempleDebtToken__factory.connect(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.D_TEMPLE_TOKEN, owner),
            TPI_ORACLE: TreasuryPriceIndexOracle__factory.connect(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.TPI_ORACLE, owner),
        },
        TEMPLE_LINE_OF_CREDIT: {
            INSTANCE: TempleLineOfCredit__factory.connect(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.ADDRESS, owner),
            CIRCUIT_BREAKERS: {
                DAI: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.DAI, owner),
                TEMPLE: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.CIRCUIT_BREAKERS.TEMPLE, owner),
            },
            INTEREST_RATE_MODELS: {
                LINEAR_WITH_KINK: LinearWithKinkInterestRateModel__factory.connect(TEMPLE_V2_ADDRESSES.TEMPLE_LINE_OF_CREDIT.INTEREST_RATE_MODELS.LINEAR_WITH_KINK, owner),
            },
        },
        RAMOS: {
            TEMPLE_DAI: {
                INSTANCE: Ramos__factory.connect(TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.ADDRESS, owner),
                POOL_HELPER: BalancerPoolHelper__factory.connect(TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.POOL_HELPER, owner),
                AURA_STAKING: RamosTestnetAuraStaking__factory.connect(TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.AURA_STAKING, owner),
            }
        },
        STRATEGIES: {
            DSR_BASE_STRATEGY: {
                INSTANCE: DsrBaseStrategyTestnet__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS, owner),
            },
            TEMPLE_BASE_STRATEGY: {
                INSTANCE: TempleTokenBaseStrategy__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS, owner),
            },
            RAMOS_STRATEGY: {
                INSTANCE: RamosStrategy__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.ADDRESS, owner),
                CIRCUIT_BREAKERS: {
                    DAI: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.DAI, owner),
                    TEMPLE: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE, owner),
                },
            },
            TLC_STRATEGY: {
                INSTANCE: TlcStrategy__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.TLC_STRATEGY.ADDRESS, owner),
            },
            GNOSIS_SAFE_STRATEGY1: {
                INSTANCE: GnosisStrategy__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY1.ADDRESS, owner),
                CIRCUIT_BREAKERS: {
                    DAI: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY1.CIRCUIT_BREAKERS.DAI, owner),
                    TEMPLE: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY1.CIRCUIT_BREAKERS.TEMPLE, owner),
                },
            },
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: FakeERC20__factory.connect(TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN, owner),
            },
        }
    }
}