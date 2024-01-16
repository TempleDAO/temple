import { Button } from 'components/Button/Button';
import { DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';
import { formatNumber } from 'utils/formatter';
import { useTokenContractAllowance } from 'hooks/core/use-token-contract-allowance';

import { FormToken } from '../types';
import { Input } from 'components/Pages/Core/NewUI/HomeInput';

interface Props {
  userBalance?: DecimalBigNumber;
  onHintClick: () => void;
  value: string;
  handleChange: (value: string) => void;
  token: FormToken;
  vaultAddress: string;
}

export const AdminCryptoInput = ({
  userBalance = DBN_ZERO,
  onHintClick,
  value,
  handleChange,
  token,
  vaultAddress,
}: Props) => {
  const [{ allowance, isLoading }, increaseAllowance] =
    useTokenContractAllowance(token, vaultAddress);
  return (
    <>
      <Input
        isNumber
        crypto={{ kind: 'value', value: token.symbol || '' }}
        hint={`Balance: ${formatNumber(userBalance.formatUnits())}`}
        onHintClick={onHintClick}
        value={value}
        disabled={allowance === 0}
        handleChange={(value) => {
          const stringValue = value.toString();
          const isZero =
            !stringValue.startsWith('.') && Number(stringValue) === 0;
          handleChange(isZero ? '' : stringValue);
        }}
      />
      {allowance === 0 && (
        <Button
          isSmall
          autoWidth
          loading={isLoading}
          label={`Increase ${token.name} Allowance`}
          onClick={increaseAllowance}
        />
      )}
    </>
  );
};
