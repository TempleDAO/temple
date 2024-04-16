import EllipsisLoader from 'components/EllipsisLoader';
import { BigNumber } from 'ethers';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  amounts?: { amountIn: BigNumber; bptOut: BigNumber };
}

export const RebalanceDown: React.FC<IProps> = ({ amounts }) => {
  return (
    <InputArea>
      <h3>RebalanceDown</h3>
      <p>
        To apply, create a RAMOS.rebalanceDown() transaction with parameters
      </p>
      <RequestArea>
        templeAmountIn: {amounts?.amountIn.toString() ?? <EllipsisLoader />}
      </RequestArea>
      <RequestArea>
        minBptOut: {amounts?.bptOut.toString() ?? <EllipsisLoader />}
      </RequestArea>
    </InputArea>
  );
};
