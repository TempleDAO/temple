import { WithdrawCall } from '../../generated/VaultEarlyWithdraw/VaultEarlyWithdraw'

import { createEarlyWithdraw } from '../entities/earlyWithdraw'


export function onEarlyWithdraw(call: WithdrawCall): void {
    createEarlyWithdraw(call)
}
