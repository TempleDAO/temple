import { Popover } from 'components/Popover';
import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import { useWallet } from 'providers/WalletProvider';
import { useEffect, useState } from 'react';
import { formatTemple, getBigNumberFromString } from 'components/Vault/utils';
import { ZERO } from 'utils/bigNumber';
import { BigNumber } from 'ethers';
import { CryptoSelector, CryptoValue, Input } from './HomeInput';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatToken } from 'utils/formatter';
import env from 'constants/env';
import { TempleStableAMMRouter__factory, TreasuryIV__factory } from 'types/typechain';
import { useNotification } from 'providers/NotificationProvider';
import { useDebouncedCallback } from 'use-debounce';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}

const { DAI, TEMPLE_TOKEN } = TICKER_SYMBOL;

const inputConfig: CryptoValue = {
  kind: 'value',
  value: `${TEMPLE_TOKEN}`,
};

const outputConfig: CryptoSelector = {
  kind: 'select',
  cryptoOptions: [DAI],
  onCryptoChange: () => {},
  selected: DAI,
};

export const DefendModal: React.FC<IProps> = ({ isOpen, onClose }) => {
  const { wallet, signer, balance } = useWallet();
  const { openNotification } = useNotification();
  const [inputValue, setInputValue] = useState('');
  const [iv, setIv] = useState(ZERO);
  const [quote, setQuote] = useState<BigNumber>();

  // Set intrinsic value on mount
  useEffect(() => {
    const getIv = async () => {
      if (!signer) return;
      const treasuryIv = new TreasuryIV__factory(signer).attach(env.contracts.treasuryIv);
      const { frax, temple } = await treasuryIv.intrinsicValueRatio();
      setIv(frax.div(temple));
    };
    getIv();
  }, [signer]);

  // Fetch quote, debounced
  const debouncedFetchQuote = useDebouncedCallback(async (amount: string) => {
    const quote = await fetchQuote(amount);
    setQuote(quote);
  }, 750);

  // Refresh quote on input change
  useEffect(() => {
    debouncedFetchQuote(inputValue);
  }, [inputValue]);

  // Get quote from router
  const fetchQuote = async (input: string): Promise<BigNumber> => {
    if (!signer || !wallet) return ZERO;
    const router = new TempleStableAMMRouter__factory(signer).attach(env.contracts.templeV2Router);
    const amountIn = getBigNumberFromString(input, 18);
    if (amountIn.lte(ZERO)) return ZERO;
    const { amountOut } = await router.swapExactTempleForStableQuote(env.contracts.templeV2FraxPair, amountIn);
    return amountOut;
  };

  // Sell TEMPLE
  const sell = async () => {
    // Initialize router contract
    if (!signer || !wallet) return;
    const router = new TempleStableAMMRouter__factory(signer).attach(env.contracts.templeV2Router);

    // Build swap parameters
    const amountOut = await fetchQuote(inputValue);
    if (!amountOut) return;
    const fraxAddress = env.contracts.frax; // Use FRAX address even though Defend returns DAI
    const deadline = 20;
    const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;
    const amountIn = getBigNumberFromString(inputValue, 18);
    const slippage = 0.5;
    const slippageBps = BigNumber.from(10_000 + 100 * slippage);
    const minAmountOut = amountOut.mul(10_000).div(slippageBps);

    // Execute swap
    try {
      const tx = await router.swapExactTempleForStable(amountIn, minAmountOut, fraxAddress, wallet, deadlineTimestamp);
      const receipt = await tx.wait();
      openNotification({
        title: `Sacrificed ${formatTemple(amountIn)} TEMPLE`,
        hash: receipt.transactionHash,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const isSellButtonDisabled = Number(inputValue) <= 0 || getBigNumberFromString(inputValue, 18).gt(balance.TEMPLE);

  return (
    <>
      <Popover isOpen={isOpen} onClose={onClose} closeOnClickOutside showCloseButton>
        <ModalContainer>
          <Title>Temple Defend</Title>
          <Subtitle>
            TempleDAO suffered material damages from the Euler Finance hack via Balancer's boosted pool. We have paused
            trading while we work on the best path forward.
            <br />
            <br />
            For those who need liquidity urgently, Temple Defend has been re-opened at a fixed rate of $
            {iv.toNumber().toFixed(2)} per TEMPLE
          </Subtitle>
          <InputContainer>
            <Input
              crypto={inputConfig}
              handleChange={(value: string) => setInputValue(value)}
              isNumber
              value={inputValue}
              placeholder="0"
              onHintClick={() => setInputValue(formatToken(balance.TEMPLE, TEMPLE_TOKEN))}
              min={0}
              hint={`Balance: ${formatToken(balance.TEMPLE, TEMPLE_TOKEN)}`}
            />
            <Input
              crypto={outputConfig}
              value={formatToken(quote, DAI)}
              hint={`Balance: ${formatToken(balance.DAI, DAI)}`}
              disabled
            />
          </InputContainer>
          <SellButton disabled={isSellButtonDisabled} onClick={() => sell()}>
            Sell {inputValue || '0'} TEMPLE
          </SellButton>
        </ModalContainer>
      </Popover>
    </>
  );
};

const SellButton = styled(Button)`
  background: ${({ theme }) => theme.palette.gradients.dark};
  color: ${({ theme }) => theme.palette.brandLight};
  border: 1px solid #95613f;
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  width: max-content;
  margin: 1rem auto;
  height: max-content;
  padding: 0.5rem 1rem;
`;

const Subtitle = styled.div`
  color: ${({ theme }) => theme.palette.brand};
  letter-spacing: 0.05rem;
  line-height: 1.25rem;
`;

const Title = styled.div`
  font-size: 1.5rem;
  padding-bottom: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  color: ${({ theme }) => theme.palette.brand};
  width: 350px;
`;

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
`;

export default DefendModal;
