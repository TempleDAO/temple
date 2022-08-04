const BALANCER_ERRORS: Record<string, string> = {
  ['BAL#304']: 'Token in unbalanced the pool too much on a swap',
  ['BAL#305']: 'Token out unbalanced the pool too much on a swap',
};

const BAL_ERROR_REGEXP = /BAL#3[0-9]{2}/g;

const GENERIC_BALANCER_ERROR = 'Something went wrong';

const getBALCode = (errorMessage: string): string => {
  const balancerError = new RegExp(BAL_ERROR_REGEXP).exec(errorMessage);
  if (balancerError && balancerError[0]) {
    return balancerError[0];
  }
  return '';
};

export const getBalancerErrorMessage = (errorMessage: string) => {
  const maybeBALCode = getBALCode(errorMessage);
  if (!maybeBALCode) {
    return GENERIC_BALANCER_ERROR
  }
  
  const predefinedMessage = BALANCER_ERRORS[maybeBALCode];
  if (!predefinedMessage) {
    console.error('Missing error message for Balancer error ', maybeBALCode);
    return GENERIC_BALANCER_ERROR;
  }

  return predefinedMessage;
};