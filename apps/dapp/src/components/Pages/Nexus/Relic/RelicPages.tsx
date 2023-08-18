import { Button } from 'components/Button/Button';
import Image from 'components/Image/Image';
import { BigNumber } from 'ethers';
import { useRelic } from 'providers/RelicProvider';
import { ItemInventory, RelicData, RelicEnclave, RelicItemData, RelicRarity } from 'providers/types';
import { FC } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import BufferedItemGrid from './BufferedItemGrid';
import RelicStatsPanel, { getEnclavePalette } from './RelicStatsPanel';
import { NexusPanelRow } from './styles';

import bagImage from 'assets/icons/bagicon.png';

export const RelicPage: FC<{ inventory: ItemInventory }> = (props) => {
  const { relics, items } = props.inventory;
  const { id } = useParams();
  const relicIdx = relics.findIndex((r) => r.id.toString() == id);
  const thisRelic = relics[relicIdx];
  return (
    <>
      <RelicPanel thisRelic={thisRelic} prevRelic={relics[relicIdx - 1]} nextRelic={relics[relicIdx + 1]} />
      <MyItemPanel relicId={thisRelic?.id} items={items} />
    </>
  );
};

const RelicPanel = (props: { thisRelic?: RelicData; prevRelic?: RelicData; nextRelic?: RelicData }) => {
  const { unequipShards } = useRelic();
  const navigate = useNavigate();
  const { thisRelic, prevRelic, nextRelic } = props;
  if (!thisRelic) {
    return <Navigate to=".." />;
  }
  return (
    <OuterPanel rarity={thisRelic.rarity}>
      <EnclavePanel enclave={thisRelic.enclave}>
        <RelicStatsPanel relic={thisRelic} />
        <br />
        <BufferedItemGrid
          items={thisRelic.items}
          actionLabel="Unequip"
          onAction={async (selectedItems) => unequipShards(thisRelic.id, selectedItems)}
        />
        {(prevRelic || nextRelic) && (
          <NexusPanelRow>
            <div>
              {prevRelic && (
                <Button playClickSound isSmall label="Previous Relic" onClick={() => navigate(`../${prevRelic.id.toString()}`)} />
              )}
            </div>
            <div>
              {nextRelic && (
                <Button playClickSound isSmall label="Next Relic" onClick={() => navigate(`../${nextRelic.id.toString()}`)} />
              )}
            </div>
          </NexusPanelRow>
        )}
      </EnclavePanel>
    </OuterPanel>
  );
};

const MyItemPanel: FC<{
  relicId?: BigNumber;
  items: RelicItemData[];
}> = (props) => {
  const { relicId, items } = props;
  const { equipShards } = useRelic();

  return (
    <RelicItemsPanel>
      <PanelHeading>
        <BagIcon src={bagImage} />
        <PanelText>My items (Click Shards to equip them into your Relic)</PanelText>
      </PanelHeading>
      <BufferedItemGrid
        disabled={!relicId}
        items={items}
        actionLabel="Equip"
        onAction={async (selectedItems) => {
          if (relicId) {
            await equipShards(relicId, selectedItems);
          }
        }}
      />
    </RelicItemsPanel>
  );
};

const RelicItemsPanel = styled.div<{ color?: string }>`
  display: flex;
  flex-direction: column;
  border: 0.0625rem solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 16px;
  padding: 1rem;
  background-color: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(15px);

  > * {
    margin-bottom: 1rem;
  }
`;

const PanelHeading = styled.div`
  display: flex;
  flex-direction: row;
`;

const BagIcon = styled(Image)`
  left: 0;
  top: 0;
  width: 40px;
`;

const PanelText = styled.div`
  font-family: Megant, serif;
  color: #bd7b4f;
  width: 100%;
  margin: 2px;
  padding: 0 5px;
  text-align: left;
  font-size: 22px;
  display: flex;
  align-content: flex-start;
`;

const EnclavePanel = styled(RelicItemsPanel)<{ enclave: RelicEnclave }>`
  border: 0.0625rem solid ${(props) => props.theme.palette.enclave[getEnclavePalette(props.enclave)]};
`;

const OuterPanel = styled.div<{ rarity: RelicRarity }>`
  border: 0.0625rem solid ${(props) => props.theme.palette.brand};
  border-radius: 20px;
  padding: 6px;
`;
