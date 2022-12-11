import { Button } from 'components/Button/Button';
import EllipsisLoader from 'components/EllipsisLoader';
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

  return (
    <InputArea>
      <h3>DepositAndStake</h3>
      <Input
        small
        crypto={{ kind: 'value', value: 'BPT' }}
        handleChange={async (e: string) => {
          if (Number(e)) {
            const dbnAmount = DecimalBigNumber.parseUnits(e, 18);
            const params = await calculateFunc(dbnAmount);
            if (params) {
              setStakeParams(params)
            }
          } else setStakeParams(undefined);
        }}
      />
      <Button
        isSmall
        label="APPROVE"
        onClick={async () => {}}
      />
      <Button
        isSmall
        label="DEPOSIT AND STAKE"
        onClick={async () => {}}
      />
        <>
          <RequestArea>amountIn: {stakeParams?.bptAmountIn.toString() ?? <EllipsisLoader />}</RequestArea>
          <RequestArea>useContractBalance: {stakeParams?.useContractBalance !== undefined ? `${stakeParams.useContractBalance}` : <EllipsisLoader />}</RequestArea>
        </>
    </InputArea>
  );
};
