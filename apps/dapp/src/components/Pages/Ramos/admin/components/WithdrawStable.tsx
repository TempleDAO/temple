import { Button } from 'components/Button/Button';
import EllipsisLoader from 'components/EllipsisLoader';
import { Input } from 'components/Input/Input';
import Loader from 'components/Loader/Loader';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber } from 'ethers';
import { useState } from 'react';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { InputArea, RequestArea } from '../styles';
import { useRamosAdmin } from '../useRamosAdmin';

interface IProps {
  calculateFunc: (bps: DecimalBigNumber) => Promise<{ bptIn: BigNumber; amountOut: BigNumber } | undefined>;
  toTpf?: { bptIn: BigNumber; amountOut: BigNumber };
}

export const WithdrawStable: React.FC<IProps> = ({calculateFunc, toTpf}) => {
  const [withdrawStable, setWithdrawStable] = useState<{ bptIn: BigNumber; amountOut: BigNumber }>();
  const [basisPoints, setBasisPoints] = useState<DecimalBigNumber>();
  
  return (
    <InputArea>
      <h3>WithdrawStable</h3>
      <p>To bring {TICKER_SYMBOL.TEMPLE_TOKEN} price down to TPF:</p>
        <>
          <RequestArea>bptAmountIn: {toTpf?.bptIn.toString() ?? <EllipsisLoader />}</RequestArea>
          <RequestArea>minAmountOut: {toTpf?.amountOut.toString() ?? <EllipsisLoader />}</RequestArea>
        </>
      <p>To bring {TICKER_SYMBOL.TEMPLE_TOKEN} price down by:</p>
      <Input
        small
        crypto={{ kind: 'value', value: 'BPS' }}
        handleChange={(e) => {
          if(Number(e)) setBasisPoints(DecimalBigNumber.parseUnits(`${e}`, 18));
        }}
      />
      <Button
        isSmall
        label="CALCULATE"
        onClick={async () => {
          if (basisPoints) {
            const amounts = await calculateFunc(basisPoints);
            if (amounts) setWithdrawStable(amounts);
          }
        }}
      />
      {withdrawStable && (
        <>
          <RequestArea>bptAmountIn: {withdrawStable?.bptIn.toString()}</RequestArea>
          <RequestArea>minAmountOut: {withdrawStable?.amountOut.toString()}</RequestArea>
        </>
      )}
    </InputArea>
  );
};
