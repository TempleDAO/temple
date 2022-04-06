import { ClaimInput } from 'components/Input/ClaimInput';
import { Button } from 'components/Button/Button';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useState } from 'react';
import styled from 'styled-components';
import { formatNumber } from 'utils/formatter';
import { copyBalance } from 'components/AMM/helpers/methods';
import { Header } from 'styles/vault';

const VaultClaim = () => {
  const [templeAmount, setTempleAmount] = useState<number | ''>('');
  const [templeWalletAmount, setTempleWalletAmount] = useState<number>(1234.12);

  const handleUpdateTempleAmount = async (value: number) => {
    setTempleAmount(value === 0 ? '' : value);
  };

  const handleClaimClick = async () => {
    console.log(`Claim ${templeAmount} here`);
  };

  return (
    <>
      <Header>Claim</Header>
      <ClaimableAmount>
        <a onClick={() => copyBalance(templeWalletAmount, setTempleAmount)}>
          {formatNumber(templeWalletAmount)} TEMPLE{' '}
        </a>
        Claimable
      </ClaimableAmount>
      <ClaimInput
        tickerSymbol={TICKER_SYMBOL.TEMPLE_TOKEN}
        handleChange={handleUpdateTempleAmount}
        isNumber
        placeholder={'0.00'}
        value={templeAmount}
      />
      <ClaimButton label={'claim'} autoWidth onClick={handleClaimClick} />
    </>
  );
};

const ClaimableAmount = styled.h3`
  padding: 0 0 1.5rem;
`;

const ClaimButton = styled(Button)`
  align-self: center;
  margin: 3rem;
`;

export default VaultClaim;
