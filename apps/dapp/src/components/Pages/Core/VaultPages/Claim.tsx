import { useState } from 'react';
import styled from 'styled-components';
import { BigNumber } from 'ethers';

import { VaultInput } from 'components/Input/VaultInput';
import { Button } from 'components/Button/Button';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumberWithCommas } from 'utils/formatter';
import { copyBalance } from 'components/AMM/helpers/methods';
import { Header } from 'styles/vault';
import useRequestState, { createMockRequest } from 'hooks/use-request-state';
import { toAtto } from 'utils/bigNumber';
import VaultContent, {
  VaultButton,
} from 'components/Pages/Core/VaultPages/VaultContent';

const useClaimTempleRequest = (amount: BigNumber) => {
  const claimTemple = createMockRequest({ success: true }, 1000, true);
  return useRequestState(() => claimTemple(amount));
};

export const Claim = () => {
  const [templeAmount, setTempleAmount] = useState<number | ''>('');
  const [templeWalletAmount, setTempleWalletAmount] =
    useState<number>(12_345_678.12);
  const [claimRequest, { isLoading, error }] = useClaimTempleRequest(
    toAtto(templeAmount || 0)
  );

  const handleUpdateTempleAmount = async (value: number) => {
    setTempleAmount(value === 0 ? '' : value);
  };

  const buttonIsDisabled =
    isLoading || !templeAmount || templeAmount > templeWalletAmount;

  return (
    <VaultContent>
      <Header>Claim</Header>

      <ClaimableLabel>
        Claimable Temple
        <TempleAmountLink
          onClick={() => copyBalance(templeWalletAmount, setTempleAmount)}
        >
          {formatNumberWithCommas(templeWalletAmount)}
        </TempleAmountLink>
      </ClaimableLabel>
      <VaultInput
        tickerSymbol={TICKER_SYMBOL.TEMPLE_TOKEN}
        handleChange={handleUpdateTempleAmount}
        isNumber
        placeholder={'0.00'}
        value={templeAmount}
      />
      {!!error && (
        <ErrorLabel>{error.message || 'Something went wrong'}</ErrorLabel>
      )}

      <VaultButton
        label={'claim'}
        autoWidth
        marginTop={error ? '0.5rem' : '3.5rem'}
        disabled={buttonIsDisabled}
        onClick={async () => {
          try {
            return claimRequest();
          } catch (error) {
            // intentionally empty, handled in hook
          }
        }}
      />
    </VaultContent>
  );
};

const ClaimableLabel = styled.div`
  color: #9e6844;
  font-size: 1.5rem;
  margin-top: 1.25rem;
  margin-bottom: 1.25rem;
`;

const ErrorLabel = styled.span`
  color: ${({ theme }) => theme.palette.enclave.chaos};
  display: block;
  margin: 1rem 0;
`;

const TempleAmountLink = styled.a`
  display: block;
  cursor: pointer;
  font-size: 2.2rem;
  color: #d9bdab;
  padding-top: 0.625rem;
`;
