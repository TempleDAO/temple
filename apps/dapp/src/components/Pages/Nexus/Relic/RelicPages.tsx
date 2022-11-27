import { Button } from 'components/Button/Button';
import { BigNumber } from 'ethers';
import { useRelic } from 'providers/RelicProvider';
import { ItemInventory, RelicData, RelicEnclave, RelicItemData, RelicRarity } from 'providers/types';
import { FC } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import BufferedItemGrid from './BufferedItemGrid';
import RelicStatsPanel, { getEnclavePalette, getRarityPalette } from './RelicStatsPanel';
import { NexusPanel, NexusPanelRow } from './styles';

export const RelicPage: FC<{ inventory: ItemInventory }> = (props) => {
  const { relics, items } = props.inventory
  const { id } = useParams();
  const relicIdx = relics.findIndex((r) => r.id.toString() == id);
  const thisRelic = relics[relicIdx]
  return <>
    <RelicPanel thisRelic={thisRelic}
      prevRelic={relics[relicIdx - 1]}
      nextRelic={relics[relicIdx + 1]}
    />
    <MyItemPanel relicId={thisRelic?.id} items={items} />
  </>
};

const RelicPanel = (props: {
  thisRelic?: RelicData,
  prevRelic?: RelicData,
  nextRelic?: RelicData,
}) => {
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
        <BufferedItemGrid items={thisRelic.items}
          actionLabel="Unequip"
          onAction={async selectedItems => unequipShards(thisRelic.id, selectedItems)}
        />
        { (prevRelic || nextRelic) &&
          <NexusPanelRow>
            <div>
              { prevRelic && <Button isSmall label="Previous Relic"
                  onClick={() => navigate(`../${prevRelic.id.toString()}`)}
                />
              }
            </div>
            <div>
              { nextRelic && <Button isSmall label="Next Relic"
                  onClick={() => navigate(`../${nextRelic.id.toString()}`)}
                />
              }
            </div>
          </NexusPanelRow>
        }
      </EnclavePanel>
    </OuterPanel>
  );
};

const EnclavePanel = styled(NexusPanel)<{ enclave: RelicEnclave }>`
  border: 0.0625rem solid ${(props) => props.theme.palette.enclave[getEnclavePalette(props.enclave)]};
`

const OuterPanel = styled.div<{ rarity: RelicRarity }>`
  border: 0.0625rem solid ${(props) => props.theme.palette.brand};
  border-radius: 20px;
  padding: 6px;
`

const MyItemPanel: FC<{
  relicId?: BigNumber;
  items: RelicItemData[];
}> = (props) => {
  const { relicId, items } = props;
  const { equipShards } = useRelic();

  return (
    <NexusPanel>
      <NexusPanelRow>
        <span>My Items</span>
      </NexusPanelRow>
      <BufferedItemGrid disabled={!relicId} items={items}
        actionLabel="Equip"
        onAction={async selectedItems => {
          if (relicId) {
            await equipShards(relicId, selectedItems)
          }
        }}
      />
    </NexusPanel>
  );
};
