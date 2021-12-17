import React, { useState } from 'react';

export type CustomRoutingPage = (props: CustomRoutingPageProps) => JSX.Element;

type RoutingState = {
  changePageTo(PageComponent: CustomRoutingPage): void;
  back(): void;
  CurrentPage: CustomRoutingPage;
};

type CustomRoutingPageProps = {
  routingHelper: RoutingState;
};

function useCustomRouting(BasePageComponent: CustomRoutingPage): RoutingState {
  const [CurrentPage, setCurrentPage] = useState<CustomRoutingPage>(
    () => BasePageComponent
  );
  const [navHistory, setNavHistory] = useState<CustomRoutingPage[]>([]);

  function changePageTo(PageComponent: CustomRoutingPage) {
    setNavHistory((history) => [...history, CurrentPage]);
    setCurrentPage(() => PageComponent);
  }

  function back() {
    const PrevPage = navHistory.pop();
    setNavHistory((history) => [...history.slice(0, -1)]);
    const BackPage = PrevPage ? () => PrevPage : () => BasePageComponent;
    setCurrentPage(BackPage);
  }

  return {
    changePageTo,
    back,
    CurrentPage,
  };
}

export default useCustomRouting;
