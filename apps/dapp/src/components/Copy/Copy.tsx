import Tooltip from 'components/Tooltip/Tooltip';
import CopyIcon from 'assets/icons/copy.svg?react';
import { theme } from 'styles/theme';

interface CopyProps {
  value: string;
}
export const Copy = ({ value }: CopyProps) => {
  return (
    <Tooltip content={<>Copy</>} position={'top'}>
      <CopyIcon
        fill={theme.palette.brand}
        height={16}
        width={16}
        onClick={() => navigator.clipboard.writeText(value)}
      />
    </Tooltip>
  );
};
