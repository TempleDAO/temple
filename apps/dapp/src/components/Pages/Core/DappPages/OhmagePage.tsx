import styled from 'styled-components';
import { useCallback, useEffect, useState } from 'react';
import { Input } from '../NewUI/HomeInput';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { TradeButton } from '../NewUI/Home';
import { useWallet } from 'providers/WalletProvider';
import { formatToken } from 'utils/formatter';
import { OtcOffer__factory, ERC20__factory } from 'types/typechain';
import env from 'constants/env';
import { getBigNumberFromString, getTokenInfo } from 'components/Vault/utils';
import { useNotification } from 'providers/NotificationProvider';
import { fromAtto } from 'utils/bigNumber';
import { BigNumber, ethers } from 'ethers';
import { useConnectWallet } from '@web3-onboard/react';

const OHM = TICKER_SYMBOL.OHM;
const ohmToNum = (amount: BigNumber) =>
  Number(ethers.utils.formatUnits(amount, getTokenInfo(OHM).decimals));

export const OhmagePage = () => {
  const [{}, connect] = useConnectWallet();
  const { balance, wallet, updateBalance, signer, ensureAllowance } =
    useWallet();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState(0);
  const [availableDai, setAvailableDai] = useState(0);
  const [allowance, setAllowance] = useState(0);
  const { openNotification } = useNotification();

  // Fetch the allowance for OtcOffer to spend OHM
  const checkAllowance = useCallback(async () => {
    if (!signer || !wallet) return;
    const ohmContract = new ERC20__factory(signer).attach(
      env.contracts.olympus
    );
    const allowance = await ohmContract.allowance(
      wallet,
      env.contracts.otcOffer
    );
    setAllowance(ohmToNum(allowance));
  }, [signer, wallet]);

  useEffect(() => {
    // Fetch the remaining DAI available for OTC
    const getAvailableDai = async () => {
      if (!signer) return;
      const otcContract = new OtcOffer__factory(signer).attach(
        env.contracts.otcOffer
      );
      const available = await otcContract.userBuyTokenAvailable();
      setAvailableDai(fromAtto(available));
    };
    checkAllowance();
    getAvailableDai();
  }, [signer, checkAllowance]);

  // Fetch the DAI quote when the input amount changes
  useEffect(() => {
    const getQuote = async () => {
      if (!signer) return;
      const otcContract = new OtcOffer__factory(signer).attach(
        env.contracts.otcOffer
      );
      const amount = getBigNumberFromString(input, getTokenInfo(OHM).decimals);
      const quote = await otcContract.quote(amount);
      setOutput(fromAtto(quote));
    };
    if (input === '') setOutput(0);
    else getQuote();
  }, [input, signer]);

  // Approve OtcOffer to spend OHM
  const approve = async () => {
    if (!signer || !wallet) return;
    const ohmContract = new ERC20__factory(signer).attach(
      env.contracts.olympus
    );
    try {
      const tx = await ohmContract.approve(
        env.contracts.otcOffer,
        ethers.constants.MaxUint256
      );
      const receipt = await tx.wait();
      openNotification({
        title: `Approved OtcOffer to spend OHM`,
        hash: receipt.transactionHash,
      });
      checkAllowance();
    } catch (e) {
      console.log(e);
      openNotification({
        title: `Failed to increase OHM allowance`,
        hash: '',
      });
    }
  };

  // Swap OHM for DAI
  const swap = async () => {
    if (!signer || !wallet) return;
    const otcContract = new OtcOffer__factory(signer).attach(
      env.contracts.otcOffer
    );
    const amount = getBigNumberFromString(input, getTokenInfo(OHM).decimals);
    try {
      // Ensure allowance for OtcOffer to spend OHM
      const ohmContract = new ERC20__factory(signer).attach(
        env.contracts.olympus
      );
      await ensureAllowance(OHM, ohmContract, env.contracts.otcOffer, amount);
      // Swap
      const tx = await otcContract.swap(amount);
      const receipt = await tx.wait();
      openNotification({
        title: `Sold ${input} OHM for ${output} DAI`,
        hash: receipt.transactionHash,
      });
      setInput('');
      setOutput(0);
      updateBalance();
    } catch (e) {
      console.log(e);
      openNotification({
        title: `Error selling OHM`,
        hash: '',
      });
    }
  };

  const insufficientBalance = Number(input) > ohmToNum(balance.OHM);
  const insufficientAllowance = allowance < Number(input);
  const insufficientDaiAvailable = availableDai < output;

  return (
    <Center>
      <Container>
        <Title>Ohmage</Title>
        <Subtitle>Swap OHM to DAI with zero slippage</Subtitle>
        <Input
          crypto={{
            kind: 'value',
            value: OHM,
          }}
          value={input}
          hint={`Balance: ${formatToken(balance.OHM, OHM)}`}
          onHintClick={() => setInput(formatToken(balance.OHM, OHM))}
          handleChange={(value: string) => setInput(value)}
          isNumber
          placeholder="0.00"
          width="100%"
        />
        {insufficientDaiAvailable ? (
          <p>Exceeds {availableDai.toFixed(2)} DAI available for OTC</p>
        ) : (
          <p>You will receive {output.toLocaleString()} DAI</p>
        )}
        {wallet ? (
          <TradeButton
            onClick={() => {
              if (insufficientAllowance) approve();
              else swap();
            }}
            disabled={
              !signer ||
              insufficientBalance ||
              insufficientDaiAvailable ||
              balance.OHM.isZero()
            }
            style={{ margin: 'auto', whiteSpace: 'nowrap' }}
          >
            {insufficientBalance
              ? 'Insufficient balance'
              : insufficientAllowance
              ? 'Approve allowance'
              : 'Swap'}
          </TradeButton>
        ) : (
          <TradeButton
            onClick={() => {
              connect();
            }}
            style={{ margin: 'auto', whiteSpace: 'nowrap' }}
          >
            Connect Wallet
          </TradeButton>
        )}
      </Container>
    </Center>
  );
};

const Title = styled.div`
  font-size: 1.5rem;
  padding-bottom: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const Subtitle = styled.div`
  font-size: 1.15rem;
  letter-spacing: 0.05rem;
  padding-bottom: 1rem;
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  color: ${({ theme }) => theme.palette.brand};
  width: 350px;
`;

const Center = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
`;
