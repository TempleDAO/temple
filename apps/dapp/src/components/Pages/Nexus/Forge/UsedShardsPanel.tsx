import { RelicItemData } from 'providers/types';
import styled from 'styled-components';
import ItemGrid from '../Relic/ItemGrid';
import { NexusBodyContainer, NexusContainer, NexusPanel } from '../Relic/styles';

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

const PanelText = styled.h5`
  width: 100%;
  margin: 2px;
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
