import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import { BigNumber, ethers } from 'ethers';
import { useState } from 'react';
import { ZERO } from 'utils/bigNumber';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  calculateFunc: (templeAmount: BigNumber, stableAmount: BigNumber) => Promise<{joinPoolRequest: string; minBptOut: string} | undefined>;
}
export const JoinPoolRequest: React.FC<IProps> = ({calculateFunc}) => {

  const [amounts, setAmounts] = useState({ temple: ZERO, stable: ZERO });
  const [joinPoolInfo, setJoinPoolInfo] = useState<{joinPoolRequest: string; minBptOut: string}>();

  return (
    <InputArea>
      <h3>JoinPoolRequest</h3>
      <Input
        crypto={{ kind: 'value', value: 'TEMPLE' }}
        value={ethers.utils.formatUnits(amounts.temple)}
        isNumber
        small
        handleChange={(e: string) => {
          setAmounts({ ...amounts, temple: ethers.utils.parseUnits(e) });
        }}
      />
      <Input
        crypto={{ kind: 'value', value: 'STABLE' }}
        value={ethers.utils.formatUnits(amounts.stable)}
        isNumber
        small
        handleChange={(e: string) => {
          setAmounts({ ...amounts, stable: ethers.utils.parseUnits(e) });
        }}
      />
      <Button
        isSmall
        label="CREATE REQUEST PARAMS"
        onClick={async () => {
          const poolInfo = await calculateFunc(amounts.temple, amounts.stable)
          setJoinPoolInfo(poolInfo);
        }}
      />
      {joinPoolInfo && (
        <>
          <RequestArea>{joinPoolInfo.joinPoolRequest}</RequestArea>

          <RequestArea>{`${joinPoolInfo.minBptOut}`}</RequestArea>
        </>
      )}
    </InputArea>
  );
};
