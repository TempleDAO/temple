import { Address, BigInt } from '@graphprotocol/graph-ts'

import { Vault, VaultHourData } from '../../generated/schema'
import { Vault as VaultTemplate } from '../../generated/templates'
import { CreateVaultInstance } from '../../generated/OpsManager/OpsManager'
import { Vault as VaultContract } from '../../generated/OpsManager/Vault'

import { BIG_INT_1, BIG_DECIMAL_0 } from '../utils/constants'
import { getMetric, updateMetric } from './metric'
import { getOrCreateVaultGroup } from './vaultGroup'
import { toDecimal } from '../utils/decimals'
import { hourFromTimestamp } from '../utils/dates'


export function createVault(event: CreateVaultInstance): void {
  const metric = getMetric()
  const vaultAddress = event.params.vault.toHexString()

  metric.vaultCount = metric.vaultCount.plus(BIG_INT_1)
  const vaults = metric.vaults
  vaults.push(vaultAddress)
  metric.vaults = vaults
  updateMetric(metric, event.block.timestamp)

  const vault = new Vault(vaultAddress)
  vault.timestamp = event.block.timestamp

  const vaultContract = VaultContract.bind(event.params.vault)
  const name = vaultContract.name()
  const symbol = vaultContract.symbol()
  const templeToken = vaultContract.templeToken().toHexString()
  const periodDuration = vaultContract.periodDuration()
  const enterExitWindowDuration = vaultContract.enterExitWindowDuration()

  const ap = vaultContract.amountPerShare().value0.toBigDecimal()
  const aq = vaultContract.amountPerShare().value1.toBigDecimal()
  const amountPerShare = ap.div(aq)

  const sp = vaultContract.shareBoostFactor().value0.toBigDecimal()
  const sq = vaultContract.shareBoostFactor().value1.toBigDecimal()
  const shareBoostFactor = sp.div(sq)

  const joiningFee = vaultContract.joiningFee().toHexString()
  const firstPeriodStartTimestamp = vaultContract.firstPeriodStartTimestamp()

  vault.name = name
  vault.symbol = symbol
  vault.templeToken = templeToken
  vault.periodDuration = periodDuration
  vault.enterExitWindowDuration = enterExitWindowDuration
  vault.amountPerShare = amountPerShare
  vault.shareBoostFactor = shareBoostFactor
  vault.joiningFee = joiningFee
  vault.firstPeriodStartTimestamp = firstPeriodStartTimestamp
  vault.users = []
  vault.tvl = BIG_DECIMAL_0

  const vaultGroup = getOrCreateVaultGroup(name, event.block.timestamp)
  vault.vaultGroup = vaultGroup.id
  vault.save()

  VaultTemplate.create(event.params.vault)
}

export function getVault(address: Address): Vault {
  const vault = Vault.load(address.toHexString())

  updateVault(vault as Vault)

  return vault as Vault
}

export function updateVault(vault: Vault): void {
  const vaultContract = VaultContract.bind(Address.fromString(vault.id))

  const ap = vaultContract.amountPerShare().value0.toBigDecimal()
  const aq = vaultContract.amountPerShare().value1.toBigDecimal()
  const amountPerShare = ap.div(aq)
  vault.amountPerShare = amountPerShare

  const sp = vaultContract.shareBoostFactor().value0.toBigDecimal()
  const sq = vaultContract.shareBoostFactor().value1.toBigDecimal()
  const shareBoostFactor = sp.div(sq)
  vault.shareBoostFactor = shareBoostFactor

  const totalShares = toDecimal(vaultContract.totalShares(), 18)
  vault.tvl = totalShares.times(shareBoostFactor).times(amountPerShare)

  vault.save()
}

export function saveVault(vault: Vault, timestamp: BigInt): void {
  vault.timestamp = timestamp
  vault.save()

  updateOrCreateHourData(vault, timestamp)
}

export function updateOrCreateHourData(vault: Vault, timestamp: BigInt): void {
  const hourTimestamp = hourFromTimestamp(timestamp);
  const hourDataID = hourTimestamp + vault.id;

  let hourData = VaultHourData.load(hourDataID)
  if (hourData === null) {
    hourData = new VaultHourData(hourDataID)
  }

  hourData.timestamp = timestamp
  hourData.tvl = vault.tvl
  hourData.tvlUSD = vault.tvlUSD
  hourData.userCount = vault.userCount
  hourData.vault = vault.id

  hourData.save()
}
