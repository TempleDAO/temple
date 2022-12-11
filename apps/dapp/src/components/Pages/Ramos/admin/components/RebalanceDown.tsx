import { Button } from 'components/Button/Button';
import EllipsisLoader from 'components/EllipsisLoader';
import { BigNumber } from 'ethers';
import { ZERO } from 'utils/bigNumber';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  amounts?: { amountIn: BigNumber; bptOut: BigNumber };
  onRebalanceDown: (amountIn: BigNumber, bptOut: BigNumber) => Promise<void>;
  shouldDisableButton: boolean;
}

export const RebalanceDown: React.FC<IProps> = ({ amounts, onRebalanceDown, shouldDisableButton }) => {

  return (
    <InputArea>
      <h3>RebalanceDown</h3>
      <p>To close the gap by 100%:</p>
      <>
        <RequestArea>templeAmountIn: {amounts?.amountIn.toString() ?? <EllipsisLoader />}</RequestArea>
        <RequestArea>minBptOut: {amounts?.bptOut.toString() ?? <EllipsisLoader />}</RequestArea>
      </>
      <Button
        disabled={shouldDisableButton || !amounts || (amounts?.amountIn.eq(ZERO) && amounts?.bptOut.eq(ZERO))}
        isSmall
        label="Rebalance Down"
        onClick={() => amounts && onRebalanceDown(amounts?.amountIn, amounts?.bptOut)}
      />
    </InputArea>
  );
};
