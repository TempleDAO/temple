import React from 'react';
import styled from 'styled-components';

interface ProfileMetricProps {
  label: string;
  value: string;
  detail?: string;
}

const ProfileMetric = ({ label, value, detail }: ProfileMetricProps) => {
  return (
    <Container>
      <Label>{label.toUpperCase()}</Label>
      <Value>{value}</Value>
      {detail ? <Detail>{detail}</Detail> : null}
    </Container>
  );
};

const Label = styled.div`
  color: ${(props) => props.theme.palette.brand};
  font-size: 0.8rem;
  font-weight: 900;
`;

const Value = styled.div`
  color: ${(props) => props.theme.palette.light};
  font-size: 1.2rem;
  margin: 0.25em 0;
`;

const Detail = styled.div`
  color: ${(props) => props.theme.palette.light};
`;

const Container = styled.div`
  margin: 1rem;
  display: inline-block;
`;

export default ProfileMetric;
