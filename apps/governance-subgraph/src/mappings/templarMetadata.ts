import { UpdateTempleRole } from '../../generated/TemplarMetadata/TemplarMetadata'

import { getTemplar, updateTemplar } from '../entities/templar'


export function onUpdateTempleRole(event: UpdateTempleRole): void {
    const templar = getTemplar(event.params.discordId)
    if (templar) {
        templar.role = event.params.templeRole
        updateTemplar(templar, event.block.timestamp)
    }
}
