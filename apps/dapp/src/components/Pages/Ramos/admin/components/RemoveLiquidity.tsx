import { Button } from 'components/Button/Button';
import { Input } from 'components/Pages/Core/NewUI/HomeInput';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber, ethers } from 'ethers';
import { useState } from 'react';
import { ZERO } from 'utils/bigNumber';
import { InputArea, RequestArea, TitleWrapper } from '../styles';

interface IProps {
  calculateFunc?: (exitAmountBpt: BigNumber) => Promise<string | undefined>;
}
export const RemoveLiquidity: React.FC<IProps> = ({ calculateFunc }) => {
  const [exitAmountBpt, setExitAmountBpt] = useState(ZERO);
  const [exitPoolRequest, setExitPoolRequest] = useState<string>();

  return (
    <InputArea>
      <TitleWrapper>
        <h3>RemoveLiquidity</h3>
        <Tooltip
          content={
            <>
              <p>
                Remove liquidity from balancer pool receiving both{' '}
                {TICKER_SYMBOL.TEMPLE_TOKEN} and stable tokens from balancer
                pool.{' '}
              </p>
              <p>
                Treasury Price Floor is expected to be within bounds of multisig
                set range.
              </p>
              <p>
                Withdraw and unwrap BPT tokens from Aura staking and send to
                balancer pool to receive both tokens.
              </p>
            </>
          }
        >
          <TooltipIcon />
        </Tooltip>
      </TitleWrapper>

      <Input
        crypto={{ kind: 'value', value: 'BPT' }}
        isNumber
        small
        handleChange={(e) => {
          if (Number(e)) setExitAmountBpt(ethers.utils.parseUnits(`${e}`));
        }}
      />
      <Button
        isSmall
        label="CREATE REQUEST PARAMS"
        onClick={async () => {
          if (!calculateFunc) return;
          const request = await calculateFunc(exitAmountBpt);
          setExitPoolRequest(request);
        }}
      />
      {exitPoolRequest && (
        <>
          <p>
            To apply, create a RamosStrategy.removeLiquidity() transaction with
            parameters
          </p>
          <RequestArea>request: {exitPoolRequest}</RequestArea>
          <RequestArea>bptAmount: {`${exitAmountBpt}`}</RequestArea>
        </>
      )}
    </InputArea>
  );
};
