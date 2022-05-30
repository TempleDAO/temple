import { BigInt } from '@graphprotocol/graph-ts'

import { OpsManager } from '../../generated/schema'

import { OPS_MANAGER } from '../utils/constants'


export function getOpsManager(): OpsManager {
  let opsManager = OpsManager.load(OPS_MANAGER)

  if (opsManager === null) {
    opsManager = new OpsManager(OPS_MANAGER)
    opsManager.vaultGroups = []
    opsManager.exposures = []
    opsManager.treasuryFarmingRevenues = []
    opsManager.save()
  }

  return opsManager as OpsManager
}

export function updateOpsManager(opsManager: OpsManager, timestamp: BigInt): void {
  opsManager.timestamp = timestamp
  opsManager.save()
}
