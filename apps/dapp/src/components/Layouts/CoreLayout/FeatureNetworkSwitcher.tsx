import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useSetChain } from '@web3-onboard/react';
import { featureChainMapping } from 'utils/envChainMapping';

const ENV_VARS = import.meta.env;
const ENV = ENV_VARS.VITE_ENV;

export const FeatureNetworkSwitcher = () => {
  const [{ connectedChain, settingChain: loading }, setChain] = useSetChain();
  const location = useLocation();

  const currentNetworkId = useMemo(
    () => parseInt(connectedChain?.id || '', 16),
    [connectedChain]
  );

  const currentFeature = useMemo(() => {
    const path = location.pathname.split('/');
    if (path[1] === 'dapp') {
      return path[2] || 'dashboard';
    }
  }, [location]);

  const defaultChainForFeature = useMemo(() => {
    if (currentFeature) {
      return featureChainMapping(currentFeature, ENV);
    }
  }, [currentFeature]);

  useEffect(() => {
    const switchNetwork = async () => {
      if (
        setChain &&
        defaultChainForFeature &&
        defaultChainForFeature.id !== currentNetworkId &&
        !loading
      ) {
        try {
          await setChain({
            chainId: `0x${defaultChainForFeature.id.toString(16)}`,
          });
          console.log(
            `Switched to ${defaultChainForFeature.name} for ${currentFeature}`
          );
        } catch (error) {
          console.error('Failed to switch network:', error);
        }
      }
    };

    if (currentFeature) {
      switchNetwork();
    }
  }, [
    currentFeature,
    currentNetworkId,
    defaultChainForFeature,
    setChain,
    loading,
  ]);

  return null;
};
