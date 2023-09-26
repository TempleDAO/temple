import { Popover } from 'components/Popover';
import styled from 'styled-components';
import { useEffect, useState } from 'react';
import _ from 'lodash';
import { Input } from './HomeInput';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { TradeButton } from './Home';
import { useWallet } from 'providers/WalletProvider';
import { formatToken } from 'utils/formatter';
import { OtcOffer__factory } from 'types/typechain';
import env from 'constants/env';
import { getBigNumberFromString, getTokenInfo } from 'components/Vault/utils';
import { useNotification } from 'providers/NotificationProvider';
import { ERC20__factory } from 'types/typechain/typechain';
import { fromAtto } from 'utils/bigNumber';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}

const OHM = TICKER_SYMBOL.OHM;

export const OtcModal: React.FC<IProps> = ({ isOpen, onClose }) => {
  const { balance, wallet, updateBalance, signer, ensureAllowance } = useWallet();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('0');
  const [allowance, setAllowance] = useState(0);
  const { openNotification } = useNotification();

  // Fetch the allowance for OtcOffer to spend OHM
  useEffect(() => {
    const checkAllowance = async () => {
      if (!signer || !wallet) return;
      const ohmContract = new ERC20__factory(signer).attach(env.contracts.olympus);
      const allowance = await ohmContract.allowance(wallet, env.contracts.otcOffer);
      setAllowance(fromAtto(allowance));
    };
    checkAllowance();
  }, [signer]);

  // Fetch the DAI quote when the input amount changes
  useEffect(() => {
    const getQuote = async () => {
      if (!signer) return;
      const otcContract = new OtcOffer__factory(signer).attach(env.contracts.otcOffer);
      const amount = getBigNumberFromString(input, getTokenInfo(OHM).decimals);
      const quote = await otcContract.quote(amount);
      setOutput(formatToken(quote, TICKER_SYMBOL.DAI));
    };
    if (input === '') setOutput('0');
    else getQuote();
  }, [input]);

  // Approve OtcOffer to spend OHM
  const approve = async () => {
    if (!signer || !wallet) return;
    const ohmContract = new ERC20__factory(signer).attach(env.contracts.olympus);
    try {
      const tx = await ohmContract.approve(env.contracts.otcOffer, 2 ** 256 - 1);
      const receipt = await tx.wait();
      openNotification({
        title: `Approved OtcOffer to spend OHM`,
        hash: receipt.transactionHash,
      });
      setAllowance(2 ** 256 - 1);
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
    const otcContract = new OtcOffer__factory(signer).attach(env.contracts.otcOffer);
    const amount = getBigNumberFromString(input, getTokenInfo(OHM).decimals);
    try {
      // Ensure allowance for OtcOffer to spend OHM
      const ohmContract = new ERC20__factory(signer).attach(env.contracts.olympus);
      await ensureAllowance(OHM, ohmContract, env.contracts.otcOffer, amount);
      // Swap
      const tx = await otcContract.swap(amount);
      const receipt = await tx.wait();
      openNotification({
        title: `Sold ${input} OHM for ${output} DAI`,
        hash: receipt.transactionHash,
      });
      setInput('');
      setOutput('0');
      updateBalance();
    } catch (e) {
      console.log(e);
      openNotification({
        title: `Error selling OHM`,
        hash: '',
      });
    }
  };

  const insufficientBalance = Number(input) > Number(formatToken(balance.OHM, OHM));
  const insufficientAllowance = allowance < Number(input);

  return (
    <>
      <Popover isOpen={isOpen} onClose={onClose} closeOnClickOutside showCloseButton>
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
          <p>You will receive {output} DAI</p>
          <TradeButton
            onClick={() => {
              if (insufficientAllowance) approve();
              else swap();
            }}
            disabled={!signer || insufficientBalance}
            style={{ margin: 'auto', whiteSpace: 'nowrap' }}
          >
            {insufficientBalance ? 'Insufficient balance' : insufficientAllowance ? 'Approve allowance' : 'Swap'}
          </TradeButton>
        </Container>
      </Popover>
    </>
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

export default OtcModal;
