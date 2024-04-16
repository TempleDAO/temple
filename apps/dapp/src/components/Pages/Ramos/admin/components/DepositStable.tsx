import EllipsisLoader from 'components/EllipsisLoader';
import { BigNumber } from 'ethers';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  amounts?: { amountIn: BigNumber; bptOut: BigNumber };
}

export const DepositStable: React.FC<IProps> = ({ amounts }) => {
  return (
    <InputArea>
      <h3>DepositStable</h3>
      <p>
        To apply, create a RAMOS.depositStable() transaction with parameters
      </p>
      <RequestArea>
        stableAmountIn: {amounts?.amountIn.toString() ?? <EllipsisLoader />}
      </RequestArea>
      <RequestArea>
        minBptOut: {amounts?.bptOut.toString() ?? <EllipsisLoader />}
      </RequestArea>
    </InputArea>
  );
};
