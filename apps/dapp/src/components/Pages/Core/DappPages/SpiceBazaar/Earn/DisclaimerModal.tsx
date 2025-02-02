import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import { Popover } from 'components/Pages/Core/DappPages/SpiceBazaar/components/Popover';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DisclaimerModal: React.FC<IProps> = ({ isOpen, onClose }) => {
  return (
    <>
      <Popover
        isOpen={isOpen}
        onClose={onClose}
        closeOnClickOutside
        showCloseButton
      >
        <ModalContainer>
          <Title>TGLD Warning</Title>
          <Text>
            TGLD cannot be cross chained to another address. Multisig wallets
            might have a different address on different chains.
          </Text>
          <ConsentButton onClick={onClose}>I Understand</ConsentButton>
        </ModalContainer>
      </Popover>
    </>
  );
};

const ModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: ${({ theme }) => theme.palette.brand};
  width: 400px;
  padding: 0px 20px 0px 20px;
  margin-top: 22px;
  gap: 20px;
`;

const Title = styled.div`
  font-size: 24px;
  color: ${({ theme }) => theme.palette.brandLight};
`;

const Text = styled.div`
  color: ${({ theme }) => theme.palette.brand};
  font-size: 16px;
  line-height: 20px;
  text-align: center;
`;

const ConsentButton = styled(Button)`
  padding: 12px 20px 12px 20px;
  margin: 0px 0px 0px 0px;
  width: max-content;
  height: min-content;
  background: ${({ theme }) => theme.palette.gradients.dark};
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px rgba(222, 92, 6, 0.4);
  border-radius: 10px;
  font-size: 16px;
  line-height: 19px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
`;
