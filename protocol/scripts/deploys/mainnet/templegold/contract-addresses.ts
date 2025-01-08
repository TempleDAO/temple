import { network } from "hardhat";
import {
    FakeERC20, FakeERC20__factory,
    TempleGold__factory, TempleGold,
    TempleGoldAdmin, TempleGoldAdmin__factory,
    TempleGoldStaking, TempleGoldStaking__factory,
    SpiceAuction__factory, SpiceAuction,
    SpiceAuctionFactory__factory, SpiceAuctionFactory,
    StableGoldAuction__factory, StableGoldAuction,
    TempleTeleporter, TempleTeleporter__factory,
    TempleERC20Token, TempleERC20Token__factory
} from '../../../../typechain';
import { Signer } from "ethers";

export interface ContractAddresses {
    TEMPLE_GOLD: {
        AUCTION_AUTOMATION_EOA: string,
        STAKING_AUTOMATION_EOA: string,
        SPICE_AUCTION_OPERATOR: string,
        TEMPLE_GOLD: string,
        TEMPLE_GOLD_ADMIN: string,
        TEMPLE_GOLD_STAKING: string,
        TEMPLE_TELEPORTER: string,
        SPICE_AUCTION: string,
        SPICE_AUCTION_FACTORY: string,
        STABLE_GOLD_AUCTION: string,
        EXECUTOR_MSIG: string,
        RESCUER_MSIG: string,
    },
    CORE: {
        TEMPLE_TOKEN: string,
        FEE_COLLECTOR: string,
    },
    EXTERNAL: {
        LAYER_ZERO: {
            ENDPOINT: string,
        },
        MAKER_DAO: {
            DAI_TOKEN: string,
        },
        SKY: {
            USDS_TOKEN: string,
        }
    }
}

export interface PeerInfo {
    destEid: number,
    chainId: number,
}

const TEMPLEGOLD_DEPLOYED_CONTRACTS: {[key: string]: ContractAddresses} = {
    arbitrumOne: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "string",
            STAKING_AUTOMATION_EOA: "string",
            SPICE_AUCTION_OPERATOR: "string",
            TEMPLE_GOLD: "string",
            TEMPLE_GOLD_ADMIN: "string",
            TEMPLE_GOLD_STAKING: "string",
            TEMPLE_TELEPORTER: "string",
            SPICE_AUCTION: "string",
            SPICE_AUCTION_FACTORY: "string",
            STABLE_GOLD_AUCTION: "string",
            EXECUTOR_MSIG: "string",
            RESCUER_MSIG: "string",
        },
        CORE: {
            TEMPLE_TOKEN: "string",
            FEE_COLLECTOR: "string",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x1a44076050125825900e736c501f859c50fE728c",
            },
            MAKER_DAO: {
                DAI_TOKEN: "",
            },
            SKY: {
                USDS_TOKEN: "string",
            }
        },
    },
    mainnet: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "string",
            STAKING_AUTOMATION_EOA: "string",
            SPICE_AUCTION_OPERATOR: "string",
            TEMPLE_GOLD: "string",
            TEMPLE_GOLD_ADMIN: "string",
            TEMPLE_GOLD_STAKING: "string",
            TEMPLE_TELEPORTER: "string",
            SPICE_AUCTION: "string",
            SPICE_AUCTION_FACTORY: "string",
            STABLE_GOLD_AUCTION: "string",
            EXECUTOR_MSIG: "string",
            RESCUER_MSIG: "string",
        },
        CORE: {
            TEMPLE_TOKEN: "string",
            FEE_COLLECTOR: "0x4D6175d58C5AceEf30F546C0d5A557efFa53A950",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x1a44076050125825900e736c501f859c50fE728c",
            },
            MAKER_DAO: {
                DAI_TOKEN: "",
            },
            SKY: {
                USDS_TOKEN: "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
            }
        },
    },
    sepolia: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "string",
            STAKING_AUTOMATION_EOA: "string",
            SPICE_AUCTION_OPERATOR: "string",
            TEMPLE_GOLD: "0x2ae6318e34bb97ae3755AFcE75559452aA223A5D",
            TEMPLE_GOLD_ADMIN: "string",
            TEMPLE_GOLD_STAKING: "0xdbDAc0FCA9cF8CA2F2Ef718775f0F265f581808F",
            TEMPLE_TELEPORTER: "0x7455A2bDbE76d36c835824D9A41E6842216d6c36",
            SPICE_AUCTION: "string",
            SPICE_AUCTION_FACTORY: "0x0231340BBAf990B3Aa9f2B095b9DC11e493059c1",
            STABLE_GOLD_AUCTION: "0x8d3671d794d511Bb0E3D28e260F8E2233C0653aB",
            EXECUTOR_MSIG: "string",
            RESCUER_MSIG: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        },
        CORE: {
            TEMPLE_TOKEN: "0x98c5E61b1B3731A1f379E8770861164d23118cdc",
            FEE_COLLECTOR: "string",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x6EDCE65403992e310A62460808c4b910D972f10f",
            },
            MAKER_DAO: {
                DAI_TOKEN: "0xBe9162230D9e637218D74C7f41f62ef2385fEe64",
            },
            SKY: {
                USDS_TOKEN: "string",
            }
        },
    },
    cartio: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "string",
            STAKING_AUTOMATION_EOA: "string",
            SPICE_AUCTION_OPERATOR: "string",
            TEMPLE_GOLD: "0x2ae6318e34bb97ae3755AFcE75559452aA223A5D",
            TEMPLE_GOLD_ADMIN: "0xBe9162230D9e637218D74C7f41f62ef2385fEe64",
            TEMPLE_GOLD_STAKING: "string",
            TEMPLE_TELEPORTER: "0xcbc7cf85dd0AB91Aa2671400E86ebf3AaC6dc658",
            SPICE_AUCTION: "string",
            SPICE_AUCTION_FACTORY: "string",
            STABLE_GOLD_AUCTION: "string",
            EXECUTOR_MSIG: "string",
            RESCUER_MSIG: "string",
        },
        CORE: {
            TEMPLE_TOKEN: "0x0090F9655a0B0A32cEE0Da5ae45E93EAB4C6d149",
            FEE_COLLECTOR: "string",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x6C7Ab2202C98C4227C5c46f1417D81144DA716Ff",
            },
            MAKER_DAO: {
                DAI_TOKEN: "string",
            },
            SKY: {
                USDS_TOKEN: "string",
            }
        },
    },
    arbitrumSepolia: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "string",
            STAKING_AUTOMATION_EOA: "string",
            SPICE_AUCTION_OPERATOR: "string",
            TEMPLE_GOLD: "0x8afB7E03a6e115577361C5648924eBA3163381Fc",
            TEMPLE_GOLD_ADMIN: "string",
            TEMPLE_GOLD_STAKING: "0xa2f7B537B530481b12A5538bE7309fB6a34849f3",
            TEMPLE_TELEPORTER: "0x57cde11128c70948B910Bf34cF6F834c78B66b0f",
            SPICE_AUCTION: "0x51ebd148AE75B3e2CfDF972c94D7775B16060672",
            SPICE_AUCTION_FACTORY: "0x30223FD9CDBCb97F15FE188769B0170F2a993A3E",
            STABLE_GOLD_AUCTION: "0xF5B76f09B9df3eBD45155007590a9C14fEa2D4c1",
            EXECUTOR_MSIG: "string",
            RESCUER_MSIG: "string",
        },
        CORE: {
            TEMPLE_TOKEN: "0x36061ce3Ac2F5d69667F0c7B98Ec6021ef33b8cB",
            FEE_COLLECTOR: "string",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: "0x6EDCE65403992e310A62460808c4b910D972f10f",
            },
            MAKER_DAO: {
                DAI_TOKEN: "0x5879B1ae381DDbBa701170160162025d297ce3D3",
            },
            SKY: {
                USDS_TOKEN: "string",
            }
        },
    },
    localhost: {
        TEMPLE_GOLD: {
            AUCTION_AUTOMATION_EOA: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            STAKING_AUTOMATION_EOA: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            SPICE_AUCTION_OPERATOR: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            TEMPLE_GOLD: "0xB21C6Ba5fE6dC56DDF86B3979bE5A45004813033",
            TEMPLE_GOLD_ADMIN: "0xAbB1910DCFD0d7a0527Ad276b464324Dd4d2586B",
            TEMPLE_GOLD_STAKING: "0x2B1FFeAa017072C4641a01C1A4B051d803490dA1",
            TEMPLE_TELEPORTER: "0x7914a8b73E11432953d9cCda060018EA1d9DCde9",
            SPICE_AUCTION: "string",
            SPICE_AUCTION_FACTORY: "string",
            STABLE_GOLD_AUCTION: "0x5FBF8300577eA2410098fF5E4CC3198f1b51A4cF",
            EXECUTOR_MSIG: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            RESCUER_MSIG: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        },
        CORE: {
            TEMPLE_TOKEN: "0x2B5757720f361559fe0C499C55eFa65bd6bC6cA3",
            FEE_COLLECTOR: "string",
        },
        EXTERNAL: {
            LAYER_ZERO: {
                ENDPOINT: '0x1a44076050125825900e736c501f859c50fE728c',
            },
            MAKER_DAO: {
                DAI_TOKEN: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
            },
            SKY: {
                USDS_TOKEN: "string",
            }
        },
    }
}

const PEER_INFO: { [key: string]: PeerInfo } = {
    cartio: {
        destEid: 40346,
        chainId: 80000
    },
    sepolia: {
        destEid: 40161,
        chainId: 11155111
    },
    arbitrumSepolia: {
        destEid: 40231,
        chainId: 421614
    },
    mainnet: {
        destEid: 30101,
        chainId: 1
    }
}

export function getDeployedTempleGoldContracts(): ContractAddresses {
    if (TEMPLEGOLD_DEPLOYED_CONTRACTS[network.name] === undefined) {
      console.log(`No contracts configured for ${network.name}`);
      throw new Error(`No contracts configured for ${network.name}`);
    } else {
      return TEMPLEGOLD_DEPLOYED_CONTRACTS[network.name];
    }
}

export function getPeerInfo(network: string): PeerInfo {
    if (PEER_INFO[network] === undefined) {
        console.log(`No peer info configured for ${network}`);
        throw new Error(`No peer info configured for ${network}`);
      } else {
        return PEER_INFO[network];
      }
}

export interface ContractInstances {
    TEMPLE_GOLD: {
        TEMPLE_GOLD: TempleGold,
        TEMPLE_GOLD_ADMIN: TempleGoldAdmin,
        TEMPLE_GOLD_STAKING: TempleGoldStaking,
        TEMPLE_TELEPORTER: TempleTeleporter,
        SPICE_AUCTION: SpiceAuction,
        SPICE_AUCTION_FACTORY: SpiceAuctionFactory,
        STABLE_GOLD_AUCTION: StableGoldAuction,
    },
    CORE: {
        TEMPLE_TOKEN: TempleERC20Token
    },
    EXTERNAL: {
        MAKER_DAO: {
            DAI_TOKEN: FakeERC20,
        },
    },
}

export function connectToContracts(owner: Signer): ContractInstances {
    const TEMPLE_GOLD_ADDRESSES = getDeployedTempleGoldContracts();

    return {
        TEMPLE_GOLD: {
            TEMPLE_GOLD: TempleGold__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD, owner),
            TEMPLE_GOLD_ADMIN: TempleGoldAdmin__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_ADMIN, owner),
            TEMPLE_GOLD_STAKING: TempleGoldStaking__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_STAKING, owner),
            SPICE_AUCTION: SpiceAuction__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.SPICE_AUCTION, owner),
            SPICE_AUCTION_FACTORY: SpiceAuctionFactory__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY, owner),
            STABLE_GOLD_AUCTION: StableGoldAuction__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.STABLE_GOLD_AUCTION, owner),
            TEMPLE_TELEPORTER: TempleTeleporter__factory.connect(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_TELEPORTER, owner),
        },
        CORE: {
            TEMPLE_TOKEN: TempleERC20Token__factory.connect(TEMPLE_GOLD_ADDRESSES.CORE.TEMPLE_TOKEN, owner),
        },
        EXTERNAL: {
            MAKER_DAO: {
                DAI_TOKEN: FakeERC20__factory.connect(TEMPLE_GOLD_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN, owner),
            },
        }
    }
}