import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import styled, { css } from 'styled-components';
import { Flex } from 'components/Layout/Flex';
import withWallet from 'hoc/withWallet';
import gatesImage from 'assets/images/EnterTheGates.png';
import { useWallet } from 'providers/WalletProvider';
import { AMMWhitelist__factory } from 'types/typechain';
import { Input } from 'components/Input/Input';
import { Button } from 'components/Button/Button';

const ENV_VARS = import.meta.env;
const AMM_WHITELIST_ADDRESS = ENV_VARS.VITE_PUBLIC_AMM_WHITELIST_ADDRESS;

const TempleGatesPage = () => {
  const [key, setKey]: [string, Dispatch<SetStateAction<string>>] =
    useState('');

  return (
    <TempleGatesContainer>
      <KeyForm
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <KeyInput
          placeholder="Sacred Key"
          type="text"
          onChange={(e) => setKey(e.target.value)}
          value={key}
        />
        <EnterButton>ENTER</EnterButton>
      </KeyForm>
    </TempleGatesContainer>
  );
};

const TempleGatesContainer = styled.div`
  background-image: url(${gatesImage});
  background-size: cover;
  background-position: center;
  height: 100vh;
  width: 100vw;
`;

const KeyForm = styled.form`
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  display: flex;
`;

const KeyInput = styled.input.attrs({
  placeholderTextColor: 'red',
})`
  ${(props) => props.theme.typography.h4};
  background: ${(props) => props.theme.palette.brand25};
  border: none;
  border-radius: 2px;
  color: #d1c0a7;
  margin-right: 1rem;
  opacity: 1;
  padding: 0rem 0.5rem;
  text-align: center;
  width: 14rem;
  ::placeholder {
    opacity: 1;
  }
  &:focus,
  &:active {
    outline: none;
  }
`;

const EnterButton = styled.button`
  ${(props) => props.theme.typography.h2};
  background: transparent;
  border: none;
  border-radius: 2px;
  color: ${(props) => props.theme.palette.brand};
  cursor: pointer;
  font-size: 2rem;
  padding: 0rem 1rem;
  &:focus {
    outline: 1px solid ${(props) => props.theme.palette.brand25};
  }
`;

export default withWallet(TempleGatesPage);
