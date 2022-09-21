import { Address, BigInt } from '@graphprotocol/graph-ts'

import { OpsManager } from '../../generated/schema'
import { OpsManager as OpsManagerContract } from '../../generated/OpsManager/OpsManager'

import { OPS_MANAGER_ID } from '../utils/constants'

export function createOpsManager(opsManagerAddress: string): OpsManager {
  let opsManager = OpsManager.load(OPS_MANAGER_ID);
  if (opsManager === null) {
    opsManager = new OpsManager(OPS_MANAGER_ID)
    opsManager.vaultGroups = []
    opsManager.exposures = []
    opsManager.treasuryFarmingRevenues = []

    const opsManagerContract = OpsManagerContract.bind(Address.fromString(opsManagerAddress))
    opsManager.vaultedTemple = opsManagerContract.vaultedTemple().toHexString()
    opsManager.templeExposure = opsManagerContract.templeExposure().toHexString()
    opsManager.save()
  }

  return opsManager as OpsManager
}

export function getOpsManager(): OpsManager {
  let opsManager = OpsManager.load(OPS_MANAGER_ID)

  return opsManager as OpsManager
}

export function updateOpsManager(opsManager: OpsManager, timestamp: BigInt): void {
  opsManager.timestamp = timestamp
  opsManager.save()
}
