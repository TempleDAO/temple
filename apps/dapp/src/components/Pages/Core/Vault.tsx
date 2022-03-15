// import { VaultSVG } from "components/Vault/VaultSVG";
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
        amount: 5000,
      },
      {
        id: 2,
        entryDate: new Date('5/30/2022'),
        amount: 5000,
      },
    ],
  };

  return (
    <VaultSVG data={vaultData}>
      <Claim />
      <Stake />
      <Summary />
      <Strategy />
      <Timing />
    </VaultSVG>
  );
};

export default VaultPage;
