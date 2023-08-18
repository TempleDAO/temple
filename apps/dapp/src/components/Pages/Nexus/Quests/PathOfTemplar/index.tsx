import { useEffect, useState } from 'react';
import { useWallet } from 'providers/WalletProvider';
import { useAccount } from 'wagmi';
import PotSuccessSlide from './PotSuccessSlide';
import PotConnectWalletSlide from './PotConnectWalletSlide';
import PotCollectSlide from './PotCollectSlide';
import { useParams } from 'react-router-dom';

const ALLOWED_ENCLAVES = ['chaos', 'mystery', 'logic', 'order', 'structure'];

const PotMint = () => {
  const { enclave } = useParams();

  if (!enclave) {
    return (<div>{'Missing enclave'}</div>);
  }

  if (!ALLOWED_ENCLAVES.includes(enclave)) {
    return <div>{`Invalid enclave: ${enclave}`}</div>;
  }

  const { isConnected } = useWallet();
  const { address } = useAccount();

  const [mintSuccess, setMintSuccess] = useState(false);
  const [showConnect, setShowConnect] = useState(false);

  useEffect(() => {
    if (address && isConnected) {
      setShowConnect(false);
      return;
    }
    setShowConnect(true);
  }, [address, isConnected]);

  const onMintSuccess = () => {
    setMintSuccess(true);
  };

  if (showConnect) {
    return <PotConnectWalletSlide />;
  }

  if (mintSuccess) {
    return <PotSuccessSlide />;
  }
  
  // TODO: Clean up/sanitize enclave

  return (
    <>
      <PotCollectSlide onSuccessCallback={onMintSuccess} enclave={enclave} />
    </>
  );
};

export default PotMint;
