import EllipsisLoader from 'components/EllipsisLoader';
import { BigNumber } from 'ethers';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  toTpf?: { amountIn: BigNumber; bptOut: BigNumber };
}

export const RebalanceDown: React.FC<IProps> = ({ toTpf }) => {
  return (
    <InputArea>
      <h3>RebalanceDown</h3>
      <p>To apply, create a RAMOS.rebalanceDown() transaction with parameters</p>
      <RequestArea>templeAmountIn: {toTpf?.amountIn.toString() ?? <EllipsisLoader />}</RequestArea>
      <RequestArea>minBptOut: {toTpf?.bptOut.toString() ?? <EllipsisLoader />}</RequestArea>
    </InputArea>
  );
};
