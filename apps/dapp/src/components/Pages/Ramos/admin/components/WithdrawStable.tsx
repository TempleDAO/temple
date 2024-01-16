import EllipsisLoader from 'components/EllipsisLoader';
import { BigNumber } from 'ethers';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  amounts?: { bptIn: BigNumber; amountOut: BigNumber };
}

export const WithdrawStable: React.FC<IProps> = ({ amounts }) => {
  return (
    <InputArea>
      <h3>WithdrawStable</h3>
      <p>
        To apply, create a RAMOS.withdrawStable() transaction with parameters
      </p>
      <RequestArea>
        bptAmountIn: {amounts?.bptIn.toString() ?? <EllipsisLoader />}
      </RequestArea>
      <RequestArea>
        minAmountOut: {amounts?.amountOut.toString() ?? <EllipsisLoader />}
      </RequestArea>
    </InputArea>
  );
};
