import { Button } from 'components/Button/Button';
import EllipsisLoader from 'components/EllipsisLoader';
import { BigNumber } from 'ethers';
import { ZERO } from 'utils/bigNumber';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  amounts?: { amountIn: BigNumber; bptOut: BigNumber };
  onDepositStable: (amountIn: BigNumber, bptOut: BigNumber) => Promise<void>;
  shouldDisableButton: boolean;
}

export const DepositStable: React.FC<IProps> = ({ amounts, onDepositStable, shouldDisableButton }) => {

  return (
    <InputArea>
      <h3>DepositStable</h3>
      <p>To close the gap by 100%:</p>
      <>
        <RequestArea>stableAmountIn: {amounts?.amountIn.toString() ?? <EllipsisLoader />}</RequestArea>
        <RequestArea>minBptOut: {amounts?.bptOut.toString() ?? <EllipsisLoader />}</RequestArea>
      </>
      <Button
        isSmall
        disabled ={amounts?.amountIn.eq(ZERO) || shouldDisableButton}
        label="DEPOSIT STABLE"
        onClick={() => amounts && onDepositStable(amounts.amountIn, amounts.bptOut)}
      />
    </InputArea>
  );
};
