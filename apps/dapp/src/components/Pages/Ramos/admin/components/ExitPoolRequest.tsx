import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import { BigNumber, ethers } from 'ethers';
import { useState } from 'react';
import { ZERO } from 'utils/bigNumber';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  calculateFunc: (exitAmountBpt: BigNumber) => Promise<string | undefined>;
}
export const ExitPoolRequest: React.FC<IProps> = ({ calculateFunc }) => {
  const [exitAmountBpt, setExitAmountBpt] = useState(ZERO);
  const [exitPoolRequest, setExitPoolRequest] = useState<string>();

  return (
    <InputArea>
      <h3>ExitPoolRequest</h3>
      <Input
        crypto={{ kind: 'value', value: 'BPT' }}
        isNumber
        small
        handleChange={(e) => setExitAmountBpt(ethers.utils.parseUnits(`${e}`))}
      />
      <Button
        isSmall
        label="CREATE REQUEST PARAMS"
        onClick={async () => {
          const request = await calculateFunc(exitAmountBpt);
          setExitPoolRequest(request);
        }}
      />
      {exitPoolRequest && <RequestArea>{exitPoolRequest}</RequestArea>}
    </InputArea>
  );
};
