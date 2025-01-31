import { useState } from 'react';
import styled from 'styled-components';
import { TradeButton } from './Stake';
import stakeTemple from 'assets/icons/stake-temple.svg?react';
import info from 'assets/icons/info.svg?react';
import { Input } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Input';
import LargeRoundCheckBox from 'components/Pages/Core/DappPages/SpiceBazaar/components/LargeRoundCheckBox';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import { formatNumberWithCommas } from 'utils/formatter';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';
import Loader from 'components/Loader/Loader';
import { useUnstakeTime } from 'hooks/spicebazaar/use-unstake-time';

export const Unstake = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });

  const {
    stakePageMetrics,
    staking: { unstakeTemple },
  } = useSpiceBazaar();

  const { isLoading, countdown, shouldShowCountdown } = useUnstakeTime();

  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);
  const handleCheckboxToggle = (checked: boolean) => {
    setIsCheckboxChecked(checked);
  };

  const handleHintClick = () => {
    const amount =
      stakePageMetrics.data.yourStake === 0
        ? ''
        : String(stakePageMetrics.data.yourStake);
    setInputValue(amount);
  };

  const [inputValue, setInputValue] = useState('');

  const handleInputChange = async (value: string) => {
    setInputValue(value);
  };

  return (
    <>
      {shouldShowCountdown && countdown && (
        <WarningMessage>
          <InfoIcon />
          TIME UNTIL YOU CAN UNSTAKE: {!isPhoneOrAbove && <br />}
          {countdown.days}d {countdown.hours}h {countdown.minutes}m{' '}
          {countdown.seconds}s
        </WarningMessage>
      )}
      <PageContainer>
        <StakedAmountContainer>
          {isLoading ? (
            <Loader iconSize={32} />
          ) : (
            <>
              <StakedTempleIcon />
              <StakedAmountText>
                <StakedAmount>
                  {formatNumberWithCommas(stakePageMetrics.data.yourStake)}{' '}
                  TEMPLE
                </StakedAmount>
                <StakedText>STAKED</StakedText>
              </StakedAmountText>
            </>
          )}
        </StakedAmountContainer>
        <BodyContainer>
          <TitleUnstake>Amount to unstake</TitleUnstake>
          <Input
            crypto={{
              kind: 'value',
              value: TICKER_SYMBOL.TEMPLE_TOKEN,
            }}
            hint={`Max amount: ${formatNumberWithCommas(
              stakePageMetrics.data.yourStake
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
            disabled={shouldShowCountdown}
          />
        </BodyContainer>
        <ButtonContainer>
          <Message>
            <LargeRoundCheckBox
              checked={isCheckboxChecked}
              onToggle={handleCheckboxToggle}
              disabled={shouldShowCountdown}
            >
              Claim my earned TGLD
            </LargeRoundCheckBox>
          </Message>
          {isLoading ? (
            <LoaderContainer>
              <Loader iconSize={32} />
            </LoaderContainer>
          ) : (
            <TradeButton
              style={{ whiteSpace: 'nowrap', marginTop: '0px' }}
              onClick={async () => {
                await unstakeTemple(inputValue, isCheckboxChecked);
                setInputValue('');
                setIsCheckboxChecked(false);
              }}
              disabled={shouldShowCountdown || !inputValue}
            >
              UNSTAKE
            </TradeButton>
          )}
        </ButtonContainer>
      </PageContainer>
    </>
  );
};

const WarningMessage = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  // align-items: center;
  width: 85%;
  gap: 10px;
  background: #9d4124;
  border-radius: 6px;
  border: 2px solid;
  border-image-source: linear-gradient(
    180deg,
    rgba(149, 97, 63, 0.1) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  padding: 10px 0px 10px 10px;
  margin-top: 32px;
  font-size: 13px;
  line-height: 20px;
  font-weight: 700;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const InfoIcon = styled(info)`
  width: 16px;
  height: 16px;
`;

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 10px 32px 10px;
  gap: 24px;
`;

const StakedAmountContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0px 24px 0px 24px;
  gap: 15px;

  ${breakpoints.phoneAndAbove(`
    width: 450px;
  `)}
`;

const StakedTempleIcon = styled(stakeTemple)``;

const StakedAmountText = styled.div`
  display: flex;
  flex-direction: column;
`;

const StakedAmount = styled.h3`
  font-size: 28px;
  line-height: 52px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const StakedText = styled.div`
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

const TitleUnstake = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
`;

const Message = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  width: 436px;
  gap: 10px;
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
`;

const LoaderContainer = styled.div`
  height: 43px; // Match the height of the TradeButton
  display: flex;
  align-items: center;
  justify-content: center;
`;
