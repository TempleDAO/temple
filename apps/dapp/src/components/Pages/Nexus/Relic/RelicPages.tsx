import relicImg from 'assets/images/relic.png';
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
  const { renounceRelic, unequipRelicItems } = useRelic();
  const navigate = useNavigate();
  const { thisRelic, prevRelic, nextRelic } = props;
  if (!thisRelic) {
    return <Navigate to=".." />;
  }
  return (
    <EnclavePanel enclave={thisRelic.enclave}>
      <RarityPanel rarity={thisRelic.rarity}>
        <img src={relicImg} width={200} style={{ margin: 0 }} />
        <RelicStatsPanel relic={thisRelic} />
        {/* <NexusPanelRow>
          <span>Equipped Items</span>
          <div>
            <Button isSmall
              label="Renounce Relic"
              onClick={async () => {
                const nextRelicIdx = (relicIdx + 1) % relics.length;
                const nextRelicId = relics[nextRelicIdx].id;
                await renounceRelic(relic.id);
                navigate(`../${nextRelicId.toString()}`);
              }}
            />
          </div>
        </NexusPanelRow> */}
        <BufferedItemGrid items={thisRelic.items}
          actionLabel="Unequip"
          onAction={async selectedItems => unequipRelicItems(thisRelic.id, selectedItems)}
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
      </RarityPanel>
    </EnclavePanel>
  );
};

const EnclavePanel = styled.div<{ enclave: RelicEnclave }>`
  border: 4px solid ${(props) => props.theme.palette.enclave[getEnclavePalette(props.enclave)]};
  border-radius: 20px;
`

const RarityPanel = styled(NexusPanel)<{ rarity: RelicRarity }>`
  border: 3px solid ${(props) => props.theme.palette.relicRarity[getRarityPalette(props.rarity)]};
`

const MyItemPanel: FC<{
  relicId?: BigNumber;
  items: RelicItemData[];
}> = (props) => {
  const { relicId, items } = props;
  const { equipRelicItems } = useRelic();

  return (
    <NexusPanel>
      <NexusPanelRow>
        <span>My Items</span>
      </NexusPanelRow>
      <BufferedItemGrid disabled={!relicId} items={items}
        actionLabel="Equip"
        onAction={async selectedItems => {
          if (relicId) {
            await equipRelicItems(relicId, selectedItems)
          }
        }}
      />
    </NexusPanel>
  );
};