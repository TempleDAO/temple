import React, { FC } from 'react';
import styled from 'styled-components';

interface CardProps {
  label: string;
  value: string;
}

export const Card: FC<CardProps> = ({ label, value }) => {
  return (
    <Container>
      <Label>{label}</Label>
      <Value>{value}</Value>
    </Container>
  );
};

const Container = styled.div`
  border: 1px solid #bd7b4f;

  display: flex;

  justify-content: space-between;
  padding: 0.9375rem;

  width: 14.6875rem;
  height: 3.5rem;

  color: #bd7b4f;
  text-transform: uppercase;
  line-height: 1.125rem;
  font-size: 1.2rem;
  font-family: Megant;
  font-weight: 400;
`;

const Label = styled.div``;
const Value = styled.div``;
