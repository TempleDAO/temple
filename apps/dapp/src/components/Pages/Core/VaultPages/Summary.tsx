import { SyntheticEvent } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

import Tooltip from 'components/Tooltip/Tooltip';

import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumberWithCommas } from 'utils/formatter';
import VaultContent from './VaultContent';
import useVaultContext from './use-vault-context';

export const Summary = () => {
  const navigate = useNavigate();
  const { vaultGroup } = useVaultContext();

  const onClickLink = (e: SyntheticEvent) => {
    e.preventDefault();
    navigate(`/core/dapp/vaults/${vaultGroup.id}/strategy`);
  };

  return (
    <VaultContent>
      <Title>{vaultGroup.months} MONTH</Title>
      <Text2
        light
        as="a"
        href={`/core/dapp/vaults/${vaultGroup.id}/strategy`}
        onClick={onClickLink}
      >
        {vaultGroup.months > 1
          ? 'MONTHLY CVX REINVESTMENT STRATEGY'
          : 'NO LOCK, MONTHLY YIELD'}
      </Text2>

      <Text3>
        {`TVL: $${formatNumberWithCommas(vaultGroup.tvl)} `}
        <Tooltip
          content="Total volume locked for all instances of this maturity"
          inline={true}
        >
          ⓘ
        </Tooltip>
      </Text3>

      <Text3>
        {`APY: 1 ${TICKER_SYMBOL.TEMPLE_TOKEN} x $120 / yr `}
        <Tooltip
          content={`Annual Percentage Yield in $, if you were to lock a single ${TICKER_SYMBOL.TEMPLE_TOKEN} token right now.`}
          inline={true}
        >
          ⓘ
        </Tooltip>
      </Text3>
    </VaultContent>
  );
};

const Title = styled.h2`
  margin: 6rem 0 0.2rem;
  font-size: 3rem;
  line-height: 3.5rem;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
  font-weight: 300;
  display: block;
`;

const COLOR_PERCENTAGE_TEXT_SHADOW = '0px 0px 4px rgba(222, 92, 6, 0.5)';

const Text1 = styled.div`
  ${({ theme }) => theme.typography.fonts.fontHeading}
  color: ${({ theme }) => theme.palette.brand};
  font-size: 2rem;
  margin: 0 0 1.5rem;
`;

const Text2 = styled.p<{ light?: boolean }>`
  width: 100%;
  font-weight: 400;
  margin-top: 3rem;
  font-size: 1.5rem;
  text-align: center;
  letter-spacing: 0.05em;
  color: ${({ theme, light }) =>
    light ? theme.palette.brandLight : theme.palette.brand};
  text-shadow: ${COLOR_PERCENTAGE_TEXT_SHADOW};
`;

const Text3 = styled.div<{ light?: boolean }>`
  width: 100%;
  font-weight: 400;
  margin-top: 1.5rem;

  font-size: 1.5rem;
  text-shadow: ${COLOR_PERCENTAGE_TEXT_SHADOW};
  color: ${({ theme, light }) =>
    light ? theme.palette.brandLight : theme.palette.brand};
`;
