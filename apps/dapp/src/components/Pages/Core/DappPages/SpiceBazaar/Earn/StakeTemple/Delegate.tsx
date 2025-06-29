import styled from 'styled-components';
import stakeTemple from 'assets/icons/stake-temple.svg?react';
import { Input } from '../../components/Input';
import * as breakpoints from 'styles/breakpoints';
import { formatNumberWithCommas } from 'utils/formatter';
import { useState, useEffect } from 'react';
import { useWallet } from 'providers/WalletProvider';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import Loader from 'components/Loader/Loader';
import { TradeButton } from './Stake';

export const Delegate = () => {
  const [inputValue, setInputValue] = useState<string>('');
  const [isDelegatingToSelf, setIsDelegatingToSelf] = useState(true);
  const [isDelegating, setIsDelegating] = useState(false);
  const [currentDelegate, setCurrentDelegate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { walletAddress } = useWallet();

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const { stakePageMetrics, staking } = useSpiceBazaar();
  const { delegate, getDelegatedAddress } = staking;

  // Load delegation data when component mounts or wallet changes
  useEffect(() => {
    const loadDelegationData = async () => {
      if (!walletAddress) return;

      setIsLoading(true);
      try {
        const delegatedAddress = await getDelegatedAddress();
        setCurrentDelegate(delegatedAddress);

        // If they haven't delegated yet, default to "yourself"
        if (!delegatedAddress) {
          setIsDelegatingToSelf(true);
        } else if (
          delegatedAddress.toLowerCase() === walletAddress.toLowerCase()
        ) {
          setIsDelegatingToSelf(true);
        } else {
          setIsDelegatingToSelf(false);
          setInputValue(delegatedAddress);
        }
      } catch (error) {
        console.error('Error loading delegation data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDelegationData();
  }, [walletAddress, getDelegatedAddress]);

  const handleInputChange = (value: string) => {
    // Basic cleanup: remove extra spaces and ensure proper format
    const cleanedValue = value.trim();
    setInputValue(cleanedValue);
  };

  const handleDelegateClick = async () => {
    if (!walletAddress) return;

    setIsDelegating(true);
    try {
      let delegateeAddress = walletAddress;

      if (!isDelegatingToSelf && inputValue) {
        delegateeAddress = inputValue;
      }

      await delegate(delegateeAddress);

      // Refresh delegation data after successful delegation
      const newDelegate = await getDelegatedAddress();
      setCurrentDelegate(newDelegate);

      // Reset form state after successful delegation
      if (!newDelegate) {
        // If undelegated (empty delegate), reset to "yourself" option
        setIsDelegatingToSelf(true);
        setInputValue('');
      } else if (newDelegate.toLowerCase() === walletAddress.toLowerCase()) {
        // If delegated to self, set to "yourself" option
        setIsDelegatingToSelf(true);
        setInputValue('');
      } else {
        // If delegated to another address, set to "another address" option
        setIsDelegatingToSelf(false);
        setInputValue(newDelegate);
      }
    } catch (error) {
      console.error('Delegation failed:', error);
    } finally {
      setIsDelegating(false);
    }
  };

  // Helper function to get current selected delegate address
  const getSelectedDelegateAddress = () => {
    if (isDelegatingToSelf) {
      return walletAddress;
    }
    return inputValue;
  };

  // Check if any data is still loading
  const isAnyDataLoading = isLoading || stakePageMetrics.loading;

  // Don't render content until we know the user's stake amount
  if (stakePageMetrics.loading) {
    return (
      <PageContainer>
        <LoaderContainer>
          <Loader iconSize={32} />
        </LoaderContainer>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {stakePageMetrics.data.yourStake > 0 && (
        <>
          <StakedTempleContainer>
            {isLoading ? (
              <Loader iconSize={32} />
            ) : (
              <>
                <StakeTempleIcon />
                <StakedTempleText>
                  <StakedAmount>
                    {formatNumberWithCommas(stakePageMetrics.data.yourStake)}{' '}
                    STAKED TEMPLE
                  </StakedAmount>
                  <StakedStatusText>
                    {currentDelegate
                      ? currentDelegate.toLowerCase() ===
                        walletAddress?.toLowerCase()
                        ? `CURRENTLY DELEGATED TO ${formatAddress(
                            walletAddress || ''
                          )}`
                        : `CURRENTLY DELEGATED TO ${formatAddress(
                            currentDelegate
                          )}`
                      : 'CURRENTLY UNDELEGATED'}
                  </StakedStatusText>
                </StakedTempleText>
              </>
            )}
          </StakedTempleContainer>
          <DelegateContainer>
            <DelegateRights>
              Where would you like to delegate your voting rights?
            </DelegateRights>
            <RadioGroup>
              <RadioOption>
                <RadioInput
                  type="radio"
                  id="yourself"
                  name="delegate"
                  value="yourself"
                  checked={isDelegatingToSelf}
                  onChange={() => setIsDelegatingToSelf(true)}
                />
                <RadioLabel htmlFor="yourself">Yourself</RadioLabel>
              </RadioOption>
              <AnotherAddressContainer>
                <RadioOption>
                  <RadioInput
                    type="radio"
                    id="another"
                    name="delegate"
                    value="another"
                    checked={!isDelegatingToSelf}
                    onChange={() => setIsDelegatingToSelf(false)}
                  />
                  <RadioLabel htmlFor="another">Another address</RadioLabel>
                </RadioOption>
                {!isDelegatingToSelf && (
                  <Input
                    value={inputValue}
                    handleChange={handleInputChange}
                    placeholder={`${formatAddress(walletAddress || '')}`}
                    width="100%"
                  />
                )}
              </AnotherAddressContainer>
            </RadioGroup>
          </DelegateContainer>
          <StakedContainer>
            <StakedAmountContainer>
              <StakeTempleIcon />
              <Staked>
                {formatNumberWithCommas(stakePageMetrics.data.yourStake)} STAKED
                TEMPLE
              </Staked>
            </StakedAmountContainer>
            <StakedTextBottom>
              will be delegated to{' '}
              {!isDelegatingToSelf && inputValue
                ? formatAddress(inputValue)
                : formatAddress(walletAddress || '')}
            </StakedTextBottom>
          </StakedContainer>
          <TradeButton
            style={{
              whiteSpace: 'nowrap',
              marginTop: '0px',
              alignSelf: 'center',
            }}
            onClick={handleDelegateClick}
            loading={isDelegating || isAnyDataLoading}
            disabled={(() => {
              if (!walletAddress) return true;
              if (!isDelegatingToSelf && !inputValue) return true;

              const selectedDelegate = getSelectedDelegateAddress();
              if (
                currentDelegate &&
                selectedDelegate &&
                selectedDelegate.toLowerCase() === currentDelegate.toLowerCase()
              ) {
                return true;
              }

              return false;
            })()}
          >
            {currentDelegate ? 'CHANGE DELEGATE' : 'DELEGATE'}
          </TradeButton>
        </>
      )}
      {stakePageMetrics.data.yourStake === 0 && (
        <>
          <StakedTempleContainer>
            <StakeTempleIcon />
            <StakedTempleText>
              <StakedAmount>
                {formatNumberWithCommas(stakePageMetrics.data.yourStake)} STAKED
                TEMPLE
              </StakedAmount>
              <StakedStatusText>
                YOU CURRENTLY HAVE NO STAKED TEMPLE
              </StakedStatusText>
            </StakedTempleText>
          </StakedTempleContainer>
          <Line></Line>
          <NoStakedTempleText>
            Stake TEMPLE in the ‘Stake’ tab and come back here to delegate your
            voting rights to yourself or to another wallet. All voting rights
            can only be held by one wallet.
          </NoStakedTempleText>
        </>
      )}
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

const StakedTempleContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 450px;
  align-items: center;
  padding: 0px 24px 0px 24px;
  gap: 15px;

  ${breakpoints.phoneAndAbove(`
    width: 450px;
  `)}
`;

const StakeTempleIcon = styled(stakeTemple)``;

const StakedTempleText = styled.div`
  display: flex;
  flex-direction: column;
`;

const StakedStatusText = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brand};
`;

const StakedAmount = styled.h3`
  font-size: 28px;
  line-height: 52px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const DelegateContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  border-top: 2px solid ${({ theme }) => theme.palette.brand};
  border-bottom: 2px solid ${({ theme }) => theme.palette.brand};
  background: ${({ theme }) => theme.palette.gradients.grey};
  padding: 24px;
  gap: 32px;
`;

const DelegateRights = styled.div`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const StakedContainer = styled.div<{ fadeEffect?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 450px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 10px;
  background: ${({ theme }) => theme.palette.black};
  gap: 20px;
  padding: 16px;
  opacity: ${({ fadeEffect }) => (fadeEffect ? 0.5 : 1)};
`;

const StakedAmountContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 15px;
`;

const StakedTextBottom = styled.div`
  font-size: 16px;
  line-height: 19px;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const Staked = styled.h3`
  font-size: 28px;
  line-height: 52px;
  color: ${({ theme }) => theme.palette.brandLight};
  margin: 0px;
`;

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const RadioOption = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const AnotherAddressContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const RadioInput = styled.input`
  appearance: none;
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border: 1px solid ${({ theme }) => theme.palette.brandLight};
  border-radius: 50%;
  background: ${({ theme }) => theme.palette.black};
  cursor: pointer;
  position: relative;
  margin: 0;

  &:checked {
    &::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 10px;
      height: 10px;
      background: ${({ theme }) => theme.palette.brandLight};
      border-radius: 50%;
    }
  }

  &:hover {
    border-color: ${({ theme }) => theme.palette.brand};
  }
`;

const RadioLabel = styled.label`
  font-size: 16px;
  line-height: 19px;
  color: ${({ theme }) => theme.palette.brandLight};
  cursor: pointer;
`;

const Line = styled.div`
  width: 450px;
  height: 2px;
  background: ${({ theme }) => theme.palette.brand};
`;

const LoaderContainer = styled.div`
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const NoStakedTempleText = styled.div`
  width: 450px;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 16px;
  line-height: 19px;

  ${breakpoints.phoneAndAbove(`
    font-size: 18px;
    line-height: 22px;
`)}
`;
