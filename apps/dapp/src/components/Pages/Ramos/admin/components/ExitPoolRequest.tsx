import { Button } from 'components/Button/Button';
import EllipsisLoader from 'components/EllipsisLoader';
import { Input } from 'components/Input/Input';
import { BigNumber, ethers } from 'ethers';
import { useState } from 'react';
import { AMO__IBalancerVault } from 'types/typechain';
import { formatExitRequestTuple } from '../helpers';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  calculateFunc: (exitAmountBpt: BigNumber) => Promise<AMO__IBalancerVault.ExitPoolRequestStruct | undefined>;
  onRemoveLiquidity: (request: AMO__IBalancerVault.ExitPoolRequestStruct) => Promise<void>;
  shouldDisableButton: boolean;
}
export const ExitPoolRequest: React.FC<IProps> = ({ calculateFunc, onRemoveLiquidity, shouldDisableButton }) => {
  const [exitPoolRequest, setExitPoolRequest] = useState<AMO__IBalancerVault.ExitPoolRequestStruct>();

  return (
    <InputArea>
      <h3>RemoveLiquidity</h3>
      <Input
        crypto={{ kind: 'value', value: 'BPT' }}
        isNumber
        small
        handleChange={async (e) => {
          if (Number(e) && e > 0) {
            const request = await calculateFunc(ethers.utils.parseUnits(`${e}`));
            if(request) {
              setExitPoolRequest(request);
            }
          } else {
            setExitPoolRequest(undefined);
          }
        }}
      />
      <RequestArea>{exitPoolRequest ? formatExitRequestTuple(exitPoolRequest) : <EllipsisLoader />}</RequestArea>
      <Button
        disabled={shouldDisableButton || !exitPoolRequest}
        isSmall
        label="REMOVE LIQUIDITY"
        onClick={() => {
          if(exitPoolRequest) {
            onRemoveLiquidity(exitPoolRequest);
          }
        }}
      />
      
    </InputArea>
  );
};
