import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import { BigNumber } from 'ethers';
import { useState } from 'react';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  calculateFunc: (
    bptAmountIn: DecimalBigNumber
  ) => Promise<{ bptAmountIn: BigNumber; useContractBalance: boolean } | undefined>;
}

export const DepositAndStake: React.FC<IProps> = ({ calculateFunc }) => {
  const [stakeParams, setStakeParams] = useState<{ bptAmountIn: BigNumber; useContractBalance: boolean }>();
  const [amount, setAmount] = useState<DecimalBigNumber>();

  return (
    <InputArea>
      <h3>DepositAndStake</h3>
      <Input
        small
        crypto={{ kind: 'value', value: 'BPT' }}
        handleChange={(e: string) => {
          if (Number(e)) {
            const dbnAmount = DecimalBigNumber.parseUnits(e, 18);
            setAmount(dbnAmount);
          }
        }}
      />
      <Button
        isSmall
        label="CALCULATE"
        onClick={async () => {
          if (amount) {
            const amounts = await calculateFunc(amount);
            if (amounts) setStakeParams(amounts);
          }
        }}
      />
      {stakeParams && (
        <>
          <RequestArea>amountIn: {stakeParams.bptAmountIn.toString()}</RequestArea>
          <RequestArea>useContractBalance: {`${stakeParams.useContractBalance}`}</RequestArea>
        </>
      )}
    </InputArea>
  );
};