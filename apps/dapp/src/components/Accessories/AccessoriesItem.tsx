import React from 'react';
import styled from 'styled-components';

const LootItem = () => {
  return <Container></Container>;
};

const Container = styled.div`
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  border: 1px solid ${(props) => props.theme.palette.brand75};
  background-color: ${(props) => props.theme.palette.dark75};
`;

export default LootItem;
