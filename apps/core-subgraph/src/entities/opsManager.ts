import { BigInt } from '@graphprotocol/graph-ts'

import { OPS_MANAGER_LOCAL } from '../utils/constants'
import { OpsManager } from '../../generated/schema'


export function getOpsManager(): OpsManager {
  let opsManager = OpsManager.load(OPS_MANAGER_LOCAL)

  if (opsManager === null) {
    opsManager = new OpsManager(OPS_MANAGER_LOCAL)
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
