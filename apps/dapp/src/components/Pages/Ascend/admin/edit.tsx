import { useParams } from 'react-router-dom';
import { LBPForm } from '../components/LBPForm';

export const EditLBPPage = () => {
  // TODO: Load auction? pool? identifier from path and then load details from the subgraph
  const { auctionId } = useParams();
  console.log(auctionId);

  return (
    <LBPForm />
  );
};
