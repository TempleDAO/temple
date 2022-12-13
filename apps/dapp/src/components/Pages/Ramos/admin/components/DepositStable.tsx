import EllipsisLoader from 'components/EllipsisLoader';
import { BigNumber } from 'ethers';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  toTpf?: { amountIn: BigNumber; bptOut: BigNumber };
}

export const DepositStable: React.FC<IProps> = ({ toTpf }) => {
  return (
    <InputArea>
      <h3>DepositStable</h3>
      <p>To apply, create a RAMOS.depositStable() transaction with parameters</p>
      <RequestArea>stableAmountIn: {toTpf?.amountIn.toString() ?? <EllipsisLoader />}</RequestArea>
      <RequestArea>minBptOut: {toTpf?.bptOut.toString() ?? <EllipsisLoader />}</RequestArea>
    </InputArea>
  );
};
