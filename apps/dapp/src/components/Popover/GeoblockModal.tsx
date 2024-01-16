import { Popover } from 'components/Popover';
import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import { Link } from 'react-router-dom';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeoblockModal: React.FC<IProps> = ({ isOpen, onClose }) => {
  return (
    <>
      <Popover
        isOpen={isOpen}
        onClose={onClose}
        closeOnClickOutside
        showCloseButton
      >
        <ModalContainer>
          <Title>Access Restricted</Title>
          <Subtitle>
            You are accessing the website from a prohibited jurisdiction in
            violation of our <Link to="/disclaimer">Terms and Conditions</Link>.
            The dApp will only permit you to exit your legacy TEMPLE position
            where applicable.
          </Subtitle>
          <ConsentButton onClick={onClose}>I Understand</ConsentButton>
        </ModalContainer>
      </Popover>
    </>
  );
};

const ConsentButton = styled(Button)`
  background: ${({ theme }) => theme.palette.gradients.dark};
  color: ${({ theme }) => theme.palette.brandLight};
  border: 1px solid #95613f;
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
  width: max-content;
  margin: 1rem auto;
  height: max-content;
  padding: 0.5rem 1rem;
`;

const Subtitle = styled.div`
  color: ${({ theme }) => theme.palette.brand};
  letter-spacing: 0.05rem;
  line-height: 1.25rem;
`;

const Title = styled.div`
  font-size: 1.5rem;
  padding-bottom: 1rem;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  color: ${({ theme }) => theme.palette.brand};
  width: 350px;
`;

export default GeoblockModal;
