import { useState } from 'react';
import styled from 'styled-components';

import { Input } from 'components/Input/Input';
import { Popover } from 'components/Popover';
import Tooltip from 'components/Tooltip/Tooltip';

import { limitSlippageInput, handleBlur } from './utils';

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
  defaultDeadline?: number;
  minDeadline?: number;
}

export const TransactionSettingsModal: React.FC<IProps> = ({
  isOpen,
  onClose,
  onChange,
  defaultSlippage = 0.5,
  minSlippage = 0.1,
  defaultDeadline = 20,
  minDeadline = 3,
}) => {
  const [slippage, setSlippage] = useState<number>(defaultSlippage);
  const [deadline, setDeadline] = useState(defaultDeadline);

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
        onHintClick={() => {
          setSlippage(defaultSlippage);
          onChange({
            slippageTolerance: defaultSlippage,
            deadlineMinutes: deadline,
          });
        }}
        min={0}
        max={100}
        value={slippage}
        type={'number'}
        placeholder="0"
        isNumber
        onChange={(e) => {
          const value = limitSlippageInput(Number(e.target.value));
          setSlippage(value);
        }}
        onBlur={() => {
          const value = handleBlur(slippage, minSlippage, defaultSlippage);
          setSlippage(value);
          onChange({
            slippageTolerance: value,
            deadlineMinutes: deadline,
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
            slippageTolerance: slippage,
            deadlineMinutes: defaultDeadline,
          });
        }}
        type={'number'}
        isNumber
        min={0}
        value={deadline}
        onChange={(e) => {
          setDeadline(Number(e.target.value));
        }}
        onBlur={() => {
          const value = handleBlur(deadline, minDeadline, defaultDeadline);
          setDeadline(value);
          onChange({
            slippageTolerance: slippage,
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
