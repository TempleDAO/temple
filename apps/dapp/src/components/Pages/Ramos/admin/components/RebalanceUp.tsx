import { Button } from 'components/Button/Button';
import EllipsisLoader from 'components/EllipsisLoader';
import { BigNumber } from 'ethers';
import { ZERO } from 'utils/bigNumber';
import { RequestArea, InputArea } from '../styles';

interface IProps {
  amounts?: { bptIn: BigNumber, amountOut: BigNumber }
  onRebalanceUp: (bptIn: BigNumber, amountOut: BigNumber) => Promise<void>;
  shouldDisableButton: boolean;
}

export const RebalanceUp: React.FC<IProps> = ({ amounts, onRebalanceUp, shouldDisableButton }) => {

  return (
    <InputArea>
      <h3>RebalanceUp</h3>
      <p>To close gap by 100%:</p>
      <RequestArea>bptAmountIn: {amounts?.bptIn.toString() ?? <EllipsisLoader />}</RequestArea>
      <RequestArea>minAmountOut: {amounts?.amountOut.toString() ?? <EllipsisLoader />}</RequestArea>
      <Button
        disabled={shouldDisableButton || !amounts || (amounts?.bptIn.eq(ZERO) && amounts?.amountOut.eq(ZERO))}
        isSmall
        label="REBALANCE UP"
        onClick={() => {
          if (amounts) {
            onRebalanceUp(amounts.bptIn, amounts.amountOut)
          }
        }}
      />
    </InputArea>
  );
};
