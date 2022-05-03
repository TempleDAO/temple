import { Address, BigInt } from '@graphprotocol/graph-ts'

import { Vault, VaultHourData } from '../../generated/schema'
import { Vault as VaultTemplate } from '../../generated/templates'
import { CreateVault } from '../../generated/OpsManager/OpsManager'
import { Vault as VaultContract } from '../../generated/OpsManager/Vault'

import { BIG_INT_1, BIG_DECIMAL_0 } from '../utils/constants'
import { hourFromTimestamp } from '../utils/dates'
import { getMetric, updateMetric } from './metric'
import { getOrCreateVaultGroup } from './vaultGroup'


export function createVault(event: CreateVault): void {
  const metric = getMetric()
  metric.vaultCount = metric.vaultCount.plus(BIG_INT_1)
  updateMetric(metric, event.block.timestamp)

  const vault = new Vault(event.params.vault.toHexString())
  vault.timestamp = event.block.timestamp

  const vaultContract = VaultContract.bind(event.params.vault)
  let name = vaultContract.name()
  let symbol = vaultContract.symbol()
  let templeToken = vaultContract.templeToken().toHexString()
  let periodDuration = vaultContract.periodDuration()
  let enterExitWindowDuration = vaultContract.enterExitWindowDuration()

  let p = vaultContract.shareBoostFactor().value0.toBigDecimal()
  let q = vaultContract.shareBoostFactor().value1.toBigDecimal()
  let shareBoostFactor = p.div(q)

  let joiningFee = vaultContract.joiningFee().toHexString()
  let firstPeriodStartTimestamp = vaultContract.firstPeriodStartTimestamp()

  vault.name = name
  vault.symbol = symbol
  vault.templeToken = templeToken
  vault.periodDuration = periodDuration
  vault.enterExitWindowDuration = enterExitWindowDuration
  vault.shareBoostFactor = shareBoostFactor
  vault.joiningFee = joiningFee
  vault.firstPeriodStartTimestamp = firstPeriodStartTimestamp
  vault.users = []
  vault.tvl = BIG_DECIMAL_0

  const vaultGroup = getOrCreateVaultGroup(name, event.block.timestamp)
  vault.vaultGroup = vaultGroup.id
  vault.save()

  updateOrCreateHourData(vault, event.block.timestamp)

  VaultTemplate.create(event.params.vault)
}

export function getVault(address: Address): Vault {
  let vault = Vault.load(address.toHexString())

  return vault as Vault
}

export function updateVault(vault: Vault, timestamp: BigInt): void {
  vault.timestamp = timestamp
  vault.save()

  updateOrCreateHourData(vault, timestamp)
}

export function updateOrCreateHourData(vault: Vault, timestamp: BigInt): void {
  let hourTimestamp = hourFromTimestamp(timestamp);

  let hourData = VaultHourData.load(hourTimestamp)
  if (hourData === null) {
    hourData = new VaultHourData(hourTimestamp)
  }

  hourData.vault = vault.id
  hourData.timestamp = timestamp
  hourData.name = vault.name
  hourData.symbol = vault.symbol
  hourData.templeToken = vault.templeToken
  hourData.periodDuration = vault.periodDuration
  hourData.enterExitWindowDuration = vault.enterExitWindowDuration
  hourData.shareBoostFactor = vault.shareBoostFactor
  hourData.joiningFee = vault.joiningFee
  hourData.firstPeriodStartTimestamp = vault.firstPeriodStartTimestamp
  hourData.users = vault.users
  hourData.tvl = vault.tvl
  hourData.vaultGroup = vault.vaultGroup
  hourData.save()
}
