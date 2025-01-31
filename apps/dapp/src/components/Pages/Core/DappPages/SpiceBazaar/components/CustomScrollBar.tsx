import styled from 'styled-components';
import SimpleBar from 'simplebar-react';
import 'simplebar/dist/simplebar.min.css';

export const ScrollBar = styled(SimpleBar)`
  padding-bottom: 32px;
  background: transparent;
  overflow-x: auto;

  .simplebar-scrollbar:before {
    background: linear-gradient(to right, #58321a 20%, #95613f 84.5%);
    border-radius: 8px;
    height: 5px;
    background-clip: padding-box;
  }

  .simplebar-track {
    background: transparent;
    border: 1px solid #351f11;
    border-radius: 8px;
    box-shadow: none;
  }

  .simplebar-scrollbar {
    max-height: 8px;
  }
`;
