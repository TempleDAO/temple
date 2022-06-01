import { BigInt } from '@graphprotocol/graph-ts'

import { VaultGroup, VaultGroupDayData } from '../../generated/schema'

import { getMetric, updateMetric } from './metric'
import { getOpsManager, updateOpsManager } from './opsManager'
import { dayFromTimestamp } from '../utils/dates'
import { BIG_INT_1 } from '../utils/constants'


export function createVaultGroup(groupID: string, timestamp: BigInt): VaultGroup {
  const metric = getMetric()
  metric.vaultGroupCount = metric.vaultGroupCount.plus(BIG_INT_1)
  updateMetric(metric, timestamp)

  const vaultGroup = new VaultGroup(groupID)
  vaultGroup.timestamp = timestamp

  const opsManager = getOpsManager()
  const vaultGroups = opsManager.vaultGroups
  vaultGroups.push(vaultGroup.id)
  opsManager.vaultGroups = vaultGroups
  updateOpsManager(opsManager, timestamp)

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

export function getVaultGroups(): string[] {
  const opsManager = getOpsManager()
  const vaultGroups = opsManager.vaultGroups

  return vaultGroups
}

export function updateVaultGroups(vaultGroups: string[], timestamp: BigInt): void {
  for (let i = 0; i < vaultGroups.length; i++) {
    const vaultGroup = VaultGroup.load(vaultGroups[i]) as VaultGroup
    updateVaultGroup(vaultGroup, timestamp)
  }
}

export function updateVaultGroup(vaultGroup: VaultGroup, timestamp: BigInt): void {
  vaultGroup.timestamp = timestamp
  vaultGroup.save()

  updateOrCreateDayData(vaultGroup, timestamp)
}

export function updateOrCreateDayData(vaultGroup: VaultGroup, timestamp: BigInt): void {
  const dayTimestamp = dayFromTimestamp(timestamp);

  let dayData = VaultGroupDayData.load(dayTimestamp)
  if (dayData === null) {
    dayData = new VaultGroupDayData(dayTimestamp)
  }

  dayData.timestamp = timestamp
  dayData.vaultGroup = vaultGroup.id
  dayData.tvl = vaultGroup.tvl
  dayData.volume = vaultGroup.volume
  dayData.opsManager = vaultGroup.opsManager
  dayData.save()
}
