import EllipsisLoader from 'components/EllipsisLoader';
import { BigNumber } from 'ethers';
import { RequestArea, InputArea } from '../styles';

interface IProps {
  toTpf?: { bptIn: BigNumber; amountOut: BigNumber };
}

export const RebalanceUp: React.FC<IProps> = ({ toTpf }) => {
  return (
    <InputArea>
      <h3>RebalanceUp</h3>
      <p>To apply, create a RAMOS.rebalanceUp() transaction with parameters</p>
      <RequestArea>bptAmountIn: {toTpf?.bptIn.toString() ?? <EllipsisLoader />}</RequestArea>
      <RequestArea>minAmountOut: {toTpf?.amountOut.toString() ?? <EllipsisLoader />}</RequestArea>
    </InputArea>
  );
};
