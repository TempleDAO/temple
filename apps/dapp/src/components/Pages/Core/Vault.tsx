// import { VaultSVG } from "components/Vault/VaultSVG";
import { Claim } from './VaultPages/Claim';
import { Stake } from './VaultPages/Stake';
import { Summary } from './VaultPages/Summary';
import { Strategy } from './VaultPages/Strategy';
import { Timing } from './VaultPages/Timing';
import { VaultSVG } from 'components/Vault/VaultSVG';

const VaultPage = () => {
  const vaultData = {
    id: 'abc',
    months: 3,
    now: '6/15/22',
    startDate: '4/1/22',
    entries: [
      {
        id: 1,
        entryDate: '4/1/2022',
        amount: 5000,
      },
      {
        id: 2,
        entryDate: '5/30/2022',
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
