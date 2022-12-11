import { Button } from 'components/Button/Button';
import EllipsisLoader from 'components/EllipsisLoader';
import { BigNumber } from 'ethers';
import { ZERO } from 'utils/bigNumber';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  amounts?: { bptIn: BigNumber; amountOut: BigNumber };
  onWithdrawStable: (bptIn: BigNumber, amountOut: BigNumber) => Promise<void>;
  shouldDisableButton: boolean;
}

export const WithdrawStable: React.FC<IProps> = ({ amounts, onWithdrawStable, shouldDisableButton }) => {

  return (
    <InputArea>
      <h3>WithdrawStable</h3>
      <p>To close the gap by 100%:</p>
      <>
        <RequestArea>bptAmountIn: {amounts?.bptIn.toString() ?? <EllipsisLoader />}</RequestArea>
        <RequestArea>minAmountOut: {amounts?.amountOut.toString() ?? <EllipsisLoader />}</RequestArea>
      </>
      <Button
        disabled={shouldDisableButton || !amounts || (amounts?.amountOut.eq(ZERO) && amounts?.bptIn.eq(ZERO))}
        isSmall
        label="WITHDRAW STABLE"
        onClick={() => {
          if (amounts) {
            onWithdrawStable(amounts.bptIn, amounts.amountOut)
          }
        }}
      />
    </InputArea>
  );
};
