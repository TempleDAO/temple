import { Button } from 'components/Button/Button';
import EllipsisLoader from 'components/EllipsisLoader';
import { Input } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber } from 'ethers';
import { useState } from 'react';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { InputArea, RequestArea } from '../styles';
import { useRamosAdmin } from '../useRamosAdmin';

interface IProps {
  calculateFunc: (bps: DecimalBigNumber) => Promise<{amountIn: BigNumber, bptOut: BigNumber} | undefined>;
  toTpf?: {amountIn: BigNumber, bptOut: BigNumber}
}

export const RebalanceDown: React.FC<IProps> = ({calculateFunc, toTpf}) => {
  const [rebalanceDown, setRebalanceDown] = useState<{ amountIn: BigNumber; bptOut: BigNumber }>();
  const [basisPoints, setBasisPoints] = useState<DecimalBigNumber>();

  return (
    <InputArea>
      <h3>RebalanceDown</h3>
      <p>To bring {TICKER_SYMBOL.TEMPLE_TOKEN} price down to TPF:</p>
        <>
          <RequestArea>templeAmountIn: {toTpf?.amountIn.toString() ?? <EllipsisLoader />}</RequestArea>
          <RequestArea>minBptOut: {toTpf?.bptOut.toString() ?? <EllipsisLoader />}</RequestArea>
        </>
      <p>To bring {TICKER_SYMBOL.TEMPLE_TOKEN} price down by:</p>
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
            if (amounts) setRebalanceDown(amounts);
          }
        }}
      />
      {rebalanceDown && (
        <>
          <RequestArea>templeAmountIn: {rebalanceDown?.amountIn.toString()}</RequestArea>
          <RequestArea>minBptOut: {rebalanceDown?.bptOut.toString()}</RequestArea>
        </>
      )}
    </InputArea>
  );
};
