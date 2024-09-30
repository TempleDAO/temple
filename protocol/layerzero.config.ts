import { EndpointId, TestnetV2EndpointId } from '@layerzerolabs/lz-definitions'

import type { OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

const sepoliaContract: OmniPointHardhat = {
    eid: Number(TestnetV2EndpointId.SEPOLIA_V2_TESTNET),
    contractName: 'TempleGold',
}

const arbitrumSepoliaContract: OmniPointHardhat = {
    eid: Number(TestnetV2EndpointId.ARBITRUM_V2_TESTNET),
    contractName: 'TempleGold',
}


const config: OAppOmniGraphHardhat = {
    contracts: [
        {
            contract: sepoliaContract,
        },
        {
            contract: arbitrumSepoliaContract,
        },
    ],
    connections: [
        {
            from: arbitrumSepoliaContract,
            to: sepoliaContract,
        },
        {
            from: sepoliaContract,
            to: arbitrumSepoliaContract,
        },
    ],
}

export default config