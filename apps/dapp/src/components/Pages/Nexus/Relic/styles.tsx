import styled from 'styled-components';

export const NexusContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
`;

export const NexusPanel = styled.div<{ color?: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 2px solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 16px;
  padding: 1rem;
  background-color: rgba(0, 0, 0, .3);
  backdrop-filter: blur(15px);

  > * {
    margin-bottom: 1rem;
  }
`;

export const NexusPanelRow = styled.h3`
  width: 100%;
  margin: 1rem;
  padding: 0 5px;
  text-align: left;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  * > {
    &:first-child {
      flex: 1;
    }
  }
`;

export const NexusBodyContainer = styled.div`
  display: flex;
  flex-flow: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  > * {
    margin: 2%;
    width: 100%;
    min-width: 25rem;
    max-width: 800px;
  }
`;

export const NexusBackground = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-size: cover;
  background-position: center;
`