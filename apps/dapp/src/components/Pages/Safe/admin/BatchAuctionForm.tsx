import styled from 'styled-components';
import { useState } from 'react';
import { InputSelect, Option } from 'components/InputSelect/InputSelect';
import { Button } from 'components/Button/Button';
import env from 'constants/env';
import { getAppConfig } from 'constants/newenv';
import { SpiceAuction__factory } from 'types/typechain/factories/contracts/templegold/SpiceAuction__factory';
import { ERC20__factory } from 'types/typechain/factories/@openzeppelin/contracts/token/ERC20/ERC20__factory';
import { useSafeTransactions } from 'safe/safeContext';
import { OperationType } from '@safe-global/safe-core-sdk-types';
import { useNotification } from 'providers/NotificationProvider';
import { useWallet } from 'providers/WalletProvider';
import { parseUnits } from 'ethers/lib/utils';

// Get auction options from app config
const getAuctionOptions = (): Option[] => {
  const spiceAuctions = getAppConfig().spiceBazaar.spiceAuctions || [];
  if (spiceAuctions.length === 0) {
    return [{ label: 'No auctions available', value: '' }];
  }
  return spiceAuctions.map((auction) => ({
    label: `TGLD/${auction.auctionTokenSymbol}`,
    value: auction.contractConfig.address,
  }));
};

const AUCTION_OPTIONS = getAuctionOptions();

// Bid token options - currently only TGLD
// TODO: In the future, derive from auction config
const BID_TOKEN_OPTIONS: Option[] = [{ label: 'TGLD', value: 'tgld' }];

type TabType = 'config' | 'fund';

export const BatchAuctionForm = () => {
  const [activeTab, setActiveTab] = useState<TabType>('config');
  const { proposeTransaction } = useSafeTransactions();
  const { openNotification } = useNotification();
  const { wallet } = useWallet();

  // Config
  const configWallet = env.spiceAuctionAdmin.multisigAddress;
  const fundWallet = env.spiceAuctionAdmin.cosechaSegundaAddress;
  const recipientWallet = env.spiceAuctionAdmin.defaultRecipientAddress;
  const auctionAddress = env.spiceAuctionAdmin.auctionAddress;
  const templeGoldAddress = env.spiceAuctionAdmin.templeGoldAddress;

  // Config form state
  const [duration, setDuration] = useState<string>('');
  const [waitPeriod, setWaitPeriod] = useState<string>('');
  const [minimumDistributedAmount, setMinimumDistributedAmount] =
    useState<string>('');
  const isTempleGoldAuctionToken = false;

  // Funding form state
  const [tokenAmount, setTokenAmount] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');

  const handleCreateBatch = async () => {
    if (!proposeTransaction) {
      openNotification({
        title: 'Please connect your wallet',
        hash: '',
        isError: true,
      });
      return;
    }

    try {
      const spiceAuctionInterface = SpiceAuction__factory.createInterface();
      const erc20Interface = ERC20__factory.createInterface();

      if (activeTab === 'config') {
        // Encode setAuctionConfig call
        const configData = spiceAuctionInterface.encodeFunctionData(
          'setAuctionConfig',
          [
            {
              duration: Number(duration),
              waitPeriod: Number(waitPeriod),
              minimumDistributedAuctionToken: parseUnits(
                minimumDistributedAmount,
                18
              ).toString(),
              isTempleGoldAuctionToken: false,
              recipient: recipientWallet,
            },
          ]
        );

        await proposeTransaction(
          [
            {
              to: auctionAddress,
              value: '0',
              data: configData,
              operation: OperationType.Call,
            },
          ],
          configWallet
        );

        openNotification({
          title: 'Auction config transaction proposed',
          hash: '',
        });
      } else {
        // Fund tab - encode approve + fundNextAuction
        const bidTokenAddress = templeGoldAddress;
        const amountWei = parseUnits(tokenAmount, 18).toString();
        const startTimeUnix = Math.floor(new Date(startTime).getTime() / 1000);

        // Approve transaction
        const approveData = erc20Interface.encodeFunctionData('approve', [
          auctionAddress,
          amountWei,
        ]);

        // Fund auction transaction
        const fundData = spiceAuctionInterface.encodeFunctionData(
          'fundNextAuction',
          [amountWei, startTimeUnix]
        );

        await proposeTransaction(
          [
            {
              to: bidTokenAddress,
              value: '0',
              data: approveData,
              operation: OperationType.Call,
            },
            {
              to: auctionAddress,
              value: '0',
              data: fundData,
              operation: OperationType.Call,
            },
          ],
          fundWallet
        );

        openNotification({
          title: 'Approve & fund transaction proposed',
          hash: '',
        });
      }
    } catch (error) {
      console.error('Error proposing transaction:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      openNotification({
        title: `Error proposing transaction: ${errorMessage}`,
        hash: '',
        isError: true,
      });
    }
  };

  const renderConfigTab = () => {
    // Convert minimum amount to wei for preview
    const minAmountWei = minimumDistributedAmount
      ? parseUnits(minimumDistributedAmount, 18).toString()
      : '0';

    return (
      <TabContent>
        <FormRow>
          <Label>Wallet Address</Label>
          <StaticField>
            <StaticFieldLabel>Executor Multisig</StaticFieldLabel>
            <StaticFieldValue>{configWallet}</StaticFieldValue>
          </StaticField>
        </FormRow>

        <FormRow>
          <Label>Auction Contract</Label>
          <StaticField>
            <StaticFieldLabel>ENA Auction</StaticFieldLabel>
            <StaticFieldValue>{auctionAddress}</StaticFieldValue>
          </StaticField>
        </FormRow>

        <FormRowDouble>
          <FormRow>
            <Label>Duration (seconds)</Label>
            <Input
              type="number"
              placeholder="e.g., 86400"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </FormRow>

          <FormRow>
            <Label>Wait Period (seconds)</Label>
            <Input
              type="number"
              placeholder="e.g., 3600"
              value={waitPeriod}
              onChange={(e) => setWaitPeriod(e.target.value)}
            />
          </FormRow>
        </FormRowDouble>

        <FormRow>
          <Label>Minimum Distributed Amount (in tokens)</Label>
          <Input
            type="number"
            placeholder="e.g., 100"
            value={minimumDistributedAmount}
            onChange={(e) => setMinimumDistributedAmount(e.target.value)}
          />
        </FormRow>

        <FormRow>
          <Label>Recipient Address</Label>
          <StaticField>
            <StaticFieldLabel>Overlord Bot</StaticFieldLabel>
            <StaticFieldValue>{recipientWallet}</StaticFieldValue>
          </StaticField>
        </FormRow>

        <PreviewBox>
          <PreviewTitle>Preview</PreviewTitle>
          <WalletInfo>
            Wallet: Executor Multisig ({configWallet.slice(0, 8)}...
            {configWallet.slice(-6)})
          </WalletInfo>
          <PreviewItem>
            1. setAuctionConfig({`{`}
            duration: {duration || '0'}, waitPeriod: {waitPeriod || '0'},
            minAmount: {minAmountWei}, isTGLD:{' '}
            {isTempleGoldAuctionToken.toString()}, recipient: {recipientWallet}
            {`}`})
          </PreviewItem>
        </PreviewBox>

        <ButtonContainer>
          <Button
            label="Create Batch Transaction"
            onClick={handleCreateBatch}
            isSmall
            disabled={
              !wallet || !duration || !waitPeriod || !minimumDistributedAmount
            }
          />
        </ButtonContainer>
      </TabContent>
    );
  };

  const renderFundTab = () => {
    const amountWei = tokenAmount
      ? parseUnits(tokenAmount, 18).toString()
      : '0';
    const time = startTime
      ? Math.floor(new Date(startTime).getTime() / 1000)
      : 0;
    const isStartTimeInPast = startTime
      ? new Date(startTime) < new Date()
      : false;

    return (
      <TabContent>
        <FormRow>
          <Label>Wallet Address</Label>
          <StaticField>
            <StaticFieldLabel>Cosecha Segunda</StaticFieldLabel>
            <StaticFieldValue>{fundWallet}</StaticFieldValue>
          </StaticField>
        </FormRow>

        <FormRowDouble>
          <FormRow>
            <Label>Auction Contract</Label>
            <StaticField>
              <StaticFieldLabel>ENA Auction</StaticFieldLabel>
              <StaticFieldValue>{auctionAddress}</StaticFieldValue>
            </StaticField>
          </FormRow>

          <FormRow>
            <Label>Bid Token</Label>
            <StaticField>
              <StaticFieldLabel>TGLD</StaticFieldLabel>
              <StaticFieldValue>{templeGoldAddress}</StaticFieldValue>
            </StaticField>
          </FormRow>
        </FormRowDouble>

        <FormRow>
          <Label>Token Amount</Label>
          <Input
            type="text"
            placeholder="Enter amount (e.g., 1000000)"
            value={tokenAmount}
            onChange={(e) => setTokenAmount(e.target.value)}
          />
        </FormRow>

        <FormRow>
          <Label>Start Time</Label>
          <Input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          {isStartTimeInPast && (
            <HelperText style={{ color: 'red' }}>
              Start time must be in the future
            </HelperText>
          )}
        </FormRow>

        <PreviewBox>
          <PreviewTitle>Preview</PreviewTitle>
          <WalletInfo>
            Wallet: Cosecha Segunda ({fundWallet.slice(0, 8)}...
            {fundWallet.slice(-6)})
          </WalletInfo>
          <PreviewItem>1. approve(spiceAuction, {amountWei})</PreviewItem>
          <PreviewItem>
            2. fundNextAuction({amountWei}, {time})
          </PreviewItem>
        </PreviewBox>

        <ButtonContainer>
          <Button
            label="Create Batch Transaction"
            onClick={handleCreateBatch}
            isSmall
            disabled={
              !wallet || !tokenAmount || !startTime || isStartTimeInPast
            }
          />
        </ButtonContainer>
      </TabContent>
    );
  };

  return (
    <Container>
      <TabBar>
        <TabButton
          $active={activeTab === 'config'}
          onClick={() => setActiveTab('config')}
        >
          Set Auction Config
        </TabButton>
        <TabButton
          $active={activeTab === 'fund'}
          onClick={() => setActiveTab('fund')}
        >
          Approve and Fund
        </TabButton>
      </TabBar>

      {activeTab === 'config' && renderConfigTab()}
      {activeTab === 'fund' && renderFundTab()}
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Title = styled.h3`
  color: ${({ theme }) => theme.palette.brand};
  font-size: 1.1rem;
  margin: 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
`;

const TabBar = styled.div`
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid ${({ theme }) => theme.palette.brandDark};
  margin-top: 0.5rem;
`;

const TabButton = styled.button<{ $active: boolean }>`
  background: ${({ theme, $active }) =>
    $active ? theme.palette.brand : 'transparent'};
  color: ${({ theme, $active }) =>
    $active ? theme.palette.dark : theme.palette.brandLight};
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 0.9rem;
  font-weight: ${({ $active }) => ($active ? 'bold' : 'normal')};
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  transition: all 0.2s;

  &:hover {
    background: ${({ theme, $active }) =>
      $active ? theme.palette.brand : theme.palette.brandDark};
  }
`;

const TabContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 0;
`;

const FormRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FormRowDouble = styled.div`
  display: flex;
  gap: 1rem;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const Label = styled.label`
  font-weight: bold;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 0.9rem;
`;

const Input = styled.input`
  padding: 0.75rem;
  background: ${({ theme }) => theme.palette.dark};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  color: ${({ theme }) => theme.palette.brandLight};
  border-radius: 4px;
  font-size: 0.9rem;
  max-width: 350px;

  &::placeholder {
    color: ${({ theme }) => theme.palette.brandDark};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.palette.brandLight};
  }
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const CheckboxLabel = styled.label`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 0.9rem;
`;

const PreviewBox = styled.div`
  background: ${({ theme }) => theme.palette.dark};
  border: 1px solid ${({ theme }) => theme.palette.brand};
  border-radius: 4px;
  padding: 1rem;
  margin-top: 0.5rem;
  max-width: 450px;
`;

const PreviewTitle = styled.div`
  font-weight: bold;
  color: ${({ theme }) => theme.palette.brand};
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
`;

const WalletInfo = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: ${({ theme }) => theme.palette.dark75};
  border-radius: 4px;
  border-left: 3px solid ${({ theme }) => theme.palette.brand};
`;

const PreviewItem = styled.div`
  color: ${({ theme }) => theme.palette.brandLight};
  font-family: monospace;
  font-size: 0.85rem;
  padding: 0.25rem 0;
`;

const ButtonContainer = styled.div`
  margin-top: 1rem;
`;

const StaticField = styled.div`
  padding: 0.75rem;
  background: ${({ theme }) =>
    theme.palette.brand25 || `${theme.palette.brand}40`};
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  color: ${({ theme }) => theme.palette.brandLight};
  border-radius: 4px;
  font-size: 0.9rem;
  max-width: 375px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const StaticFieldLabel = styled.span`
  font-weight: bold;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 0.85rem;
`;

const StaticFieldValue = styled.span`
  color: ${({ theme }) => theme.palette.brandLight};
  font-family: monospace;
  font-size: 0.85rem;
`;

const HelperText = styled.span`
  color: ${({ theme }) => theme.palette.brandDark};
  font-size: 0.75rem;
  font-style: italic;
  margin-top: 0.25rem;
`;
