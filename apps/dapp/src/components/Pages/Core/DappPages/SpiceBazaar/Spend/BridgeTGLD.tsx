import styled from 'styled-components';
import * as breakpoints from 'styles/breakpoints';
import templeGold from 'assets/icons/temple-gold.svg?react';
import bridgeSwap from 'assets/icons/bridge-swap.svg?react';
import etherum from 'assets/icons/etherum-icon.svg?react';
import berachain from 'assets/icons/berachain-icon.svg?react';
import { TradeButton } from './Details/Details';
import { Input } from '../components/Input';
import { useEffect, useMemo, useState } from 'react';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatToken } from 'utils/formatter';
import { ZERO } from 'utils/bigNumber';
import { useWallet } from 'providers/WalletProvider';
import {
  BridgeTGLDSource,
  useSpiceAuction,
} from 'providers/SpiceAuctionProvider';
import { BigNumber } from 'ethers';
import { getAppConfig } from 'constants/newenv';

interface BridgeTGLDProps {
  onBridgeComplete?: () => void;
}

export const BridgeTGLD = ({ onBridgeComplete }: BridgeTGLDProps) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bridgeSource, setBridgeSource] = useState<BridgeTGLDSource>(
    BridgeTGLDSource.ETH_SOURCE
  );

  const [sourceBalance, setSourceBalance] = useState<BigNumber>(ZERO);

  const { bridgeTgld } = useSpiceAuction();

  const { wallet, balance, updateBalance } = useWallet();

  useEffect(() => {
    updateBalance();
  }, [updateBalance]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  const handleHintClick = () => {
    const amount = sourceBalance.eq(ZERO)
      ? ''
      : formatToken(sourceBalance, TICKER_SYMBOL.TEMPLE_GOLD_TOKEN);
    setInputValue(amount);
  };

  useEffect(() => {
    const updateSelectedTokenBalance = () => {
      if (bridgeSource === BridgeTGLDSource.ETH_SOURCE) {
        setSourceBalance(balance.TGLD);
      } else {
        setSourceBalance(
          balance[getAppConfig().spiceBazaar.tgldBridge.altchainTgldTokenKey]
        );
      }
    };
    updateSelectedTokenBalance();
  }, [balance, bridgeSource]);

  const handleBridgeClick = async () => {
    if (!wallet) return;

    setIsSubmitting(true);
    try {
      await bridgeTgld(inputValue, bridgeSource);
      updateBalance();
      onBridgeComplete?.();
    } catch (error) {
      console.error('Bridge txn failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwapClick = () => {
    if (isSubmitting) return;

    setBridgeSource(
      bridgeSource === BridgeTGLDSource.ETH_SOURCE
        ? BridgeTGLDSource.ALTCHAIN_SOURCE
        : BridgeTGLDSource.ETH_SOURCE
    );

    // also set the input value to 0
    setInputValue('');

    if (bridgeSource === BridgeTGLDSource.ETH_SOURCE) {
      setSourceBalance(
        balance[getAppConfig().spiceBazaar.tgldBridge.altchainTgldTokenKey]
      );
    } else {
      setSourceBalance(balance.TGLD);
    }
  };

  const altchainDisplayName =
    getAppConfig().spiceBazaar.tgldBridge.altchainDisplayName;

  return (
    <BridgeContainer>
      <BridgeContent>
        <BridgeHeader>
          <BridgeTitle>
            <Title>BRIDGE TGLD</Title>
          </BridgeTitle>
        </BridgeHeader>
        <BridgeBody>
          <BridgeInfo>
            Bridge your Temple Gold to {altchainDisplayName} to use them in
            Spice Auctions. They&apos;ll transfer onto the same wallet.{' '}
            <a
              target="_blank"
              rel="noreferrer"
              href="https://docs.templedao.link/spice-bazaar"
            >
              Learn more
            </a>
          </BridgeInfo>
          <BridgeAvailable>
            <TempleGoldIcon />
            <AvailableAmountText>
              <AvailableAmount>
                {' '}
                {!balance?.TGLD
                  ? '0'
                  : formatToken(sourceBalance, TICKER_SYMBOL.TEMPLE_GOLD_TOKEN)}
              </AvailableAmount>
              <AvailableText>AVAILABLE</AvailableText>
            </AvailableAmountText>
          </BridgeAvailable>
          <BridgeTransfer>
            <TransferAmount>
              <TransferTitle>You will transfer</TransferTitle>
              <Input
                crypto={{
                  kind: 'value',
                  value: 'TGLD',
                }}
                hint={`Max amount: ${formatToken(
                  sourceBalance,
                  TICKER_SYMBOL.TEMPLE_GOLD_TOKEN
                )} TGLD`}
                value={inputValue}
                onHintClick={handleHintClick}
                handleChange={handleInputChange}
                isNumber
                placeholder="0.00"
                min={0}
                width="100%"
              />
            </TransferAmount>
            <TransferFromTo>
              <TransferFrom>
                <FromTitle>From</FromTitle>
                <ChainContainer>
                  {bridgeSource === 'ethSource' ? (
                    <>
                      <EtherumIcon />
                      Etherum
                    </>
                  ) : (
                    <>
                      <AltChainIcon />
                      {altchainDisplayName}
                    </>
                  )}
                </ChainContainer>
              </TransferFrom>
              <TransferSwap>
                <BridgeSwapIcon onClick={handleSwapClick} />
              </TransferSwap>
              <TransferTo>
                <ToTitle>To</ToTitle>
                <ChainContainer>
                  {bridgeSource === 'ethSource' ? (
                    <>
                      <AltChainIcon />
                      {altchainDisplayName}
                    </>
                  ) : (
                    <>
                      <EtherumIcon />
                      Etherum
                    </>
                  )}
                </ChainContainer>
              </TransferTo>
            </TransferFromTo>
          </BridgeTransfer>
          {inputValue && Number(inputValue) > 0 && sourceBalance.gt(ZERO) && (
            <BridgeWarning>
              You are bridging <strong>{inputValue || '0'} TGLD</strong> to{' '}
              <strong>{wallet}</strong> on{' '}
              <strong>{altchainDisplayName}</strong>. It will take a few minutes
              for the tokens to arrive.
            </BridgeWarning>
          )}
          <TradeButton
            disabled={inputValue === '0' || !inputValue}
            onClick={handleBridgeClick}
          >
            {' '}
            TRANSFER{' '}
          </TradeButton>
        </BridgeBody>
      </BridgeContent>
    </BridgeContainer>
  );
};

const BridgeContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  width: 100%;
  border-radius: 10px;
  border-width: 1px;
  padding: 0px 16px;

  ${breakpoints.phoneAndAbove(`
    width: 624px;
  `)}
`;

const BridgeContent = styled.div`
  display: flex;
  width: 100%;
  flex-grow: 1;
  flex-direction: column;
  align-items: center;
  gap: 32px;
`;

const BridgeHeader = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  align-items: center;
  justify-content: center;
  height: 77px;
  background: ${({ theme }) => theme.palette.gradients.grey};
`;

const BridgeTitle = styled.div`
  display: flex;
`;

const Title = styled.h3`
  display: flex;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const BridgeBody = styled.div`
  display: flex;
  width: 360px;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 8px 0px;

  ${breakpoints.phoneAndAbove(`
    width: 450px;
  `)}
`;

const BridgeInfo = styled.div`
  display: block;
  border: 2px solid transparent;
  border-radius: 6px;
  padding: 10px;
  font-weight: 400;
  font-size: 12px;
  line-height: 150%;
  color: ${({ theme }) => theme.palette.brandLight};

  background: linear-gradient(#24272c, #24272c) padding-box,
    linear-gradient(180deg, #95613f1a, #ffffff00) border-box;

  border: 2px solid transparent;
  background-clip: padding-box, border-box;

  a {
    font-weight: 700;
    text-decoration: underline;
    font-size: 12px;
    line-height: 18px;
    color: ${({ theme }) => theme.palette.brandLight};
  }
`;

const BridgeAvailable = styled.div`
  display: flex;
  flex-direction: row;
  align-self: flex-start;
  align-items: center;
  padding: 0px 24px 0px 24px;
  gap: 10px;

  ${breakpoints.phoneAndAbove(`
    width: 450px;
  `)}
`;

const AvailableAmount = styled.h3`
  font-size: 28px;
  line-height: 52px;
  color: ${({ theme }) => theme.palette.gold};
  margin: 0px;
`;

const AvailableAmountText = styled.div`
  display: flex;
  flex-direction: column;
`;

const AvailableText = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brand};
  margin: 0px;
`;

const TempleGoldIcon = styled(templeGold)`
  width: 42px;
  height: 42px;
`;

const BridgeTransfer = styled.div`
  display: flex;
  width: 100%;
  flex-direction: column;
  border-top: 2px solid ${({ theme }) => theme.palette.brand};
  border-bottom: 2px solid ${({ theme }) => theme.palette.brand};
  background: ${({ theme }) => theme.palette.gradients.grey};
  padding: 24px;
  gap: 32px;

  ${breakpoints.phoneAndAbove(`
    gap: 24px;
  `)}
`;

const TransferAmount = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TransferTitle = styled.div`
  display: block;
  font-weight: 400;
  font-size: 16px;
  line-height: 120%;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const TransferFromTo = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
`;

const TransferFrom = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 8px;
`;

const FromTitle = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  font-weight: 400;
  font-size: 16px;
  line-height: 120%;
`;

const TransferSwap = styled.div`
  display: flex;
  align-self: flex-end;
`;

const BridgeSwapIcon = styled(bridgeSwap)`
  width: 40px;
  height: 54px;
`;

const EtherumIcon = styled(etherum)`
  width: 24px;
  height: 24px;
`;

const AltChainIcon = styled(berachain)`
  width: 24px;
  height: 24px;
`;

const TransferTo = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 8px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ToTitle = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  font-weight: 400;
  font-size: 16px;
  line-height: 120%;
`;

const ChainContainer = styled.div`
  display: flex;
  width: 120px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  border-width: 1px;
  padding: 10px;
  background: ${({ theme }) => theme.palette.black};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  font-weight: 400;
  font-size: 14px;
  line-height: 24px;
  color: ${({ theme }) => theme.palette.brandLight};

  ${breakpoints.phoneAndAbove(`
    width: 165px;
    font-weight: 700;
    font-size: 18px;
    line-height: 18px;
  `)}
`;

const BridgeWarning = styled.div`
  display: block;
  font-weight: 400;
  font-size: 14px;
  line-height: 24px;
  color: ${({ theme }) => theme.palette.brandLight};

  ${breakpoints.phoneAndAbove(`
    font-size: 16px;
    line-height: 120%;
  `)}
`;
