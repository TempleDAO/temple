import IntroNotConnected from './IntroNotConnected';
import { useWallet } from 'providers/WalletProvider';
import IntroConnected from './IntroConnected';
export default function TeamPaymentsNonCash() {
  const { wallet } = useWallet();

  return <>{wallet ? <IntroConnected /> : <IntroNotConnected />}</>;
}
