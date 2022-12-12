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
      <>
        <RequestArea>templeAmountIn: {toTpf?.amountIn.toString() ?? <EllipsisLoader />}</RequestArea>
        <RequestArea>minBptOut: {toTpf?.bptOut.toString() ?? <EllipsisLoader />}</RequestArea>
      </>
    </InputArea>
  );
};
