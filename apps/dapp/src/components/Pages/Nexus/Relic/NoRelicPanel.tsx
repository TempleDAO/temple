import { Button } from 'components/Button/Button';
import { useRelic } from 'providers/RelicProvider';
import { Enclave, ItemInventory } from 'providers/types';
import { Navigate, useNavigate } from 'react-router-dom';
import { NexusPanel, NexusPanelRow } from './styles';

export const NoRelicPanel = (props: { inventory: ItemInventory }) => {
  const { relics } = props.inventory;
  if (relics.length > 0) {
    return <Navigate to={`../${relics[0].id.toString()}`} />;
  }
  const { mintRelic } = useRelic();
  const navigate = useNavigate();
  return (
    <NexusPanel>
      <NexusPanelRow>
        <span>You do not yet possess a Relic</span>
      </NexusPanelRow>

      <div/>
      <div/>

      <Button
        label="Mint Relic"
        onClick={async () => {
          const added = await mintRelic(Enclave.Structure);
          if (added) {
            navigate(`relic/${added.id.toString()}`);
          }
        }}
      />
    </NexusPanel>
  );
};
