import { Address, ethereum } from '@graphprotocol/graph-ts'

import { Withdraw as WithdrawEvent } from '../../generated/OpsManager/Vault'
import { Withdraw } from '../../generated/schema'

import { getMetric, updateMetric } from './metric'
import { getOrCreateUser, updateUser } from './user'
import { getOrCreateToken } from './token'
import { toDecimal } from '../utils/decimals'
import { getVault, saveVault } from './vault'
import { getOrCreateVaultUserBalance, getTotalVaultsBalance, updateVaultUserBalance } from './vaultUserBalance'
import { getVaultGroup, saveVaultGroup } from './vaultGroup'
import { BIG_DECIMAL_0, BIG_DECIMAL_MIN_1, BIG_INT_1, TEMPLE_ADDRESS } from '../utils/constants'
import { getTemplePrice } from '../utils/prices'


export function createWithdraw(event: WithdrawEvent): Withdraw {
  const timestamp = event.block.timestamp
  const amount = toDecimal(event.params.amount, 18)
  const tokenPrice = getTemplePrice()

  const withdraw = new Withdraw(event.transaction.hash.toHexString())
  withdraw.timestamp = timestamp

  const token = getOrCreateToken(TEMPLE_ADDRESS, timestamp)
  withdraw.token = token.id

  const vault = getVault(event.address as Address)
  withdraw.vault = vault.id

  const user = getOrCreateUser(event.params.account, timestamp)
  withdraw.user = user.id
  user.withdrawsBalance = user.withdrawsBalance.plus(amount)

  const vub = getOrCreateVaultUserBalance(vault, user, timestamp)
  const staked = vub.staked.minus(amount)
  vub.staked = staked
  vub.amount = vub.amount.minus(amount)
  vub.value = vub.value.minus(amount.times(tokenPrice))
  vub.token = token.id

  vault.tvlUSD = vault.tvl.times(tokenPrice)
  if (staked <= BIG_DECIMAL_0) {
    const earned = staked.times(BIG_DECIMAL_MIN_1)
    vub.earned = vub.earned.plus(earned)
    vub.earnedUSD = vub.earnedUSD.plus(earned.times(tokenPrice))
    vub.staked = BIG_DECIMAL_0
    vub.amount = BIG_DECIMAL_0
    vub.value = BIG_DECIMAL_0
    updateVaultUserBalance(vub, timestamp)

    user.totalBalance = getTotalVaultsBalance(user.id)
    vault.userCount = vault.userCount.minus(BIG_INT_1)
  } else {
    updateVaultUserBalance(vub, timestamp)
    user.totalBalance = user.totalBalance.minus(amount)
  }
  updateUser(user, timestamp)
  saveVault(vault, timestamp)

  const vaultGroup = getVaultGroup(vault.name)
  vaultGroup.tvlUSD = vaultGroup.tvl.times(tokenPrice)
  vaultGroup.volume = vaultGroup.volume.plus(amount)
  vaultGroup.volumeUSD = vaultGroup.volumeUSD.plus(amount.times(tokenPrice))
  saveVaultGroup(vaultGroup, timestamp)

  const metric = getMetric()
  metric.tvl = vaultGroup.tvl
  metric.tvlUSD = vaultGroup.tvlUSD
  metric.volume = metric.volume.plus(amount)
  metric.volumeUSD = metric.volumeUSD.plus(amount.times(tokenPrice))
  updateMetric(metric, timestamp)

  withdraw.amount = amount
  withdraw.value = amount.times(tokenPrice)
  withdraw.save()

  return withdraw as Withdraw
}

export function getWithdraw(eth_transaction: ethereum.Transaction): Withdraw {
  const withdraw = Withdraw.load(eth_transaction.hash.toHexString())

  return withdraw as Withdraw
}
