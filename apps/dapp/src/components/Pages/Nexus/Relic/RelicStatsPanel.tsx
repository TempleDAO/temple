import { capitalize } from 'lodash';
import { RelicData, RelicEnclave, RelicRarity } from 'providers/types';
import { FC } from 'react';
import styled, { DefaultTheme } from 'styled-components';
import { NexusPanel } from './styles';

const RelicStatsPanel: FC<{ relic: RelicData }> = (props) => {
  const { id, rarity, enclave } = props.relic
  return <RelicStatsContainer>
    <RelicStatsRow>
      Relic #{id.toString()}
    </RelicStatsRow>
    <RelicStatsRow>
      <span>Enclave:</span>
      <EnclaveLabel enclave={enclave}/>
    </RelicStatsRow>
    <RelicStatsRow>
      <span>Rarity:</span>
      <RarityLabel rarity={rarity}/>
    </RelicStatsRow>

  </RelicStatsContainer>
}

const RelicStatsContainer = styled.div`
  width: 20em;
  > * {
    color: ${(props) => props.theme.palette.light75};
  }
`

const RelicStatsRow = styled.h4`
  display: flex;
  justify-content: center;
  margin: 0;
  gap: .25em;

  > * {
    flex-grow: 1;
    flex-basis: 8em;
  }

  > *:first-child {
    text-align: right;
  }
`

type EnclavePalette = keyof DefaultTheme['palette']['enclave']
type RarityPalette = keyof DefaultTheme['palette']['relicRarity']

export function getEnclavePalette(enclave: RelicEnclave): EnclavePalette {
  switch(enclave) {
    case RelicEnclave.Logic: return 'logic'
    case RelicEnclave.Structure: return 'structure'
    case RelicEnclave.Order: return 'order'
    case RelicEnclave.Mystery: return 'mystery'
    case RelicEnclave.Chaos: return 'chaos'
  }
}

export function getRarityPalette(rarity: RelicRarity): RarityPalette {
  switch(rarity) {
    case RelicRarity.Common: return 'common'
    case RelicRarity.Uncommon: return 'uncommon'
    case RelicRarity.Rare: return 'rare'
    case RelicRarity.Epic: return 'epic'
    case RelicRarity.Legendary: return 'legendary'
  }
}

const EnclaveLabel = styled.span<{ enclave: RelicEnclave }>`
  &:before {
    content: ${(props) => `'${capitalize(getEnclavePalette(props.enclave))}'`};
  }
  color: ${(props) => props.theme.palette.enclave[getEnclavePalette(props.enclave)]};
`;
const RarityLabel = styled.span<{ rarity: RelicRarity }>`
  &:before {
    content: ${(props) => `'${capitalize(getRarityPalette(props.rarity))}'`};
  }
  color: ${(props) => props.theme.palette.relicRarity[getRarityPalette(props.rarity)]};
`

export default RelicStatsPanel