import { Button } from 'components/Button/Button';
import EllipsisLoader from 'components/EllipsisLoader';
import { Input } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber } from 'ethers';
import { useState } from 'react';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { RequestArea, InputArea } from '../styles';

interface IProps {
  calculateFunc: (bps: DecimalBigNumber) => Promise<{bptIn: BigNumber, amountOut: BigNumber} | undefined>;
  toTpf?: {bptIn: BigNumber, amountOut: BigNumber}
}

export const RebalanceUp: React.FC<IProps> = ({calculateFunc, toTpf}) => {
  const [rebalanceUp, setRebalanceUp] = useState<{ bptIn: BigNumber; amountOut: BigNumber }>();
  const [basisPoints, setBasisPoints] = useState<DecimalBigNumber>();

  return (
    <InputArea>
      <h3>RebalanceUp</h3>
      <p>To bring {TICKER_SYMBOL.TEMPLE_TOKEN} price up to TPF:</p>
      <RequestArea>bptAmountIn: {toTpf?.bptIn.toString() ?? <EllipsisLoader />}</RequestArea>
      <RequestArea>minAmountOut: {toTpf?.amountOut.toString() ?? <EllipsisLoader />}</RequestArea>
      <p>To bring {TICKER_SYMBOL.TEMPLE_TOKEN} price up by</p>
      <Input
        small
        crypto={{ kind: 'value', value: 'BPS' }}
        handleChange={(e: string) => {
          if (Number(e)) {
            const dbnAmount = DecimalBigNumber.parseUnits(e, 18);
            setBasisPoints(dbnAmount);
          } else setBasisPoints(undefined);
        }}
      />
      <Button
        isSmall
        label="CALCULATE"
        onClick={async () => {
          if (basisPoints) {
            const amounts = await calculateFunc(basisPoints);
            if (amounts) setRebalanceUp(amounts);
          }
        }}
      />
      {rebalanceUp && (
        <>
          <RequestArea>bptAmountIn: {rebalanceUp?.bptIn.toString()}</RequestArea>
          <RequestArea>minAmountOut: {rebalanceUp?.amountOut.toString()}</RequestArea>
        </>
      )}
    </InputArea>
  );
};
