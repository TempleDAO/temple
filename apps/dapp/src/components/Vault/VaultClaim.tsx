import { useState } from 'react';
import styled from 'styled-components';
import { BigNumber } from 'ethers';

import { VaultInput } from 'components/Input/VaultInput';
import { Button } from 'components/Button/Button';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumber } from 'utils/formatter';
import { copyBalance } from 'components/AMM/helpers/methods';
import { Header } from 'styles/vault';
import useRequestState, { createMockRequest } from 'hooks/use-request-state';
import { toAtto } from 'utils/bigNumber';

const useClaimTempleRequest = (amount: BigNumber) => {
  const claimTemple = createMockRequest({ success: true, }, 1000, true);
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
      <div>
        <ClaimableLabel>
          Claimable $TEMPLE{' '}
          <TempleAmountLink onClick={() => copyBalance(templeWalletAmount, setTempleAmount)}>
            {formatNumber(templeWalletAmount)}
          </TempleAmountLink>
        </ClaimableLabel>
        <VaultInput
          tickerSymbol={TICKER_SYMBOL.TEMPLE_TOKEN}
          handleChange={handleUpdateTempleAmount}
          isNumber
          placeholder={'0.00'}
          value={templeAmount}
        />
        {!!error && <ErrorLabel>{error.message || 'Something went wrong'}</ErrorLabel>}
      </div>
      <ClaimButton
        label={'claim'}
        autoWidth
        disabled={buttonIsDisabled}
        onClick={async () => {
          try {
            return claimRequest();
          } catch (error) {
             // intentionally empty, handled in hook
          }
        }}
      />
    </>
  );
};

const ClaimableLabel = styled.h4`
  display: block;
  line-height: 1.3;
`;

const ClaimButton = styled(Button)`
  align-self: center;
  margin: auto auto 3rem;
`;

const ErrorLabel = styled.span`
  color: ${({ theme }) => theme.palette.enclave.chaos};
  display: block;
  margin: 1rem 0;
`;

const TempleAmountLink = styled.a`
  display: block;
`;

export default VaultClaim;
