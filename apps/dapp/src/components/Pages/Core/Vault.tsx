import styled from 'styled-components';
import { Claim } from './VaultPages/Claim';
import { Stake } from './VaultPages/Stake';
import { Summary } from './VaultPages/Summary';
import { Strategy } from './VaultPages/Strategy';
import { Timing } from './VaultPages/Timing';
import { VaultSVG } from 'components/Vault/VaultSVG';
import { Vault } from 'components/Vault/types';

const VaultPage = () => {
  const vaultData:Vault = {
    id: 'abc',
    months: 3,
    now: new Date('6/15/22'),
    startDate: new Date('4/1/22'),
    entries: [
      {
        id: 1,
        entryDate: new Date('4/1/2022'),
        amount: 5300,
      },
      {
        id: 2,
        entryDate: new Date('5/30/2022'),
        amount: 2500,
      },
    ],
  };

  return (
    <Wrapper>
      <VaultSVG data={vaultData}>
        <Claim />
        <Stake />
        <Summary />
        <Strategy />
        <Timing />
      </VaultSVG>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  display: flex;
`;

export default VaultPage;
