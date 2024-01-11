import styled from 'styled-components';
import { useState } from 'react';
import env from 'constants/env';
import { InputSelect, Option } from 'components/InputSelect/InputSelect';
import { SafeTxsDataTable } from './SafeTxDataTable';
import { useWallet } from 'providers/WalletProvider';
import { useSafeCheckOwner, useSafeDataSubset, useSafePendingTxs } from 'safe/open-api/use-safe-open-api';
import { queryPhone } from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { SafeWallet } from 'constants/env/types';

const SafeAdmin = () => {
  const { walletAddress } = useWallet();
  const [safeWallet, setSafeWallet] = useState<SafeWallet>(env.safes[0]);
  const safePendingTxsApi = useSafePendingTxs(safeWallet.address);
  const { data: isSafeOwner } = useSafeCheckOwner(safeWallet.address, walletAddress);
  const { data: dataSubset } = useSafeDataSubset(safePendingTxsApi, isSafeOwner ?? false, safeWallet.address);
  const isAbovePhone = useMediaQuery({
    query: queryPhone,
  });

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
            <InputSelect
              options={safeWalletOptions}
              defaultValue={safeWalletOptions[0]}
              onChange={(e) => setSafeWallet(e.value)}
              isSearchable={false}
              width={isAbovePhone ? '450px' : '300px'}
            />
          </Section>
        </div>
        <Section label="Queued Safe Transactions" overflowX>
          <SafeTxsDataTable
            dataLoading={safePendingTxsApi.isLoading}
            dataSubset={dataSubset}
            tableHeaders={['Action', 'Nonce', 'SafeTx', 'Status', 'Confirmations', 'Date']}
          />
        </Section>
      </AreaDelimiter>
    </Container>
  );
};

export default SafeAdmin;

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
  overflowX?: boolean;
};
const Section = (props: SectionProps) => {
  return (
    <SectionContainer {...props}>
      <p>{props.label}</p>
      {props.children}
    </SectionContainer>
  );
};

const SectionContainer = styled.div<{overflowX?: boolean}>`
  display: flex;
  flex-direction: column;
  margin-top: 3rem;
  overflow-x: ${({ overflowX }) => (overflowX ? 'auto' : 'unset')};
`;
