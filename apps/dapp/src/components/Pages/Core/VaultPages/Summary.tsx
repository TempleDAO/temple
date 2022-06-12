import { SyntheticEvent } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

import Tooltip from 'components/Tooltip/Tooltip';

import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatNumberWithCommas } from 'utils/formatter';
import VaultContent from './VaultContent';
import { useVaultContext } from 'components/Pages/Core/VaultContext';
import { useVaultMetrics } from 'hooks/core/subgraph';
import EllipsisLoader from 'components/EllipsisLoader';
import { ZERO } from 'utils/bigNumber';
import { formatTemple } from 'components/Vault/utils';

export const Summary = () => {
  const navigate = useNavigate();
  const { vaultGroup, balances } = useVaultContext();
  const { response, isLoading } = useVaultMetrics();

  const onClickLink = (e: SyntheticEvent) => {
    e.preventDefault();
    navigate(`/dapp/vaults/${vaultGroup.id}/strategy`);
  };

  const tvl = response?.data?.metrics[0]?.tvlUSD;
  let earningsTotal = ZERO;
  let depositTotal = ZERO;
  vaultGroup.vaults.forEach((vault) => {
    const vaultBalance = balances[vault.id] || {};
    if (!vaultBalance.staked) return;
    earningsTotal = earningsTotal.add(vaultBalance?.balance?.sub(vaultBalance?.staked!)!);
    depositTotal = depositTotal.add(vaultBalance?.staked!);
  });
  return (
    <VaultContent>
      <Title>1 MONTH</Title>
      <Text3>
        <>
          TVL: <>{isLoading || !tvl ? <EllipsisLoader /> : `$${formatNumberWithCommas(tvl)}`}</>{' '}
          {!!tvl && (
            <Tooltip content="Total Value Locked for this vault" inline={true}>
              ⓘ
            </Tooltip>
          )}
        </>
      </Text3>
      <Text3>
        Projected APY: 18%{' '}
        <Tooltip
          content={`Projected Annual Percentage Yield, if you were to lock a single ${TICKER_SYMBOL.TEMPLE_TOKEN} token right now.`}
          inline={true}
        >
          ⓘ
        </Tooltip>
      </Text3>
      {depositTotal.gt(ZERO) ? (
        <>
          <Text3 light> Deposits: {formatTemple(depositTotal)} $TEMPLE </Text3>
          <Text3 light> Earned: {formatTemple(earningsTotal)} $TEMPLE </Text3>
        </>
      ) : (
        <Text3 light>Deposit TEMPLE to start earning</Text3>
      )}
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
  color: ${({ theme, light }) => (light ? theme.palette.brandLight : theme.palette.brand)};
  text-shadow: ${COLOR_PERCENTAGE_TEXT_SHADOW};
`;

const Text3 = styled.div<{ light?: boolean }>`
  width: 100%;
  font-weight: 400;
  margin-top: 1.5rem;

  font-size: 1.5rem;
  text-shadow: ${COLOR_PERCENTAGE_TEXT_SHADOW};
  color: ${({ theme, light }) => (light ? theme.palette.brandLight : theme.palette.brand)};
`;
