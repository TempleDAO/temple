import { Popover } from 'components/Popover';
import styled from 'styled-components';
import leftCaret from 'assets/images/newui-images/leftCaret.svg';
import { TradeButton } from '../Home';
import { useEffect, useState } from 'react';
import { Input } from '../HomeInput';
import { formatToken } from 'utils/formatter';
import { ZERO, fromAtto } from 'utils/bigNumber';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { useWallet } from 'providers/WalletProvider';
import { TempleLineOfCredit__factory } from 'types/typechain';
import env from 'constants/env';
import { getBigNumberFromString, getTokenInfo } from 'components/Vault/utils';
import { ITlcDataTypes } from 'types/typechain/contracts/interfaces/v2/templeLineOfCredit/ITempleLineOfCredit';
import { BigNumber } from 'ethers';
import { useNotification } from 'providers/NotificationProvider';
import { ERC20__factory } from 'types/typechain/typechain';
import Supply from './Supply';
import Withdraw from './Withdraw';
import Borrow from './Borrow';
import Repay from './Repay';
import Overview from './Overview';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}

export type Screen = 'overview' | 'supply' | 'withdraw' | 'borrow' | 'repay';

export type State = {
  supplyValue: string;
  withdrawValue: string;
  borrowValue: string;
  repayValue: string;
  inputToken: TICKER_SYMBOL;
  outputToken: TICKER_SYMBOL;
  inputTokenBalance: BigNumber;
  outputTokenBalance: BigNumber;
};

export const MAX_LTV = 75;

export const TLCModal: React.FC<IProps> = ({ isOpen, onClose }) => {
  const { balance, wallet, updateBalance, signer, ensureAllowance } = useWallet();
  const { openNotification } = useNotification();
  const [screen, setScreen] = useState<Screen>('overview');
  const [state, setState] = useState<State>({
    supplyValue: '',
    withdrawValue: '',
    borrowValue: '',
    repayValue: '',
    inputToken: TICKER_SYMBOL.TEMPLE_TOKEN,
    outputToken: TICKER_SYMBOL.DAI,
    inputTokenBalance: ZERO,
    outputTokenBalance: ZERO,
  });
  const [progress, setProgress] = useState(0);
  const [accountPosition, setAccountPosition] = useState<ITlcDataTypes.AccountPositionStructOutput>();
  const [minBorrow, setMinBorrow] = useState<BigNumber>();
  const [borrowRate, setBorrowRate] = useState<BigNumber>();

  useEffect(() => {
    const onMount = async () => {
      await updateBalance();
      await updateAccountPosition();
    };
    onMount();
  }, [signer]);

  // Update token balances
  useEffect(() => {
    setState({
      ...state,
      inputTokenBalance: balance.TEMPLE,
      outputTokenBalance: balance.DAI,
    });
  }, [balance]);

  const updateAccountPosition = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const position = await tlcContract.accountPosition(wallet);
    const min = await tlcContract.MIN_BORROW_AMOUNT();
    const debtInfo = await tlcContract.totalDebtPosition();
    const rate = debtInfo.borrowRate;
    setAccountPosition(position);
    setMinBorrow(min);
    setBorrowRate(rate);
  };

  const supply = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.supplyValue, getTokenInfo(state.inputToken).decimals);

    // Ensure allowance for TLC to spend TEMPLE
    const templeContract = new ERC20__factory(signer).attach(env.contracts.temple);
    await ensureAllowance(TICKER_SYMBOL.TEMPLE_TOKEN, templeContract, env.contracts.tlc, amount);

    const tx = await tlcContract.addCollateral(amount, wallet);
    const receipt = await tx.wait();
    openNotification({
      title: `Supplied ${state.supplyValue} TEMPLE`,
      hash: receipt.transactionHash,
    });
    updateBalance();
    updateAccountPosition();
  };

  const withdraw = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.withdrawValue, getTokenInfo(state.inputToken).decimals);
    const tx = await tlcContract.removeCollateral(amount, wallet);
    const receipt = await tx.wait();
    openNotification({
      title: `Withdrew ${state.withdrawValue} TEMPLE`,
      hash: receipt.transactionHash,
    });
    updateBalance();
    updateAccountPosition();
  };

  const borrow = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.borrowValue, getTokenInfo(state.outputToken).decimals);
    try {
      const tx = await tlcContract.borrow(amount, wallet, { gasLimit: 300000 });
      const receipt = await tx.wait();
      openNotification({
        title: `Borrowed ${state.borrowValue} DAI`,
        hash: receipt.transactionHash,
      });
      updateBalance();
      updateAccountPosition();
    } catch (e) {
      console.log(e);
    }
  };

  const repay = async () => {
    if (!signer || !wallet) return;
    const tlcContract = new TempleLineOfCredit__factory(signer).attach(env.contracts.tlc);
    const amount = getBigNumberFromString(state.repayValue, getTokenInfo(state.outputToken).decimals);

    // Ensure allowance for TLC to spend DAI
    const daiContract = new ERC20__factory(signer).attach(env.contracts.dai);
    await ensureAllowance(TICKER_SYMBOL.DAI, daiContract, env.contracts.tlc, amount);

    const tx = await tlcContract.repay(amount, wallet, { gasLimit: 200000 });
    const receipt = await tx.wait();
    openNotification({
      title: `Repaid ${state.repayValue} DAI`,
      hash: receipt.transactionHash,
    });
    updateBalance();
    updateAccountPosition();
  };

  return (
    <>
      <Popover isOpen={isOpen} onClose={onClose} closeOnClickOutside showCloseButton>
        <ModalContainer>
          {screen === 'supply' ? (
            <Supply
              accountPosition={accountPosition}
              state={state}
              setState={setState}
              supply={supply}
              back={() => setScreen('overview')}
            />
          ) : screen === 'withdraw' ? (
            <Withdraw
              accountPosition={accountPosition}
              state={state}
              setState={setState}
              withdraw={withdraw}
              back={() => setScreen('overview')}
            />
          ) : screen === 'borrow' ? (
            <Borrow
              accountPosition={accountPosition}
              state={state}
              borrowRate={borrowRate}
              minBorrow={minBorrow}
              setState={setState}
              borrow={borrow}
              back={() => setScreen('overview')}
            />
          ) : screen === 'repay' ? (
            <Repay
              accountPosition={accountPosition}
              state={state}
              setState={setState}
              repay={repay}
              back={() => setScreen('overview')}
            />
          ) : (
            <Overview accountPosition={accountPosition} state={state} borrowRate={borrowRate} setScreen={setScreen} />
          )}
        </ModalContainer>
      </Popover>
    </>
  );
};

// Overview Styles
const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  color: ${({ theme }) => theme.palette.brand};
  width: 350px;
`;

export const RemoveMargin = styled.div`
  margin-top: -25px;
`;

export const BackButton = styled.img`
  width: 0.75rem;
  cursor: pointer;
  position: absolute;
  top: 1.25rem;
  left: 1rem;
`;

export const Title = styled.div`
  font-size: 1.5rem;
  padding-bottom: 1rem;
  padding-top: 1rem;
  margin-bottom: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
  background: linear-gradient(
    90deg,
    rgba(196, 196, 196, 0) 0.49%,
    rgba(89, 89, 89, 0.48) 50.04%,
    rgba(196, 196, 196, 0) 100%
  );
`;

export const Copy = styled.p`
  color: ${({ theme }) => theme.palette.brandLight};
  letter-spacing: 0.05rem;
  font-size: 0.9rem;
`;

export const MarginTop = styled.div`
  margin-top: 1rem;
`;

export const FlexBetween = styled.div`
  display: flex;
  justify-content: space-between;
  color: ${({ theme }) => theme.palette.brandLight};

  p {
    font-size: 1rem;
    margin: 0.5rem 0;
  }
`;

const BrandParagraph = styled.p`
  color: ${({ theme }) => theme.palette.brand};
`;

// Supply styles
export const RangeLabel = styled.div`
  margin-bottom: 0.6rem;
  text-align: left;
  font-size: 0.8rem;
  letter-spacing: 0.075rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

export const RangeSlider = styled.input.attrs({ type: 'range' })<{ progress: number }>`
  -webkit-appearance: none;
  width: 100%;
  height: 0.5rem;
  background: ${({ theme }) => theme.palette.brandLight};
  outline: none;
  border-radius: 1rem;
  margin-bottom: 0.4rem;

  // Progress style with brand and brandLight
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.palette.brand} ${({ progress }) => progress}%,
    ${({ theme }) => theme.palette.brandLight} ${({ progress }) => progress}%
  );
  transition: background 0.2s ease-in-out;

  // Thumb styles
  ::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.palette.brand};
    cursor: pointer;
  }
  ::-moz-range-thumb {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.palette.brand};
    cursor: pointer;
  }
`;

export const GradientContainer = styled.div`
  background: linear-gradient(
    90deg,
    rgba(196, 196, 196, 0) 0.49%,
    rgba(89, 89, 89, 0.48) 50.04%,
    rgba(196, 196, 196, 0) 100%
  );
  border-top: 1px solid ${({ theme }) => theme.palette.brand};
  border-bottom: 1px solid ${({ theme }) => theme.palette.brand};
  padding: 0.5rem 0;
  margin: 1rem 0;
`;

export const Warning = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  text-align: left;
  gap: 0.5rem;
  p {
    font-size: 0.8rem;
  }
  margin-bottom: -1rem;
`;

export const InfoCircle = styled.div`
  margin: 0.25rem;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.palette.brand};
`;

export default TLCModal;