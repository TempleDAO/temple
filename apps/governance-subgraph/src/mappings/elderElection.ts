import { UpdateEndorsements, UpdateNomination } from '../../generated/ElderElection/ElderElection'

import { updateEndorsements } from '../entities/endorsement';
import { updateNomination } from '../entities/nomination';


export function onUpdateEndorsements(event: UpdateEndorsements): void {
    updateEndorsements(event)
}

export function onUpdateNomination(event: UpdateNomination): void {
    updateNomination(event)
}
