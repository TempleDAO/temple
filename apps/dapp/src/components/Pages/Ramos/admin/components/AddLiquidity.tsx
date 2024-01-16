import { Button } from 'components/Button/Button';
import { Input } from 'components/Pages/Core/NewUI/HomeInput';
import Tooltip, { TooltipIcon } from 'components/Tooltip/Tooltip';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { BigNumber } from 'ethers';
import { useState } from 'react';
import { DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';
import { InputArea, RequestArea, TitleWrapper } from '../styles';

interface IProps {
  handleInput?: (stableAmount: DecimalBigNumber) => Promise<{
    templeAmount: DecimalBigNumber;
    stableAmount: DecimalBigNumber;
  }>;
  calculateFunc?: (
    templeAmount: BigNumber,
    stableAmount: BigNumber
  ) => Promise<{ joinPoolRequest: string; minBptOut: string } | undefined>;
}

export const AddLiquidity: React.FC<IProps> = ({
  calculateFunc,
  handleInput,
}) => {
  const [amounts, setAmounts] = useState({
    templeAmount: DBN_ZERO,
    stableAmount: DBN_ZERO,
  });
  const [joinPoolInfo, setJoinPoolInfo] = useState<{
    joinPoolRequest: string;
    minBptOut: string;
  }>();
  return (
    <InputArea>
      <TitleWrapper>
        <h3>AddLiquidity</h3>
        <Tooltip
          content={
            <>
              <p>
                Add liquidity with both {TICKER_SYMBOL.TEMPLE_TOKEN} and stable
                tokens into balancer pool.{' '}
              </p>
              <p>
                Treasury Price Floor is expected to be within bounds of multisig
                set range.
              </p>
              <p>BPT tokens are then deposited and staked in Aura.</p>
              <p>
                {TICKER_SYMBOL.TEMPLE_TOKEN} amount is minted by RAMOS and
                calculated here to preserve spot price
              </p>
            </>
          }
        >
          <TooltipIcon />
        </Tooltip>
      </TitleWrapper>
      <Input
        crypto={{ kind: 'value', value: 'STABLE' }}
        small
        handleChange={async (e: string) => {
          if (Number(e)) {
            if (!handleInput) return;
            setAmounts(await handleInput(DecimalBigNumber.parseUnits(e, 18)));
          } else setAmounts({ templeAmount: DBN_ZERO, stableAmount: DBN_ZERO });
        }}
      />
      <Input
        disabled
        value={amounts.templeAmount.formatUnits()}
        crypto={{ kind: 'value', value: 'TEMPLE' }}
        small
      />
      <Button
        isSmall
        label="CREATE REQUEST PARAMS"
        onClick={async () => {
          if (!calculateFunc) return;
          const poolInfo = await calculateFunc(
            amounts.templeAmount.toBN(18),
            amounts.stableAmount.toBN(18)
          );
          setJoinPoolInfo(poolInfo);
        }}
      />
      {joinPoolInfo && (
        <>
          <p>
            To apply, create a RamosStrategy.addLiquidity() transaction with
            parameters
          </p>
          <RequestArea>request: {joinPoolInfo.joinPoolRequest}</RequestArea>
          <RequestArea>minBptOut: {`${joinPoolInfo.minBptOut}`}</RequestArea>
        </>
      )}
    </InputArea>
  );
};
