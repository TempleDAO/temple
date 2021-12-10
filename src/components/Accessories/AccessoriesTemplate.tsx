import React from 'react';
import { transparentize } from 'polished';
import styled from 'styled-components';
import AccessoriesItem from './AccessoriesItem';
import { Flex } from 'components/Layout/Flex';
import profileBackground from 'assets/images/profile-background.png';

interface AccessoriesTemplateProps {
  enclave: string;
}

const AccessoriesTemplate = ({ enclave }: AccessoriesTemplateProps) => {
  return (
    <Flex
      layout={{
        kind: 'container',
        direction: 'column',
      }}
    >
      <Container enclave={enclave}>
        <ItemWrapper top="8%" left="50%">
          <AccessoriesItem />
        </ItemWrapper>
        <ItemWrapper top="21%" left="50%">
          <AccessoriesItem />
        </ItemWrapper>
        <ItemWrapper top="32%" left="50%">
          <AccessoriesItem />
        </ItemWrapper>
        <ItemWrapper top="43%" left="50%">
          <AccessoriesItem />
        </ItemWrapper>
        <ItemWrapper top="80%" left="50%">
          <AccessoriesItem />
        </ItemWrapper>
        <ItemWrapper top="38%" left="22%">
          <AccessoriesItem />
        </ItemWrapper>
        <ItemWrapper top="38%" left="78%">
          <AccessoriesItem />
        </ItemWrapper>
      </Container>
    </Flex>
  );
};

const Container = styled.div`
  position: relative;
  width: 100%;
  padding-bottom: calc(100% - 2rem);
  border-radius: 50%;
  background-color: ${(props) => props.theme.palette.dark};
  background-image: linear-gradient(
      ${(props) =>
        transparentize(
          0.95,
          props.enclave
            ? props.theme.palette.enclave[props.enclave]
            : props.theme.palette.dark
        )},
      ${(props) =>
        transparentize(
          0.75,
          props.enclave
            ? props.theme.palette.enclave[props.enclave]
            : props.theme.palette.dark
        )}
    ),
    url('${profileBackground}');
  background-size: cover;
  border: 1rem solid ${(props) => props.theme.palette.dark};
`;

const ItemWrapper = styled.div`
  position: absolute;
  top: ${(props) => props.top || '0'};
  left: ${(props) => props.left || '0'};
  width: calc((100% - 8rem) / 8);
  margin-left: calc((100% - 8rem) / -16);
`;

export default AccessoriesTemplate;
