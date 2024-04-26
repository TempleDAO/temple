import { Button } from 'components/Button/Button';
import { Input } from 'components/Pages/Core/NewUI/HomeInput';
import { BigNumber } from 'ethers';
import { useState } from 'react';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  calculateFunc?: (
    bptAmountIn: DecimalBigNumber
  ) => Promise<
    { bptAmountIn: BigNumber; useContractBalance: boolean } | undefined
  >;
}

export const DepositAndStakeBpt: React.FC<IProps> = ({ calculateFunc }) => {
  const [stakeParams, setStakeParams] = useState<{
    bptAmountIn: BigNumber;
    useContractBalance: boolean;
  }>();
  const [amount, setAmount] = useState<DecimalBigNumber>();

  return (
    <InputArea>
      <h3>DepositAndStakeBpt</h3>
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
        label="CREATE REQUEST PARAMS"
        onClick={async () => {
          if (amount) {
            if (!calculateFunc) return;
            const amounts = await calculateFunc(amount);
            if (amounts) setStakeParams(amounts);
          }
        }}
      />
      {stakeParams && (
        <>
          <p>
            To apply, create a RAMOS.depositAndStakeBpt() transaction with
            parameters
          </p>
          <RequestArea>
            amountIn: {stakeParams.bptAmountIn.toString()}
          </RequestArea>
          <RequestArea>
            useContractBalance: {`${stakeParams.useContractBalance}`}
          </RequestArea>
        </>
      )}
    </InputArea>
  );
};
