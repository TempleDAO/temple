import { FC } from 'react';
import styled from 'styled-components';

interface Props {
  address: string;
}

const TruncatedAddress = ({ address }: Props) => {
  const start = address.slice(0, 6);
  const end = address.slice(-4);
  return (
    <span>
      {start}...{end}
    </span>
  );
};

export default TruncatedAddress