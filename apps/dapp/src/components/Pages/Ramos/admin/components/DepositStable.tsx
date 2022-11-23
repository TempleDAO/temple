import { Button } from 'components/Button/Button';
import EllipsisLoader from 'components/EllipsisLoader';
import { Input } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber } from 'ethers';
import { useState } from 'react';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  calculateFunc: (bps: DecimalBigNumber) => Promise<{ amountIn: BigNumber; bptOut: BigNumber } | undefined>;
  toTpf?: { amountIn: BigNumber; bptOut: BigNumber };
}

export const DepositStable: React.FC<IProps> = ({ calculateFunc, toTpf }) => {
  const [depositStable, setDepositStable] = useState<{ amountIn: BigNumber; bptOut: BigNumber }>();
  const [basisPoints, setBasisPoints] = useState<DecimalBigNumber>();

  return (
    <InputArea>
      <h3>DepositStable</h3>
      <p>To bring {TICKER_SYMBOL.TEMPLE_TOKEN} price up to TPF:</p>
      <>
        <RequestArea>stableAmountIn: {toTpf?.amountIn.toString() ?? <EllipsisLoader />}</RequestArea>
        <RequestArea>minBptOut: {toTpf?.bptOut.toString() ?? <EllipsisLoader />}</RequestArea>
      </>
      <p>To bring {TICKER_SYMBOL.TEMPLE_TOKEN} price up by:</p>
      <Input
        small
        crypto={{ kind: 'value', value: 'BPS' }}
        handleChange={(e: string) => {
          const dbnAmount = DecimalBigNumber.parseUnits(e, 18);
          setBasisPoints(dbnAmount);
        }}
      />
      <Button
        isSmall
        label="CALCULATE"
        onClick={async () => {
          if (basisPoints) {
            const amounts = await calculateFunc(basisPoints);
            if (amounts) setDepositStable(amounts);
          }
        }}
      />
      {depositStable && (
        <>
          <RequestArea>amountIn: {depositStable.amountIn.toString()}</RequestArea>
          <RequestArea>minBptOut: {depositStable.bptOut.toString()}</RequestArea>
        </>
      )}
    </InputArea>
  );
};
