import { useEffect, useState } from 'react';
import styled from 'styled-components';
import stakeTemple from 'assets/icons/stake-temple.svg?react';
import templeGold from 'assets/icons/temple-gold.svg?react';
import { Input } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Input';
import { Button } from 'components/Button/Button';
import { useWallet } from 'providers/WalletProvider';
import { formatNumberWithCommas, formatToken } from 'utils/formatter';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { formatBigNumber, getTokenInfo } from 'components/Vault/utils';
import { fromAtto, ZERO } from 'utils/bigNumber';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import LargeRoundCheckBox from 'components/Pages/Core/DappPages/SpiceBazaar/components/LargeRoundCheckBox';

export const Stake = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });

  const { balance, updateBalance } = useWallet();
  const {
    staking: { stakeTemple },
  } = useSpiceBazaar();

  useEffect(() => {
    const onMount = async () => {
      await updateBalance();
    };
    onMount();
  }, [updateBalance]);

  const handleHintClick = () => {
    const amount = balance.TEMPLE.eq(ZERO)
      ? ''
      : formatBigNumber(
          balance.TEMPLE,
          getTokenInfo(TICKER_SYMBOL.TEMPLE_TOKEN).decimals
        );
    setInputValue(amount);
  };

  const [inputValue, setInputValue] = useState('');

  const handleInputChange = async (value: string) => {
    setInputValue(value);
  };

  const [isCheckboxChecked1, setIsCheckboxChecked1] = useState(false);
  const handleCheckboxToggle1 = (checked: boolean) => {
    setIsCheckboxChecked1(checked);
  };

  const [isCheckboxChecked2, setIsCheckboxChecked2] = useState(false);
  const handleCheckboxToggle2 = (checked: boolean) => {
    setIsCheckboxChecked2(checked);
  };

  return (
    <PageContainer>
      <AvailableAmountContainer>
        <StakeTempleIcon />
        <AvailableAmountText>
          <AvailableAmount>
            {formatNumberWithCommas(fromAtto(balance.TEMPLE))} TEMPLE
          </AvailableAmount>
          <AvailabilityText>AVAILABLE</AvailabilityText>
        </AvailableAmountText>
      </AvailableAmountContainer>
      <BodyContainer>
        <TitleStake>Amount to stake</TitleStake>
        <Input
          crypto={{
            kind: 'value',
            value: TICKER_SYMBOL.TEMPLE_TOKEN,
          }}
          hint={`Max amount: ${formatToken(
            balance.TEMPLE,
            TICKER_SYMBOL.TEMPLE_TOKEN
          )}`}
          handleChange={handleInputChange}
          onHintClick={handleHintClick}
          value={inputValue}
          isNumber
          placeholder="0.00"
          min={0}
          width={isPhoneOrAbove ? '100%' : '285px'}
          valueFontSize="36px"
          valueLineHeight="67px"
        />
      </BodyContainer>
      {/* <ReceiveAmountContainer> // Hidden per PB
        <TempleGoldIcon />
        <ContentReceive>
          <ReceiveText>You will receive</ReceiveText>
          <ReceiveAmount>1,618 TGLD</ReceiveAmount>
        </ContentReceive>
      </ReceiveAmountContainer> */}
      <WarningMessage>
        <Message>
          <LargeRoundCheckBox
            checked={isCheckboxChecked1}
            onToggle={handleCheckboxToggle1}
          />
          <TextMessage>
            TGLD is non-transferrable but can be cross-chain{' '}
            {isPhoneOrAbove && <br />}
            transferred to the same address. For multisigs,{' '}
            <a
              target="_blank"
              rel="noreferrer"
              href="https://docs.templedao.link/spice-bazaar"
            >
              read more.
            </a>
          </TextMessage>
        </Message>
        <Message>
          <LargeRoundCheckBox
            checked={isCheckboxChecked2}
            onToggle={handleCheckboxToggle2}
          />
          Once submitted, stakes cannot be withdrawn or canceled{' '}
          {isPhoneOrAbove && <br />}
          and your staked TEMPLE tokens will be locked for 7 days{' '}
          {isPhoneOrAbove && <br />}
          before they can be unstaked.
        </Message>
      </WarningMessage>
      <TradeButton
        style={{ whiteSpace: 'nowrap', marginTop: 0 }}
        onClick={async () => {
          await stakeTemple(inputValue);
          setInputValue('');
          setIsCheckboxChecked1(false);
          setIsCheckboxChecked2(false);
        }}
        disabled={!inputValue || !isCheckboxChecked1 || !isCheckboxChecked2}
      >
        SUBMIT
      </TradeButton>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 10px 32px 10px;
  gap: 24px;
`;

const AvailableAmountContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0px 24px 0px 24px;
  gap: 15px;

  ${breakpoints.phoneAndAbove(`
    width: 450px;
  `)}
`;

const StakeTempleIcon = styled(stakeTemple)``;

const AvailableAmountText = styled.div`
  display: flex;
  flex-direction: column;
`;

const AvailableAmount = styled.h3`
  font-size: 28px;
  line-height: 52px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const AvailabilityText = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brand};
`;

const BodyContainer = styled.div`
  display: flex;
  flex-direction: column;
  border-top: 2px solid ${({ theme }) => theme.palette.brand};
  border-bottom: 2px solid ${({ theme }) => theme.palette.brand};
  background: ${({ theme }) => theme.palette.gradients.grey};
  padding: 24px;
  gap: 8px;

  ${breakpoints.phoneAndAbove(`
    width: 450px;
  `)}
`;
const TitleStake = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ReceiveAmountContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  padding: 16px 25px 16px 0px;
  width: 236px;
`;

const TempleGoldIcon = styled(templeGold)``;

const ContentReceive = styled.div`
  display: flex;
  flex-direction: column;
`;

const ReceiveText = styled.div`
  font-size: 18px;
  line-height: 21px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ReceiveAmount = styled.h3`
  font-size: 28px;
  line-height: 52px;
  color: ${({ theme }) => theme.palette.gold};
  margin: 0px;
`;

const Message = styled.div`
  display: flex;
  flex-direction: row;
  gap: 10px;

  a {
    color: ${({ theme }) => theme.palette.brandLight};
    font-weight: 700;
    text-decoration: underline;
    font-size: 13px;
    line-height: 20px;
  }
`;

const TextMessage = styled.div`
  display: inline;
  line-height: 20px;
  white-space: pre-wrap;
`;

const WarningMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border: 2px solid transparent;
  border-image-source: linear-gradient(
    180deg,
    rgba(149, 97, 63, 0.1) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  border-image-slice: 1;
  border-radius: 6px;
  padding: 10px 0px 10px 10px;
  gap: 10px;
  background: #24272c;
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;

  ${breakpoints.phoneAndAbove(`
    width: 436px;
  `)}
`;

export const TradeButton = styled(Button)`
  padding: 12px 20px 12px 20px;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: linear-gradient(90deg, #58321a 20%, #95613f 84.5%);
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px 0px #de5c0666;
  border-radius: 10px;
  font-size: 16px;
  line-height: 20px;
  font-weight: 700;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;
