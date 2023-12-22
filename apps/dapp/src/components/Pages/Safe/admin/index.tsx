import styled from 'styled-components';
import { useState } from 'react';
import env from 'constants/env';
import { InputSelect } from 'components/InputSelect/InputSelect';
import { Address } from '@web3-onboard/core/dist/types';
import { SafeTxsDataTable } from './SafeTxDataTable';
import { useWallet } from 'providers/WalletProvider';
import { useSafeCheckOwner, useSafeDataSubset, useSafePendingTxs } from 'safeApi/use-safe-open-api';
import { queryPhone } from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';

const SafeAdmin = () => {
  const { walletAddress } = useWallet();
  const [safeWallet, setSafeWallet] = useState<Address>(env.safe.gnosisWalletOne);
  const safePendingTxsApi = useSafePendingTxs(safeWallet);
  const {data: isSafeOwner} = useSafeCheckOwner(safeWallet, walletAddress);
  const {data: dataSubset} = useSafeDataSubset( safePendingTxsApi, isSafeOwner ?? false, safeWallet);
  const isAbovePhone = useMediaQuery({
    query: queryPhone,
  });

  const safeOption = (safeAlias: string, safeWallet: Address) => {
    return {
      label: `${safeAlias} (${safeWallet.slice(0, 5)}...${safeWallet.slice(safeWallet.length - 5, safeWallet.length)})`,
      value: safeWallet,
    };
  };
  const safeWalletOptions: { value: Address; label: string }[] = [
    safeOption('Multisig One', env.safe.gnosisWalletOne),
  ];

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
        <Section label="Queued Safe Transactions">
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
};
const Section = (props: SectionProps) => {
  return (
    <SectionContainer>
      <p>{props.label}</p>
      {props.children}
    </SectionContainer>
  );
};

const SectionContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 3rem;
  overflow-x: auto;
`;
