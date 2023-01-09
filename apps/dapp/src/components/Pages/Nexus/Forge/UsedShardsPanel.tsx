import bgActive from 'assets/images/nexus-room-active.jpg';
import bgInactive from 'assets/images/nexus-room-inactive.jpg';
import { useRelic } from 'providers/RelicProvider';
import { RelicItemData } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { PageWrapper } from '../../Core/utils';
import ItemGrid from '../Relic/ItemGrid';
import { NexusBackground, NexusBodyContainer, NexusContainer, NexusPanel } from '../Relic/styles';

const UsedShardsPanel = (props: { items: RelicItemData[]; usedShardsClickHandler: (item: number) => void }) => {
  return (
    <NexusContainer>
      <NexusBodyContainer>
        <NexusPanel>
          <PanelText>Used Shards</PanelText>
          <ItemGrid items={props.items} onClick={async (item) => props.usedShardsClickHandler(item)} />
        </NexusPanel>
      </NexusBodyContainer>
    </NexusContainer>
  );
};

export const PanelText = styled.h5`
  width: 100%;
  margin: 0.5rem;
  padding: 0 5px;
  text-align: left;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  * > {
    &:first-child {
      flex: 1;
    }
  }
`;

export default UsedShardsPanel;
