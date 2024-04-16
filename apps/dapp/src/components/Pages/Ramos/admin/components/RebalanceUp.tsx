import EllipsisLoader from 'components/EllipsisLoader';
import { BigNumber } from 'ethers';
import { RequestArea, InputArea } from '../styles';

interface IProps {
  amounts?: { bptIn: BigNumber; amountOut: BigNumber };
}

export const RebalanceUp: React.FC<IProps> = ({ amounts }) => {
  return (
    <InputArea>
      <h3>RebalanceUp</h3>
      <p>To apply, create a RAMOS.rebalanceUp() transaction with parameters</p>
      <RequestArea>
        bptAmountIn: {amounts?.bptIn.toString() ?? <EllipsisLoader />}
      </RequestArea>
      <RequestArea>
        minAmountOut: {amounts?.amountOut.toString() ?? <EllipsisLoader />}
      </RequestArea>
    </InputArea>
  );
};
