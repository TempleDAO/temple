import { useEffect, useState } from 'react';
import styled, { css } from 'styled-components';
import { Pool } from 'components/Layouts/Ascend/types';
import env from 'constants/env';
import { Button } from 'components/Button/Button';
import { usePoolContract } from './use-pool-contract';
import { useFactoryContract } from './use-pool-factory';
import { format, parse } from 'date-fns';
import { Link } from 'react-router-dom';
import { DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';
import { formatUnits } from 'ethers/lib/utils';
import { Token } from 'constants/env/types'
import { Input as CryptoInput } from 'components/Input/Input';
import { UnstyledList } from 'styles/common';
import { useAuctionContext } from '../AuctionContext';
import { formatNumber } from 'utils/formatter';
import { useVaultContract } from '../Trade/hooks/use-vault-contract';

interface FormToken {
  name: string;
  address: string;
  symbol?: string;
  decimals: number;
  startWeight: DecimalBigNumber;
  endWeight: DecimalBigNumber;
  balance: DecimalBigNumber;
  index: number;
}

interface Values {
  id?: string;
  name: string;
  symbol: string;
  fees: number;
  tokens: {
    [address: string]: FormToken;
  };
  joinPool: {
    [address: string]: string;
  };
  startDate: Date;
  endDate: Date;
}

const getInitialValues = (pool?: Pool): Values => {
  if (!pool) {
    return {
      name: '',
      symbol: '',
      fees: 1,
      tokens: {},
      startDate: new Date(),
      endDate: new Date(),
      joinPool: {},
    };
  }

  const lastWeightUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];

  return {
    id: pool.id,
    fees: 1,
    tokens: pool.tokens.reduce((acc, token, i) => {
      return {
        ...acc,
        [token.address]: {
          ...token,
          index: i,
          balance: DBN_ZERO,
          startWeight: lastWeightUpdate.startWeights[i],
          endWeight: lastWeightUpdate.endWeights[i],
        },
      };
    }, {}),
    joinPool: pool.tokens.reduce((acc, token, i) => {
      return {
        ...acc,
        [token.address]: '',
      };
    }, {}),
    name: pool.name,
    symbol: pool.symbol,
    startDate: lastWeightUpdate.startTimestamp,
    endDate: lastWeightUpdate.endTimestamp,
  };
};

interface Props {
  pool?: Pool;
}

const MAX_TOKENS = 2;

const createTokenDefaults = (token: Token, index: number): FormToken => {
  return {
    name: token.name,
    address: token.address,
    symbol: token.symbol,
    decimals: token.decimals,
    startWeight: DBN_ZERO,
    endWeight: DBN_ZERO,
    balance: DBN_ZERO,
    index,
  };
};

type InputType = 'date' | 'number' | 'bn' | 'string';

const formatValueByType = (value: any, type: InputType) => {
  switch (type) {
    case 'date': {
      try {
        return parse(value, "yyyy-LL-dd'T'kk:mm", new Date());
      } catch (error) {
        console.error(error);
        return new Date();
      }
    }
    case 'bn':
      return DecimalBigNumber.parseUnits(value || '0', 16);
    default:
      return value;
  }
}

const formatDate = (date: Date) => {
  if (!date) return;
  try {
    return format(date, "yyyy-LL-dd'T'kk:mm");
  } catch (error) {
    console.error(error);
    return format(new Date(), "yyyy-LL-dd'T'kk:mm");
  }
};

const formatWeight = (weight: DecimalBigNumber) => {
  if (!weight) return '0';
  return Math.trunc(Number(formatUnits(weight.value, 16)));
};

export const LBPForm = ({ pool }: Props) => {
  const isEditMode = !!pool;

  const { setSwapEnabled, updateWeightsGradually } = usePoolContract(pool);
  const { balances, userBalances, vaultAddress } = useAuctionContext();
  const vaultContract = useVaultContract(pool!!, vaultAddress);
  const { createPool } = useFactoryContract();
  const [addTokenAddress, setAddTokenAddress] = useState(env.tokens.temple.address);
  const [formValues, setFormValues] = useState(getInitialValues(pool));

  const setFormValue = <T extends any>(field: keyof Values, value: T) => {
    setFormValues((vals) => ({
      ...vals,
      [field]: value,
    }));
  };

  const createChangeHandler = (fieldKey: keyof Values, type: InputType) => (event: React.ChangeEvent<any>) => {
    setFormValue(fieldKey, formatValueByType(event.target.value, type));
  };

  const createTokenChangeHandler =
    (tokenAddress: string, key: keyof FormToken, type: InputType) =>
      (event: React.ChangeEvent<any>) => {
        setFormValues((values) => {
          const token = values.tokens[tokenAddress]!;
          return {
            ...values,
            tokens: {
              ...values.tokens,
              [tokenAddress]: {
                ...token,
                [key]: formatValueByType(event.target.value, type),
              },
            },
          };
        });
      };

  const saveForm = () => {
    const tokens = Object.values(formValues.tokens).sort((a, b) => a.address.localeCompare(b.address));

    return createPool.handler({
      name: formValues.name,
      symbol: formValues.symbol,
      tokenAddresses: tokens.map(({ address }) => address),
      feePercentage: formValues.fees,
      swapEnabledOnStart: true,
      weights: tokens.map(({ startWeight }) => startWeight),
    });
  };

  const updateWeights = () => {
    const tokens = Object.values(formValues.tokens).sort((a, b) => a.address.localeCompare(b.address));
    console.log(tokens)
    const endWeights = tokens.map(({ endWeight }) => endWeight);
    return updateWeightsGradually.handler(
      formValues.startDate,
      formValues.endDate,
      endWeights,
    );
  };

  const updateSwapEnabled = async (enabled: boolean) => {
    return setSwapEnabled.handler(enabled);
  };

  const joinPool = async () => {
    if (!pool) {
      return;
    }

    const tokens = Object.values(formValues.tokens)
      .sort((a, b) => a.address.localeCompare(b.address))
      .map(({ address }) => address);
    
    const maxAmountsIn: DecimalBigNumber[] = [];
    for (const address of tokens) {
      const amount = formValues.joinPool[address];
      const decimals = formValues.tokens[address].decimals;
      const number = DecimalBigNumber.parseUnits(amount || '0', decimals);
      maxAmountsIn.push(number);
    }

    try {
      await vaultContract.joinPool(pool.id, tokens, maxAmountsIn);
    } catch (err) {
      console.log(err);
    }
  };

  const drainPool = () => {
    console.log('Invoke drain pool');
  };

  const tokens = Object.values(formValues.tokens).sort((a, b) => a.index - b.index);

  return (
    <Form>
      <Link to="/dapp/ascend/admin">Back to List</Link>
      <h2>{isEditMode ? 'Edit' : 'Create'} LBP</h2>
      {isEditMode && (
        <AdminGroup>
          <HorizontalList>
            <li>
              {pool?.swapEnabled ? (
                <Button
                  isSmall
                  label="Pause Pool"
                  loading={setSwapEnabled.isLoading}
                  onClick={() => updateSwapEnabled(false)}
                />
              ) : (
                <Button
                  isSmall
                  label="Resume Pool"
                  loading={setSwapEnabled.isLoading}
                  onClick={() => updateSwapEnabled(true)}
                />
              )}
            </li>
            <li>
              <Button isSmall label="Drain Pool" onClick={drainPool} />
            </li>
          </HorizontalList>
        </AdminGroup>
      )}
      <Layout>
        <FieldGroup>
          <Label htmlFor="name">Name</Label>
          <Input
            type="text"
            id="name"
            required
            disabled={isEditMode}
            readOnly={isEditMode}
            onChange={createChangeHandler('name', 'string')}
            value={formValues.name}
          />
          <Label htmlFor="symbol">Symbol</Label>
          <Input
            type="text"
            id="symbol"
            required
            disabled={isEditMode}
            readOnly={isEditMode}
            onChange={createChangeHandler('symbol', 'string')}
            value={formValues.symbol}
          />
          <Label htmlFor="fees">Fee Percent</Label>
          <Input
            id="fees"
            type="number"
            min="0"
            max="100"
            placeholder="-"
            disabled={isEditMode}
            readOnly={isEditMode}
            value={formValues.fees}
            onChange={createChangeHandler('fees', 'number')}
          />
          {isEditMode && (
            <>
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                defaultValue={formatDate(formValues.startDate)}
                type="datetime-local"
                onChange={createChangeHandler('startDate', 'date')}
              />
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="start-time"
                defaultValue={formatDate(formValues.endDate)}
                type="datetime-local"
                onChange={createChangeHandler('endDate', 'date')}
              />
            </>
          )}
        </FieldGroup>
        <div>
          <FieldGroup>
            <Label>Pool Tokens</Label>
            {(!isEditMode && Object.keys(formValues.tokens).length < MAX_TOKENS) && (
            <FieldGroup>
              <AddTokenWrapper>
                <Select
                  id="token-to-add"
                  onChange={(evt) => {
                    setAddTokenAddress(evt.target.value);
                  }}
                  value={addTokenAddress}
                >
                  {Object.values(env.tokens).map((token) => (
                    <option value={token.address} key={token.address}>
                      {token.name}
                    </option>
                  ))}
                </Select>
                <AddButton
                  isSmall
                  disabled={!!formValues.tokens[addTokenAddress]}
                  onClick={() => {
                    const envTokens = Object.values(env.tokens);
                    const addToken = envTokens.find(({ address }) => address === addTokenAddress);
                    setFormValues((values) => ({
                      ...values,
                      tokens: {
                        ...values.tokens,
                        [addTokenAddress]: createTokenDefaults(addToken, tokens.length + 1),
                      },
                    }));
                    const currentTokens = new Set(Object.keys(formValues.tokens));
                    const nextToken = tokens.filter(({ address }) => !currentTokens.has(address));
                    setAddTokenAddress(nextToken[0]?.address || '');
                  }}
                >
                  Add Token
                </AddButton>
              </AddTokenWrapper>
            </FieldGroup>
          )}
            {tokens.length > 0 && (
              <UnstyledList>
                {tokens.map((token, i) => {
                  const poolBalance = balances![token.address];
                  const userBalance = userBalances![token.address];

                  return (
                    <li key={token.address}>
                      <FieldGroup>
                        <>{i + 1}. <Bold>{token.name}</Bold> ({token.address})</>
                        <br />
                        <Label htmlFor={`${token.address}-startWeight`}>
                          Start Weight
                        </Label>
                        <Input
                          min="0"
                          max="100"
                          id={`${token.address}-startWeight`}
                          type="number"
                          disabled={isEditMode}
                          readOnly={isEditMode}
                          placeholder="0"
                          defaultValue={formatWeight(token.startWeight)}
                          onChange={createTokenChangeHandler(token.address, 'startWeight', 'bn')}
                        />
                        <br />
                        <Label htmlFor={`${token.address}-endWeight`}>
                          End Weight
                        </Label>
                        <Input
                          min="0"
                          max="100"
                          id={`${token.address}-endWeight`}
                          type="number"
                          placeholder="0"
                          defaultValue={formatWeight(token.endWeight)}
                          onChange={createTokenChangeHandler(token.address, 'endWeight', 'bn')}
                        />
                        <br />
                        <Label>Current Liquidity</Label>
                        <Input
                          type="text"
                          placeholder="0"
                          readOnly
                          disabled
                          value={`${poolBalance ? formatNumber(poolBalance.formatUnits()) : 0} $${token.symbol} `}
                        />
                      </FieldGroup>
                    </li>
                  );
                })}
              </UnstyledList>
            )}
          </FieldGroup>
          {isEditMode && (
            <FieldGroup>
              <Label>Add Liquidity</Label>
              {Object.values(formValues.tokens).map(({ address, symbol, balance, decimals }) => {
                const userBalance = userBalances[address];
                return (
                  <div key={address}>
                    <CryptoInput
                      isNumber
                      crypto={{ kind: 'value', value: symbol || '' }}
                      hint={`Balance: ${formatNumber(userBalance.formatUnits())}`}
                      onHintClick={() => {
                        setFormValues((values) => ({
                          ...values,
                          joinPool: {
                            ...values.joinPool,
                            [address]: userBalance.formatUnits(),
                          },
                        }));
                      }}
                      value={formValues.joinPool[address] || ''} 
                      handleChange={(value) => {
                        const stringValue = value.toString();
                        const isZero = !stringValue.startsWith('.') && Number(stringValue) === 0;
                        setFormValues((values) => ({
                          ...values,
                          joinPool: {
                            ...values.joinPool,
                            [address]: isZero ? '' : stringValue,
                          },
                        }));
                      }}
                    />
                    <br />
                  </div>
                );
              })}
              <Button isSmall loading={createPool.isLoading} label="Join Pool" onClick={joinPool} />
            </FieldGroup>
          )}
        </div>
      </Layout>
      {!isEditMode ? 
        <Button isSmall loading={createPool.isLoading} label="Save" onClick={saveForm} /> :
        <Button isSmall loading={updateWeightsGradually.isLoading} label="Update" onClick={updateWeights} />
      }
      {createPool.error && <ErrorMessage>{createPool.error}</ErrorMessage>}
    </Form>
  );
};

const Form = styled.form`
  display: flex;
  flex-direction: column;
`;

const FieldGroup = styled.div`
  padding: 1rem;
  border: 1px solid #1d1a1a;
  // max-width: calc(30rem + 2rem);
  width: 100%;
  margin-bottom: 1rem;
`;

const inputCss = css`
  ${({ theme }) => theme.typography.body}
  appearance: none;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  padding: 1rem;
  display: block;
  max-width: 30rem;
  width: 100%;
  background: none;
  color: #fff;
  font-size: 1rem;
`;

const Input = styled.input`
  ${inputCss}
`;

const Label = styled.label`
  font-size: 0.875rem;
  margin: 1rem 0;
  display: block;
  text-transform: uppercase;
  font-weight: 700;

  &:first-of-type {
    margin-top: 0;
  }
`;

const Select = styled.select`
  ${inputCss}
  appearance: auto;
`;

const Note = styled.span`
  display: block;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 0.875rem;
`;

const ErrorMessage = styled.span`
  color: #ff6c00;
`;

const AddTokenWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const AddButton = styled(Button)`
  height: 3.4375rem;
  margin-left: 0.25rem;
  width: auto;
`;

const Bold = styled.span`
  font-weight: 700;
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: 2fr 4fr;
  grid-column-gap: 1rem;
`;

const HorizontalList = styled(UnstyledList)`
  display: flex;
  flex-direction: row;
  align-items: center;

  > li {
    margin-right: 1rem;
  }
`;

const AdminGroup = styled(FieldGroup)`
  margin-right: auto;
  width: auto;
`;