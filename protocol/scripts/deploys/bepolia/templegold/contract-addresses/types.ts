import { FakeERC20 } from "../../../../../typechain";
import { BaseContractAddresses, BaseContractInstances } from "../../../templegold/types";

export interface ContractAddresses extends BaseContractAddresses {
    TEMPLE_GOLD: BaseContractAddresses['TEMPLE_GOLD'] & {
        SPICE_TOKEN: string,
    },
}

export interface ContractInstances extends BaseContractInstances {
    TEMPLE_GOLD: BaseContractInstances['TEMPLE_GOLD'] & {
        SPICE_TOKEN: FakeERC20,
    },
}
