import React, { FC, useEffect, useState, useCallback } from 'react';
import { ConvoFlowTitle, Spacer, SwapArrows, TitleWrapper, ViewContainer } from 'components/AMM/helpers/components';
import { Button } from 'components/Button/Button';
import { useWallet, WalletProvider } from 'providers/WalletProvider';
import styled from 'styled-components';
import { useNetwork, useAccount } from 'wagmi';
import { useNotification } from 'providers/NotificationProvider';
import { ethers } from 'ethers';

import { RelicItemCard } from './RelicItemCard';


interface EquipProps {
  small?: boolean;
}

export const Equip: FC<EquipProps> = ({ small }) => {

  const { network, wallet, signer } = useWallet();
  //const [{ data, loading, error }, switchNetwork] = useNetwork();
  const { openNotification } = useNotification();
  const [{ data: accountData, loading: accountLoading }] = useAccount();



  return (
    <div style={{
        display: "flex"
        }}>
      <RelicItemCard
      actionType='equip'
      />
      <RelicItemCard
      actionType='unequip'
      />
    </div>
  );
}

// Chain ID: 42161 | Name: Arbitrum One

const SwitchNetworkButton = styled(Button)`
  border: 1px solid;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0;
`;