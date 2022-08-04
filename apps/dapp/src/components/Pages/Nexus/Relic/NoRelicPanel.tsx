import { ItemInventory } from 'providers/types';
import { Navigate } from 'react-router-dom';
import MintRelicPanel from './MintRelicPanel';

export const NoRelicPanel = (props: { inventory: ItemInventory }) => {
  const { relics } = props.inventory;
  if (relics.length > 0) {
    return <Navigate to={`../${relics[0].id.toString()}`} />;
  }

  return <>
    <h3>You do not yet possess a Relic</h3>
    <MintRelicPanel />
  </>
};
