import { CreateVaultInstance, CreateExposure } from '../../generated/OpsManager/OpsManager'

import { createVault } from '../entities/vault'
import { createTreasuryFarmingRevenue } from '../entities/treasuryFarmingRevenue'
import { createExposure } from '../entities/exposure'
import { createOpsManager } from '../entities/opsManager';


export function onCreateExposure(event: CreateExposure): void {
    createOpsManager(event.address.toHexString());
    createExposure(event)
    createTreasuryFarmingRevenue(event)
}

export function onCreateVaultInstance(event: CreateVaultInstance): void {
    createOpsManager(event.address.toHexString());
    createVault(event)
}
