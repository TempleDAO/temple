import { Button } from 'components/Button/Button';
import { BigNumber } from 'ethers';
import { useRelic } from 'providers/RelicProvider';
import { ItemInventory, RelicItemData } from 'providers/types';
import { useWallet } from 'providers/WalletProvider';
import { FC, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { asyncNoop } from 'utils/helpers';
import { NexusContainer } from '../Trade/styles';
import { PageWrapper } from '../utils';

export const NexusPanel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 2px solid ${(props) => props.theme.palette.brand};
  border-radius: 16px;
  padding: 1rem;

  > * {
    margin-bottom: 1rem;
  }
`;

export const NexusPanelRow = styled.h3`
  width: 100%;
  margin: 1rem;
  padding: 0 5px;
  text-align: left;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  * > {
    &:first-child {
      flex: 1;
    }
  }
`;
