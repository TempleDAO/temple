import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import styled from 'styled-components';
import Foyer from 'components/Pages/Foyer';
import gatesImage from 'assets/images/EnterTheGates.png';
import { useWallet } from 'providers/WalletProvider';
import { TempleFraxAMMRouter__factory } from 'types/typechain';
import { CustomRoutingPage } from 'hooks/use-custom-spa-routing';
import withWallet from 'hoc/withWallet';

const ENV_VARS = import.meta.env;
const TEMPLE_V2_ROUTER_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_V2_ROUTER_ADDRESS;

enum Status {
  Start = 'ENTER',
  Loading = 'WAIT',
  Failed = 'DENIED',
  Complete = 'WELCOME',
}

const TempleGatesPage: CustomRoutingPage = ({ routingHelper }) => {
  const [key, setKey]: [string, Dispatch<SetStateAction<string>>] =
    useState('');
  const { wallet, signer, verifyAMMWhitelist } = useWallet();
  const [status, setStatus]: [
    Status | undefined,
    Dispatch<SetStateAction<Status | undefined>>
  ] = useState();

  const { changePageTo } = routingHelper;

  // Check if user is whitelisted already
  const isWhitelisted = async () => {
    if (wallet && signer) {
      try {
        const fraxAMMRouter = new TempleFraxAMMRouter__factory()
          .attach(TEMPLE_V2_ROUTER_ADDRESS)
          .connect(signer);
        const whitelisted = await fraxAMMRouter.allowed(wallet);
        if (whitelisted) {
          changePageTo(Foyer);
        } else {
          setStatus(Status.Start);
        }
      } catch (e) {
        console.error(e);
        setStatus(Status.Start);
      }
    } else setStatus(Status.Start);
  };
  useEffect(() => {
    isWhitelisted();
  }, [wallet, signer]);

  // Send signature to contract to be whitelisted
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(Status.Loading);
    const tx = await verifyAMMWhitelist(key);
    if (!tx) {
      setStatus(Status.Failed);
      return;
    }
    const res = await tx.wait();
    // TODO: Check the value of res to see if transaction was successful
    isWhitelisted();
  };

  return (
    <>
      <TempleGatesContainer>
        {ENV_VARS.VITE_ENV !== 'production' && (
          <button onClick={() => changePageTo(Foyer)}>BYPASS</button>
        )}
        <KeyForm onSubmit={submit}>
          <KeyInput
            placeholder="Sacred Key"
            type="text"
            onChange={(e) => setKey(e.target.value)}
            value={key}
          />
          <EnterButton>{status}</EnterButton>
        </KeyForm>
      </TempleGatesContainer>
    </>
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

const KeyInput = styled.input`
  ${(props) => props.theme.typography.h4};
  background: ${(props) => props.theme.palette.brand25};
  border: none;
  border-radius: 2px;
  color: #d1c0a7;
  margin-right: 1rem;
  opacity: 1;
  min-height: 3rem;
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
