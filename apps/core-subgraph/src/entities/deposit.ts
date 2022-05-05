import { Address, BigDecimal, ethereum } from '@graphprotocol/graph-ts'

import { BIG_DECIMAL_0, BIG_INT_1, TEMPLE_LOCAL_ADDRESS } from '../utils/constants'
import { Deposit as DepositEvent, Deposit__Params } from '../../generated/OpsManager/Vault'
import { Deposit } from '../../generated/schema'

import { getMetric, updateMetric } from './metric'
import { getOrCreateUser, updateUser } from './user'
import { getOrCreateToken } from './token'
import { toDecimal } from '../utils/decimals'
import { getVault, updateVault } from './vault'
import { getOrCreateVaultUserBalance, updateVaultUserBalance } from './vaultUserBalance'
import { getVaultGroup, updateVaultGroup } from './vaultGroup'


export function createDeposit(event: DepositEvent): Deposit {
  const metric = getMetric()

  let timestamp = event.block.timestamp
  let amount = toDecimal(event.params.amount, 18)
  metric.tvl = metric.tvl.plus(amount)
  metric.volume = metric.tvl.plus(amount)

  let tokenPrice = BigDecimal.fromString('0.69')
  metric.tvlUSD = metric.tvlUSD.plus(amount.times(tokenPrice))
  metric.volumeUSD = metric.volumeUSD.plus(amount.times(tokenPrice))
  updateMetric(metric, timestamp)

  const deposit = new Deposit(event.transaction.hash.toHexString())
  deposit.timestamp = timestamp

  const vault = getVault(event.transaction.to as Address)
  deposit.vault = vault.id
  vault.tvl = vault.tvl.plus(amount)
  updateVault(vault, timestamp)

  const vaultGroup = getVaultGroup(vault.name)
  vaultGroup.tvl = vaultGroup.tvl.plus(amount)
  updateVaultGroup(vaultGroup, timestamp)

  const user = getOrCreateUser(event.params.account, timestamp)
  deposit.user = user.id
  user.depositsBalance = user.depositsBalance.plus(amount)
  user.totalBalance = user.totalBalance.plus(amount)
  updateUser(user, timestamp)

  const token = getOrCreateToken(TEMPLE_LOCAL_ADDRESS, timestamp)
  deposit.token = token.id

  let vub = getOrCreateVaultUserBalance(vault, user, timestamp)
  vub.amount = vub.amount.plus(amount)
  vub.value = vub.value.plus(amount.times(tokenPrice))
  vub.token = token.id
  updateVaultUserBalance(vub, timestamp)

  deposit.amount = amount
  deposit.value = amount.times(tokenPrice)
  deposit.save()

  let users = vault.users
  users.push(user.id)
  vault.users = users
  updateVault(vault, timestamp)

  return deposit as Deposit
}

export function getDeposit(eth_transaction: ethereum.Transaction): Deposit {
  let deposit = Deposit.load(eth_transaction.hash.toHexString())

  return deposit as Deposit
}
