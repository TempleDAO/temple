//@ts-nocheck

import React from 'react';
import styled from 'styled-components';

interface ProfileMetricProps {
  label: string;
  value: string;
  fontSize?: number;
  detail?: string;
}

const ProfileMetric = ({
  label,
  value,
  detail,
  fontSize,
}: ProfileMetricProps) => {
  return (
    <Container fontSize={fontSize}>
      <Label>{label.toUpperCase()}</Label>
      <Value>{value}</Value>
      {detail ? <Detail>{detail}</Detail> : null}
    </Container>
  );
};

const Label = styled.div`
  color: ${(props) => props.theme.palette.brand};
  font-size: 0.8em;
  font-weight: 900;
`;

const Value = styled.div`
  color: ${(props) => props.theme.palette.light};
  font-size: 1em;
  margin: 0.25em 0;
`;

const Detail = styled.div`
  color: ${(props) => props.theme.palette.light};
`;

const Container = styled.div`
  margin: 1rem;
  display: inline-block;
  font-size: ${(props) => `${props.fontSize || '1'}`}rem;
`;

export default ProfileMetric;
