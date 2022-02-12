import * as React from 'react';
import styled from 'styled-components';

import Loader from '../components/Loader/Loader';

const LoaderWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  justify-self: center;
`;

interface LazyPageProps {
  component: React.LazyExoticComponent<(props: unknown) => JSX.Element>;
}

const LazyPage = <T extends object>(
  { component: Component, ...props }: LazyPageProps & T) => {
  return (
    <React.Suspense fallback={(
      <LoaderWrapper>
        <Loader />
      </LoaderWrapper>
    )}>
      <Component {...props} />
    </React.Suspense>
  );
};

export default LazyPage;