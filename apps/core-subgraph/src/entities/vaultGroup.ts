import { Address, BigInt } from '@graphprotocol/graph-ts'

import { VaultGroup, VaultGroupDayData, VaultGroupHourData } from '../../generated/schema'
import { Exposure as ExposureContract } from '../../generated/OpsManager/Exposure'

import { getMetric, updateMetric } from './metric'
import { getOpsManager, updateOpsManager } from './opsManager'
import { dayFromTimestamp, hourFromTimestamp } from '../utils/dates'
import { BIG_INT_1 } from '../utils/constants'
import { toDecimal } from '../utils/decimals'


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

  updateVaultGroup(vaultGroup as VaultGroup)

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
    saveVaultGroup(vaultGroup, timestamp)
  }
}

export function updateVaultGroup(vaultGroup: VaultGroup): void {
  const templeExposure = Address.fromString(getOpsManager().templeExposure)
  const exposure = ExposureContract.bind(templeExposure)

  const p = exposure.amountPerShare().value0.toBigDecimal()
  const q = exposure.amountPerShare().value1.toBigDecimal()
  const amountPerShare = p.div(q)

  vaultGroup.tvl = toDecimal(exposure.totalShares(), 18).times(amountPerShare)

  vaultGroup.save()
}

export function saveVaultGroup(vaultGroup: VaultGroup, timestamp: BigInt): void {
  vaultGroup.timestamp = timestamp
  vaultGroup.save()

  updateOrCreateDayData(vaultGroup, timestamp)
  updateOrCreateHourData(vaultGroup, timestamp)
}

export function updateOrCreateDayData(vaultGroup: VaultGroup, timestamp: BigInt): void {
  const dayTimestamp = dayFromTimestamp(timestamp);
  const dayDataID = dayTimestamp + vaultGroup.id;

  let dayData = VaultGroupDayData.load(dayDataID)
  if (dayData === null) {
    dayData = new VaultGroupDayData(dayDataID)
  }

  dayData.timestamp = timestamp
  dayData.vaultGroup = vaultGroup.id
  dayData.tvl = vaultGroup.tvl
  dayData.tvlUSD = vaultGroup.tvlUSD
  dayData.volume = vaultGroup.volume
  dayData.volumeUSD = vaultGroup.volumeUSD
  dayData.opsManager = vaultGroup.opsManager
  dayData.save()
}

export function updateOrCreateHourData(vaultGroup: VaultGroup, timestamp: BigInt): void {
  const hourTimestamp = hourFromTimestamp(timestamp);
  const hourDataID = hourTimestamp + vaultGroup.id;

  let hourData = VaultGroupHourData.load(hourDataID)
  if (hourData === null) {
    hourData = new VaultGroupHourData(hourDataID)
  }

  hourData.timestamp = timestamp
  hourData.vaultGroup = vaultGroup.id
  hourData.tvl = vaultGroup.tvl
  hourData.tvlUSD = vaultGroup.tvlUSD
  hourData.volume = vaultGroup.volume
  hourData.volumeUSD = vaultGroup.volumeUSD
  hourData.opsManager = vaultGroup.opsManager
  hourData.save()
}
