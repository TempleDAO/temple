import { useState } from 'react';
import styled from 'styled-components';

import { Input } from 'components/Input/Input';
import { Popover } from 'components/Popover';
import Tooltip from 'components/Tooltip/Tooltip';

import { limitInput, handleBlur } from './utils';

export interface TransactionSettings {
  slippageTolerance: number;
  deadlineMinutes: number;
}

interface IProps {
  isOpen: boolean;
  onClose: () => void;
  onChange: (settings: TransactionSettings) => void;
  defaultSlippage?: number;
  minSlippage?: number;
  maxSlippage?: number;
  defaultDeadline?: number;
  minDeadline?: number;
  maxDeadline?: number;
}

export const TransactionSettingsModal: React.FC<IProps> = ({
  isOpen,
  onClose,
  onChange,
  defaultSlippage = 0.5,
  minSlippage = 0.1,
  maxSlippage = 100,
  defaultDeadline = 20,
  minDeadline = 3,
  maxDeadline = 9999,
}) => {
  const [slippage, setSlippage] = useState<number | ''>(defaultSlippage);
  const [deadline, setDeadline] = useState<number | ''>(defaultDeadline);

  const tooltipContent = (
    <TooltipContent>
      <h5>Slippage Tolerance</h5>
      <p>Your transaction will revert if the price changes more than this percentage value.</p>
      <h5>Deadline</h5>
      <p>Your transaction will revert if it remains pending longer than this time.</p>
    </TooltipContent>
  );

  return (
    <Popover isOpen={isOpen} onClose={onClose} closeOnClickOutside showCloseButton>
      <Header>
        <h4>Transaction Settings</h4>
        <Tooltip content={tooltipContent}>
          <h4>
            <small>ⓘ</small>
          </h4>
        </Tooltip>
      </Header>
      <Input
        crypto={{ kind: 'value', value: 'SLIPPAGE' }}
        hint="DEFAULT"
        placeholder="0"
        onHintClick={() => {
          setSlippage(defaultSlippage);
          onChange({
            slippageTolerance: defaultSlippage,
            deadlineMinutes: Number(deadline),
          });
        }}
        min={0}
        max={100}
        value={slippage}
        type={'number'}
        isNumber
        onChange={(e) => {
          const value = limitInput(e.target.value);
          setSlippage(value);
        }}
        onBlur={() => {
          const value = handleBlur(Number(slippage), minSlippage, maxSlippage, defaultSlippage);
          setSlippage(value);
          onChange({
            slippageTolerance: value,
            deadlineMinutes: Number(deadline),
          });
        }}
        small
        suffix={'%'}
      />
      <br />
      <Input
        crypto={{ kind: 'value', value: 'DEADLINE' }}
        hint="DEFAULT"
        onHintClick={() => {
          setDeadline(defaultDeadline);
          onChange({
            slippageTolerance: Number(slippage),
            deadlineMinutes: defaultDeadline,
          });
        }}
        type={'number'}
        isNumber
        min={0}
        value={deadline}
        onChange={(e) => {
          const value = limitInput(e.target.value);
          setDeadline(value);
        }}
        onBlur={() => {
          const value = handleBlur(Number(deadline), minDeadline, maxDeadline, defaultDeadline);
          setDeadline(value);
          onChange({
            slippageTolerance: Number(slippage),
            deadlineMinutes: value,
          });
        }}
        small
        suffix={'m'}
      />
    </Popover>
  );
};

const Header = styled.div`
  width: 100%;
  display: flex;
  h4 {
    margin: 0 0 1.5rem;
    line-height: 1rem;
    small {
      margin: 0 1rem;
    }
  }
`;

const TooltipContent = styled.div`
  * {
    color: ${({ theme }) => theme.palette.brandLight};
  }
  h5 {
    margin: 0.25rem 0 0 0;
    line-height: 1rem;
    font-size: ${({ theme }) => theme.typography.body};
  }
  p {
    font-size: ${({ theme }) => theme.typography.meta};
  }
`;
