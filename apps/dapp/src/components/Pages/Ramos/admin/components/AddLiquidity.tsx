import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber } from 'ethers';
import { useState } from 'react';
import { PoolHelper } from 'types/typechain';
import { DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  handleInput: (
    stableAmount: DecimalBigNumber
  ) => Promise<{ templeAmount: DecimalBigNumber; stableAmount: DecimalBigNumber }>;
  calculateFunc: (
    templeAmount: BigNumber,
    stableAmount: BigNumber
  ) => Promise<{ joinPoolRequest: string; minBptOut: string } | undefined>;
}

export const AddLiquidity: React.FC<IProps> = ({ calculateFunc, handleInput }) => {
  const [amounts, setAmounts] = useState({ templeAmount: DBN_ZERO, stableAmount: DBN_ZERO });
  const [joinPoolInfo, setJoinPoolInfo] = useState<{ joinPoolRequest: string; minBptOut: string }>();
  return (
    <InputArea>
      <h3>AddLiquidity</h3>
      <Input
        crypto={{ kind: 'value', value: 'STABLE' }}
        small
        handleChange={async (e: string) => {
          if (Number(e)) {
            setAmounts(await handleInput(DecimalBigNumber.parseUnits(e, 18)));
          } else setAmounts({ templeAmount: DBN_ZERO, stableAmount: DBN_ZERO });
        }}
      />
      <Input disabled value={amounts.templeAmount.formatUnits()} crypto={{ kind: 'value', value: 'TEMPLE' }} small />
      <Button
        isSmall
        label="CREATE REQUEST PARAMS"
        onClick={async () => {
          const poolInfo = await calculateFunc(amounts.templeAmount.toBN(18), amounts.stableAmount.toBN(18));
          setJoinPoolInfo(poolInfo);
        }}
      />
      {joinPoolInfo && (
        <>
          <p>To apply, create a RAMOS.addLiquidity() transaction with parameters</p>
          <RequestArea>request: {joinPoolInfo.joinPoolRequest}</RequestArea>
          <RequestArea>minBptOut: {`${joinPoolInfo.minBptOut}`}</RequestArea>
        </>
      )}
    </InputArea>
  );
};
