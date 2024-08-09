import { Popover } from 'components/Popover';
import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import { useWallet } from 'providers/WalletProvider';
import { useEffect, useState } from 'react';
import { formatTemple, getBigNumberFromString } from 'components/Vault/utils';
import { ZERO } from 'utils/bigNumber';
import { BigNumber } from 'ethers';
import { Input } from './HomeInput';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatToken } from 'utils/formatter';
import env from 'constants/env';
import {
  TempleStableAMMRouter__factory,
  TreasuryIV__factory,
  ERC20__factory,
} from 'types/typechain';
import { useNotification } from 'providers/NotificationProvider';
import { useDebouncedCallback } from 'use-debounce';
import { Account } from 'components/Layouts/CoreLayout/Account';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}
interface Quote {
  amountOut: BigNumber;
  priceBelowIV: boolean;
}

const { DAI, FRAX, TEMPLE_TOKEN } = TICKER_SYMBOL;

export const DefendModal: React.FC<IProps> = ({ isOpen, onClose }) => {
  const { wallet, signer, balance, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();
  const [inputValue, setInputValue] = useState('');
  const [iv, setIv] = useState<number>();
  const [quote, setQuote] = useState<Quote>();

  // Set intrinsic value on mount
  useEffect(() => {
    const getIv = async () => {
      if (!signer) return;
      const treasuryIv = new TreasuryIV__factory(signer).attach(
        env.contracts.treasuryIv
      );
      const { frax, temple } = await treasuryIv.intrinsicValueRatio();
      setIv(frax.mul(10_000).div(temple).toNumber() / 10000); // Parse ratio as float
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
  const fetchQuote = async (input: string): Promise<Quote> => {
    if (!signer) return { amountOut: ZERO, priceBelowIV: true };
    const router = new TempleStableAMMRouter__factory(signer).attach(
      env.contracts.templeV2Router
    );
    const amountIn = getBigNumberFromString(input, 18);
    if (amountIn.lte(ZERO)) return { amountOut: ZERO, priceBelowIV: true };
    return await router.swapExactTempleForStableQuote(
      env.contracts.templeV2FraxPair,
      amountIn
    );
  };

  // Sell TEMPLE
  const sell = async () => {
    // Initialize router contract
    if (!signer || !wallet) return;
    const router = new TempleStableAMMRouter__factory(signer).attach(
      env.contracts.templeV2Router
    );

    // Build swap parameters
    const { amountOut } = await fetchQuote(inputValue);
    if (!amountOut) return;
    const fraxAddress = env.contracts.frax; // Use FRAX address even though Defend returns DAI
    const deadline = 20;
    const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;
    const amountIn = getBigNumberFromString(inputValue, 18);
    const slippage = 0.5;
    const slippageBps = BigNumber.from(10_000 + 100 * slippage);
    const minAmountOut = amountOut.mul(10_000).div(slippageBps);

    // Ensure router has allowance to spend TEMPLE
    const tokenContract = new ERC20__factory(signer).attach(
      env.contracts.temple
    );
    await ensureAllowance(
      TEMPLE_TOKEN,
      tokenContract,
      env.contracts.templeV2Router,
      amountIn
    );

    // Execute swap
    try {
      const tx = await router.swapExactTempleForStable(
        amountIn,
        minAmountOut,
        fraxAddress,
        wallet,
        deadlineTimestamp
      );
      const receipt = await tx.wait();
      openNotification({
        title: `Sacrificed ${formatTemple(amountIn)} TEMPLE`,
        hash: receipt.transactionHash,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const outputToken = quote?.priceBelowIV ? DAI : FRAX;
  const isSellButtonDisabled =
    !signer ||
    Number(inputValue) <= 0 ||
    getBigNumberFromString(inputValue, 18).gt(balance.TEMPLE);

  return (
    <>
      <Popover
        isOpen={isOpen}
        onClose={onClose}
        closeOnClickOutside
        showCloseButton
      >
        <ModalContainer>
          <Title>Temple Defend</Title>
          <Subtitle>
            The TEMPLE token has been adversely affected by the recent Euler
            exploit. Trading may resume once we have clarity on the extent of
            the damage and how to best move forward.
            <br />
            <br />
            For those who need urgent liquidity, Temple Defend has been
            re-activated at a fixed rate of ${iv ? iv.toFixed(2) : '0.80'} per
            TEMPLE.
          </Subtitle>
          <InputContainer>
            <Input
              crypto={{
                kind: 'value',
                value: TEMPLE_TOKEN,
              }}
              handleChange={(value: string) => setInputValue(value)}
              isNumber
              value={inputValue}
              placeholder="0"
              onHintClick={() =>
                setInputValue(formatToken(balance.TEMPLE, TEMPLE_TOKEN))
              }
              min={0}
              hint={`Balance: ${formatToken(balance.TEMPLE, TEMPLE_TOKEN)}`}
            />
            <Input
              crypto={{
                kind: 'value',
                value: outputToken,
              }}
              value={formatToken(quote?.amountOut, outputToken)}
              hint={`Balance: ${formatToken(
                balance[outputToken],
                outputToken
              )}`}
              disabled
            />
          </InputContainer>
          {!signer ? (
            <ConnectWalletContainer onClick={() => onClose()}>
              <Account />
            </ConnectWalletContainer>
          ) : (
            <SellButton disabled={isSellButtonDisabled} onClick={() => sell()}>
              Sell {inputValue || '0'} TEMPLE
            </SellButton>
          )}
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

const ConnectWalletContainer = styled.div`
  margin-top: 1rem;
`;

export default DefendModal;
