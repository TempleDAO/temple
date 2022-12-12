import EllipsisLoader from 'components/EllipsisLoader';
import { BigNumber } from 'ethers';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  toTpf?: { bptIn: BigNumber; amountOut: BigNumber };
}

export const WithdrawStable: React.FC<IProps> = ({ toTpf }) => {

  return (
    <InputArea>
      <h3>WithdrawStable</h3>
      <>
        <RequestArea>bptAmountIn: {toTpf?.bptIn.toString() ?? <EllipsisLoader />}</RequestArea>
        <RequestArea>minAmountOut: {toTpf?.amountOut.toString() ?? <EllipsisLoader />}</RequestArea>
      </>
    </InputArea>
  );
};
