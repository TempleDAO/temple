import * as React from 'react';

import { CustomRoutingPageProps } from 'hooks/use-custom-spa-routing';

interface State {
  hasError: boolean;
}

type Props = CustomRoutingPageProps;

class AMMErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(error.message);

    if (this.state.hasError) {
      this.props.routingHelper.back();
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export default AMMErrorBoundary;