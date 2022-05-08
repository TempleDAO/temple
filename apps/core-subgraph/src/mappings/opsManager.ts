import { log } from '@graphprotocol/graph-ts'
import { CreateVaultInstance, CreateExposure } from '../../generated/OpsManager/OpsManager'

import { createVault } from '../entities/vault'
import { createTreasuryFarmingRevenue } from '../entities/treasuryFarmingRevenue'
import { createExposure } from '../entities/exposure'


export function onCreateExposure(event: CreateExposure): void {
    createExposure(event)
    createTreasuryFarmingRevenue(event)
}

export function onCreateVaultInstance(event: CreateVaultInstance): void {
    createVault(event)
}
