import { useState } from 'react';
import styled from 'styled-components';

import { VaultInput } from 'components/Input/VaultInput';
import { Button } from 'components/Button/Button';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumber } from 'utils/formatter';
import { copyBalance } from 'components/AMM/helpers/methods';
import { Header } from 'styles/vault';
import useRequestState, { createMockRequest } from 'hooks/use-request-state';
import { toAtto } from 'utils/bigNumber';
import { BigNumber } from 'ethers';

const useClaimTempleRequest = (amount: BigNumber) => {
  const claimTemple = createMockRequest({
    success: true,
  }, 1000, true);
  return useRequestState(() => claimTemple(amount));
};

const VaultClaim = () => {
  const [templeAmount, setTempleAmount] = useState<number | ''>('');
  const [templeWalletAmount, setTempleWalletAmount] = useState<number>(1234.12);
  const [claimRequest, { isLoading, error }] = useClaimTempleRequest(toAtto(templeAmount || 0));

  const handleUpdateTempleAmount = async (value: number) => {
    setTempleAmount(value === 0 ? '' : value);
  };

  const buttonIsDisabled = isLoading || !templeAmount || templeAmount > templeWalletAmount;

  return (
    <>
      <Header>Claim</Header>
      <h3>
        Claimable TEMPLE{' '}
        <TempleAmountLink onClick={() => copyBalance(templeWalletAmount, setTempleAmount)}>
          {formatNumber(templeWalletAmount)}
        </TempleAmountLink>
      </h3>
      <VaultInput
        tickerSymbol={TICKER_SYMBOL.TEMPLE_TOKEN}
        handleChange={handleUpdateTempleAmount}
        isNumber
        placeholder={'0.00'}
        value={templeAmount}
      />
      <ClaimButton
        label={'claim'}
        autoWidth
        disabled={buttonIsDisabled}
        onClick={async () => {
          try {
            return claimRequest();
          } catch (error) {
            // intentionall empty
          }
        }} />
    </>
  );
};

const ClaimButton = styled(Button)`
  align-self: center;
  margin: 3rem;
`;

const TempleAmountLink = styled.a`
  display: block;
`;

export default VaultClaim;
