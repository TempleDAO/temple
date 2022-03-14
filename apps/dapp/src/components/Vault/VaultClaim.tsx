import { copyBalance } from 'components/AMM/helpers/methods';
import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import { Option } from 'components/InputSelect/InputSelect';
import { VaultButton } from 'components/Vault/VaultContent';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useState } from 'react';
import styled from 'styled-components';
import { SmallDescription } from 'styles/Typography';
import { formatNumber } from 'utils/formatter';

/* TODO: Update for real data */
const dummyOptions = [
  { value: '$TEMPLE', label: '$TEMPLE' },
  { value: '$FRAX', label: '$FRAX' },
  { value: '$ETH', label: '$ETH' },
];
const VaultClaim = () => {
  const [templeAmount, setTempleAmount] = useState<number | ''>('');
  const [templeWalletAmount, setTempleWalletAmount] = useState<number>(1234.12);
  const [ticker, setTicker] = useState(dummyOptions[0].value);

  const handleTickerUpdate = (val: Option) => {
    setTicker(val.value as string);
  };

  const handleUpdateTempleAmount = async (value: number) => {
    setTempleAmount(value === 0 ? '' : value);
  };

  return (
    <>
      <h2 className={'margin-remove'}>Claim Rewards</h2>
      <br />
      <small className={'color-brandLight'}>CLAIM REWARDS FRM THIS VAULT</small>
      <br />
      <br />
      <Input
        crypto={{
          kind: 'value',
          value: TICKER_SYMBOL.FRAX,
        }}
        value={templeAmount}
        hint={`Balance: ${formatNumber(templeWalletAmount)}`}
        handleChange={handleUpdateTempleAmount}
        onHintClick={() => copyBalance(templeWalletAmount, setTempleAmount)}
      />
      <InputDescription>Amount to claim</InputDescription>
      <br />
      <br />
      <VaultButton label={'claim'} autoWidth />
    </>
  );
};

const InputDescription = styled(SmallDescription)`
  align-self: flex-end;
`;

export default VaultClaim;
