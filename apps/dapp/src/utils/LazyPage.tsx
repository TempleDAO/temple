import * as React from 'react';

import Loader from '../components/Loader/Loader';

interface LazyPageProps {
  component: React.LazyExoticComponent<(props: unknown) => JSX.Element>;
}

const LazyPage = (
  { component: Component }: LazyPageProps) => {
  return (
    <React.Suspense fallback={<Loader />}>
      <Component />
    </React.Suspense>
  );
};

export default LazyPage;