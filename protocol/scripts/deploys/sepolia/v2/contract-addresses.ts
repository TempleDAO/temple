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
      GNOSIS_SAFE_STRATEGY_TEMPLATE: {
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
            CIRCUIT_BREAKER_PROXY: '0x08F542783f076cA905EEccC6a987629BE5017a4C',
            GNOSIS_SAFE_GUARD: '0x9A792288BE7d6Be936882e00D8C3a2b05a921e65',
            EXECUTOR_MSIG: '0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd',
            RESCUER_MSIG: '0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46',
        },
        TREASURY_RESERVES_VAULT: {
            ADDRESS: '0x7f19419488274bcC363d93F70809cDd53C788aF7',
            D_USD_TOKEN: '0x595309143e6716ebC9Ee239B7C6E76e9Dd6b1EB1',
            D_TEMPLE_TOKEN: '0xB2a141998caC05742eC1C21a17e129947Ca64D9C',
            TPI_ORACLE: '0x99a45931DB0Fdb14E1D3f6a7E25d14101534CA2f',
        },
        TEMPLE_LINE_OF_CREDIT: {
            ADDRESS: '0xAe0A4a7690F5f308C6615E3738243Ab629DaEAEA',
            CIRCUIT_BREAKERS: {
                DAI: '0x30AC664062f58b6E4DF187713a2352385633B739',
                TEMPLE: '0x8f783c4A3d90712A794d5660b632AC67611852aF',
            },
            INTEREST_RATE_MODELS: {
                LINEAR_WITH_KINK: '0x78508DDA0b7C3A97ed44a4C2C6F54EABF3F18dba',
            },
        },
        RAMOS: {
            AUTOMATION_EOA: '0x81960c465605cddD9772a8653111D4aBE580Ce1e',
            TEMPLE_DAI: {
                ADDRESS: '0x82ce000a51E8474378f7b555bcC4de5992052452',
                POOL_HELPER: '0xbfC24c9d7D57C413618CE11cea1e313a2E8D9e1d',
                AURA_STAKING: '0xa60eB5CFb98BB7237751077baD3addd6d3C61803',
                FEE_COLLECTOR: '0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd',
                BPT_TOKEN: '0x825250921A357eE1e5411D33B88C83bfc0f34A2A',
                POOL_ID: '0x825250921a357ee1e5411d33b88c83bfc0f34a2a000200000000000000000011',
            },
        },
        STRATEGIES: {
            DSR_BASE_STRATEGY: {
                ADDRESS: '0x472C7cDb6E730ff499E118dE6260c6b44c61d7bf',
                EXECUTOR_MSIG: '0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd',
                RESCUER_MSIG: '0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46',
                // No circuit breakers for DSR base strategy
            },
            TEMPLE_BASE_STRATEGY: {
                ADDRESS: '0xECe4ff1bd589b488350557A5C36D823C7B47E82F',
                EXECUTOR_MSIG: '0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd',
                RESCUER_MSIG: '0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46',
                // No circuit breakers for Temple base strategy
            },
            GNOSIS_SAFE_STRATEGY_TEMPLATE: {
                ADDRESS: '0x76D3d175f18FAc6e390a33bf54c6477AcE6697e2',
                EXECUTOR_MSIG: '0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd',
                RESCUER_MSIG: '0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46',
                UNDERLYING_GNOSIS_SAFE: '0x81960c465605cddD9772a8653111D4aBE580Ce1e', // The deployer wallet
                CIRCUIT_BREAKERS: {
                    DAI: '0xe9a8D76410452E8AD58aEc0Ec596f480C7CBb716',
                    TEMPLE: '0xf60b3FffeAa57C8251cE0fE8C53A631DE64E1170',
                },
            },
            RAMOS_STRATEGY: {
                ADDRESS: '0xB9507b59f91FF320631d30f774142631b30C537A',
                EXECUTOR_MSIG: '0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd',
                RESCUER_MSIG: '0x8dbe2E7Cab43F00fce7fFe90769b87456692CE46',
                CIRCUIT_BREAKERS: {
                    DAI: '0xcF4fdC6d455F33A6236df79aAA82c58E173f7fB5',
                    TEMPLE: '0x77678C041A8ee01Fe4AE8dc12d15451b113d2A4F',
                },
            },
            TLC_STRATEGY: {
                ADDRESS: '0x415A9B41700AC645d9C22F2499a6E853b625F792',
                EXECUTOR_MSIG: '0x7d1e9012aA41278349791f29C2cdaa3DF4ceDcEd',
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
        GNOSIS_SAFE_GUARD: GnosisStrategy,
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
        GNOSIS_SAFE_STRATEGY_TEMPLATE: {
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
            GNOSIS_SAFE_GUARD: GnosisStrategy__factory.connect(TEMPLE_V2_ADDRESSES.CORE.GNOSIS_SAFE_GUARD, owner),
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
            GNOSIS_SAFE_STRATEGY_TEMPLATE: {
                INSTANCE: GnosisStrategy__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.ADDRESS, owner),
                CIRCUIT_BREAKERS: {
                    DAI: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.CIRCUIT_BREAKERS.DAI, owner),
                    TEMPLE: TempleCircuitBreakerAllUsersPerPeriod__factory.connect(TEMPLE_V2_ADDRESSES.STRATEGIES.GNOSIS_SAFE_STRATEGY_TEMPLATE.CIRCUIT_BREAKERS.TEMPLE, owner),
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