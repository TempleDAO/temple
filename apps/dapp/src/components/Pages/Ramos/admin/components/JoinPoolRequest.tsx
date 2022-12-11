import { Button } from 'components/Button/Button';
import EllipsisLoader from 'components/EllipsisLoader';
import { Input } from 'components/Input/Input';
import { BigNumber, ethers } from 'ethers';
import { useState } from 'react';
import { AMO__IBalancerVault } from 'types/typechain';
import { ZERO } from 'utils/bigNumber';
import { formatJoinRequestTuple } from '../helpers';
import { InputArea, RequestArea } from '../styles';

interface IProps {
  calculateFunc: (templeAmount: BigNumber, stableAmount: BigNumber) => Promise<{ joinPoolRequest: AMO__IBalancerVault.JoinPoolRequestStruct; minBptOut: BigNumber } | undefined>;
  onAddLiquidity: (joinPoolRequest: AMO__IBalancerVault.JoinPoolRequestStruct, minBptOut: BigNumber) => Promise<void>;
  shouldDisableButton: boolean;
}
export const JoinPoolRequest: React.FC<IProps> = ({ calculateFunc, onAddLiquidity, shouldDisableButton }) => {

  const [amounts, setAmounts] = useState({ temple: ZERO, stable: ZERO });
  const [request, setRequest] = useState<{ joinPoolRequest: AMO__IBalancerVault.JoinPoolRequestStruct; minBptOut: BigNumber }>();

  return (
    <InputArea>
      <h3>AddLiquidity</h3>
      <Input
        crypto={{ kind: 'value', value: 'TEMPLE' }}
        small
        handleChange={async (e: string) => {
          if (Number(e) || e === '0') {
            const req = await calculateFunc(ethers.utils.parseUnits(e), amounts.stable);
            setAmounts({ ...amounts, temple: ethers.utils.parseUnits(e) });
            if (req) setRequest(req);
          };
        }}
      />
      <Input
        crypto={{ kind: 'value', value: 'STABLE' }}
        small
        handleChange={async (e: string) => {
          if (Number(e) || e === '0') {
            const req = await calculateFunc(amounts.temple, ethers.utils.parseUnits(e));
            setAmounts({ ...amounts, stable: ethers.utils.parseUnits(e) });
            if (req) setRequest(req)
          };
        }}
      />
      <RequestArea>joinPoolRequest: {request ? formatJoinRequestTuple(request.joinPoolRequest) : <EllipsisLoader />}</RequestArea>
      <RequestArea>minBptOut: {request ? request.minBptOut.toString() : <EllipsisLoader />}</RequestArea>
      <Button
        disabled={shouldDisableButton || !request}
        isSmall
        label="ADD LIQUIDITY"
        onClick={() => {
          if (request) onAddLiquidity(request.joinPoolRequest, request.minBptOut);
        }}
      />
    </InputArea>
  );
};
