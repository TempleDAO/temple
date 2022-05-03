import { BigInt } from '@graphprotocol/graph-ts'

import { BIG_DECIMAL_0, BIG_INT_1 } from '../utils/constants'

import { VaultGroup } from '../../generated/schema'
import { getMetric, updateMetric } from './metric'


export function createVaultGroup(groupID: string, timestamp: BigInt): VaultGroup {
  const metric = getMetric()
  metric.vaultGroupCount = metric.vaultGroupCount.plus(BIG_INT_1)
  updateMetric(metric, timestamp)

  const vaultGroup = new VaultGroup(groupID)
  vaultGroup.timestamp = timestamp
  vaultGroup.save()

  return vaultGroup as VaultGroup
}

export function getOrCreateVaultGroup(groupID: string, timestamp: BigInt): VaultGroup {
  let vaultGroup = VaultGroup.load(groupID)

  if (vaultGroup === null) {
    vaultGroup = createVaultGroup(groupID, timestamp)
  }

  return vaultGroup as VaultGroup
}

export function getVaultGroup(groupID: string): VaultGroup {
  const vaultGroup = VaultGroup.load(groupID)

  return vaultGroup as VaultGroup
}

export function updateVaultGroup(vaultGroup: VaultGroup, timestamp: BigInt): void {
  vaultGroup.timestamp = timestamp
  vaultGroup.save()
}
