import styled from 'styled-components';
import { useState } from 'react';
import env from 'constants/env';
import { InputSelect, Option } from 'components/InputSelect/InputSelect';
import { SafeTxsDataTable } from './SafeTxDataTable';
import { queryPhone } from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import {
  SafeTransactionCategory,
  SafeTransactionsContextProvider,
  useSafeTransactions,
} from 'safe/safeContext';
import LinkIcon from 'assets/icons/link.svg?react';
import { Copy } from 'components/Copy/Copy';

const SafeAdminWithContext = () => {
  const [safeWalletAddress, setSafeWalletAddress] = useState<string>(
    env.safes[0].address
  );
  return (
    <SafeTransactionsContextProvider safeAddress={safeWalletAddress}>
      <SafeAdmin setSafeWalletAddress={setSafeWalletAddress} />
    </SafeTransactionsContextProvider>
  );
};

type SafeAdminProps = {
  setSafeWalletAddress: (safeWallet: string) => void;
};

const SafeAdmin = ({ setSafeWalletAddress }: SafeAdminProps) => {
  const isAbovePhone = useMediaQuery({
    query: queryPhone,
  });
  const { safeAddress } = useSafeTransactions();

  const safeWalletOptions: Option[] = env.safes.map((safe) => ({
    label: `${safe.name} (${safe.address.slice(0, 5)}...${safe.address.slice(
      safe.address.length - 5,
      safe.address.length
    )})`,
    value: safe.address,
  }));

  return (
    <Container>
      <AreaDelimiter>
        <div>
          <h3>Safe App</h3>
          <Section label="Select Gnosis Safe Wallet">
            <FlexContainer>
              <InputSelect
                options={safeWalletOptions}
                defaultValue={safeWalletOptions[0]}
                onChange={(e) => setSafeWalletAddress(e.value)}
                isSearchable={false}
                width={isAbovePhone ? '450px' : '300px'}
              />
              <Copy value={safeAddress} />
            </FlexContainer>
          </Section>
        </div>
        <Section
          label="Queued Transactions"
          safeTxCategoryLink="queue"
          overflowX
        >
          <SafeTxsDataTable
            safeTxCategory="queue"
            tableHeaders={[
              'Action',
              'Nonce',
              'Status',
              'Type',
              'Confirmations',
              'Date',
            ]}
          />
        </Section>
        <Section
          label="History Transactions"
          safeTxCategoryLink="history"
          overflowX
        >
          <SafeTxsDataTable
            safeTxCategory="history"
            tableHeaders={[
              'Action',
              'Nonce',
              'Status',
              'Type',
              'Confirmations',
              'Date',
            ]}
          />
        </Section>
      </AreaDelimiter>
    </Container>
  );
};

export default SafeAdminWithContext;

const Container = styled.div`
  gap: 2rem;
`;

const AreaDelimiter = styled.div`
  h3 {
    margin-top: 0.5rem;
    margin-bottom: 0;
  }
  display: flex;
  border: ${({ theme }) => `1px solid ${theme.palette.brand}`};
  border-radius: 2rem;
  padding: 1rem;
  flex-direction: column;
`;

type SectionProps = {
  label: string;
  children: React.ReactNode;
  safeTxCategoryLink?: SafeTransactionCategory;
  overflowX?: boolean;
};
const Section = (props: SectionProps) => {
  const ENV_VARS = import.meta.env;
  const ENV = ENV_VARS.VITE_ENV;
  const IS_PROD = ENV === 'production';
  const safeEnv = IS_PROD ? 'eth' : 'sep';

  const { label, children, safeTxCategoryLink } = props;
  const { safeAddress } = useSafeTransactions();

  return (
    <SectionContainer {...props}>
      <FlexContainer>
        <Label>{label}</Label>
        {safeTxCategoryLink && (
          <a
            href={`https://app.safe.global/transactions/${safeTxCategoryLink}?safe=${safeEnv}:${safeAddress}`}
            target="_blank"
            rel="noreferrer"
          >
            <LinkIcon height={16} width={16} />
          </a>
        )}
      </FlexContainer>
      {children}
    </SectionContainer>
  );
};

const SectionContainer = styled.div<{ overflowX?: boolean }>`
  display: flex;
  flex-direction: column;
  margin-top: 3rem;
  overflow-x: ${({ overflowX }) => (overflowX ? 'auto' : 'unset')};
`;

const Label = styled.label`
  margin-bottom: 0.5rem;
  font-weight: bold;
`;

const FlexContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 10px;
  align-items: center;
`;
