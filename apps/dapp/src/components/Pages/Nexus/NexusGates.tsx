import styled from 'styled-components';
import gatesImage from 'assets/images/EnterTheGates.jpg';
import { Link } from 'react-router-dom';
import { clickSound } from 'utils/sound';

export const NexusGates = () => {
  const handleClick = () => {
    clickSound.play();
  };
  
  return (
    <NexusGatesContainer>
      <KeyForm onSubmit={(e) => e.preventDefault()}>
        <Link to="/nexus">
          <EnterButton onClick={handleClick}>ENTER</EnterButton>
        </Link>
      </KeyForm>
    </NexusGatesContainer>
  );
};

const NexusGatesContainer = styled.div`
  background-image: url(${gatesImage});
  background-size: cover;
  background-position: center;
  height: 100vh;
  width: 100vw;
`;

const KeyForm = styled.form`
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  height: 100%;
`;

const EnterButton = styled.button`
  ${(props) => props.theme.typography.h2};
  background: transparent;
  border: none;
  border-radius: 2px;
  color: ${(props) => props.theme.palette.brand};
  cursor: pointer;
  font-size: 2rem;
  padding: 0rem 1rem;
  &:focus {
    outline: 1px solid ${(props) => props.theme.palette.brand25};
  }
`;
