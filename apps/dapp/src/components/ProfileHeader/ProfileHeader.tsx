//@ts-nocheck

import React from 'react';
import styled from 'styled-components';
import sunImage from 'assets/images/sun-art.svg';
import banner from 'assets/images/profile-header-bg.png';

interface ProfileHeaderProps {
  username?: string;
}

const ProfileHeader = ({ username }: ProfileHeaderProps) => {
  return (
    <Container>
      <Username>{username || 'Profile'}</Username>
      <SemiCircle height={7}>
        <InnerSemiCircle height={6} left={1}>
          <BackgroundSemiCircle height={4} left={2} />
        </InnerSemiCircle>
      </SemiCircle>
    </Container>
  );
};

const Container = styled.div`
  width: 18rem;
  margin-bottom: -1rem;
`;

const Username = styled.div`
  width: 100%;
  color: ${(props) => props.theme.palette.light};
  ${(props) => props.theme.typography.h3};
  background-image: url('${banner}');
  background-size: cover;
  background-position: center;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0rem 2.125rem;
`;

const SemiCircle = styled.div`
  position: relative;
  margin: 0 auto;
  width: ${(props) => `${props.height * 2}rem`};
  height: ${(props) => `${props.height}rem`};
  background-color: ${(props) => props.theme.palette.dark};
  border-bottom-left-radius: ${(props) => `${props.height}rem`};
  border-bottom-right-radius: ${(props) => `${props.height}rem`};
`;

const InnerSemiCircle = styled(SemiCircle)`
  position: absolute;
  top: 0;
  left: ${(props) => `calc(${props.left}rem - 1px)`};
  border: 1px solid ${(props) => props.theme.palette.brand};
  border-top: 0;
`;

const BackgroundSemiCircle = styled(InnerSemiCircle)`
  background-image: url('${sunImage}');
  background-size: cover;
  background-position-y: bottom;
`;

export default ProfileHeader;
