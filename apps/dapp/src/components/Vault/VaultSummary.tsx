import React, { SyntheticEvent } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

import Tooltip from 'components/Tooltip/Tooltip';

import { Vault } from './types';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { Header } from 'styles/vault';
import { formatNumberWithCommas } from 'utils/formatter';

const VaultSummary: React.FC<{ vault: Vault }> = ({ vault }) => {
  const navigate = useNavigate();

  const onClickLink = (e: SyntheticEvent) => {
    e.preventDefault();
    navigate(`/core/dapp/vaults/${vault.id}/strategy`);
  };

  return (
    <>
      <Header>{vault.id}</Header>
      <InfoWrapper>
        <Duration>{`${vault.months} MONTH${vault.months > 1 && 'S'}`}</Duration>
        <VaultInfo
          light
          as="a"
          href={`/core/dapp/vaults/${vault.id}/strategy`}
          onClick={onClickLink}
        >
          {vault.months > 1
            ? 'MONTHLY CVX REINVESTMENT STRATEGY'
            : 'NO LOCK, MONTHLY YIELD'}
        </VaultInfo>
        <Tooltip content="Total volume locked for all instances of this maturity">
          <VaultInfo>{`TVL: $${formatNumberWithCommas(vault.tvl)}`}</VaultInfo>
        </Tooltip>
        <Tooltip
          content={`Annual Percentage Yield in $, if you were to lock a single ${TICKER_SYMBOL.TEMPLE_TOKEN} token right now.`}
        >
          <VaultInfo>{`APY: 1 ${TICKER_SYMBOL.TEMPLE_TOKEN} x $120 / yr`}</VaultInfo>
        </Tooltip>
      </InfoWrapper>
    </>
  );
};

const COLOR_PERCENTAGE_TEXT_SHADOW = '0px 0px 4px rgba(222, 92, 6, 0.5)';

const InfoWrapper = styled.div`
  display: flex;
  align-ites: center;
  justify-content: center;
  flex-direction: column;
  height: 70%;
`;

const Duration = styled.h3`
  ${({ theme }) => theme.typography.fonts.fontHeading}
  color: ${({ theme }) => theme.palette.brand};
  display: block;
  font-size: 3rem;
  font-weight: 400;
  text-align: center;
  text-shadow: ${COLOR_PERCENTAGE_TEXT_SHADOW};
  margin: 0;
  line-height: 7rem;
`;

const VaultInfo = styled.p<{ light?: boolean }>`
  ${({ theme }) => theme.typography.fonts.fontBody}
  display: block;
  width: 100%;
  font-weight: 400;
  font-size: 1rem;
  text-align: center;
  letter-spacing: 0.05em;
  margin: 0;
  line-height: 1.75rem;
  color: ${({ theme, light }) =>
    light ? theme.palette.brandLight : theme.palette.brand};
  text-shadow: ${COLOR_PERCENTAGE_TEXT_SHADOW};
`;

export default VaultSummary;
