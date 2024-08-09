import { useState } from 'react';
import styled, { css } from 'styled-components';
import { Link } from 'react-router-dom';

import env from 'constants/env';
import { Button } from 'components/Button/Button';
import { usePoolContract } from './use-pool-contract';
import { useFactoryContract } from './use-pool-factory';
import { DecimalBigNumber } from 'utils/DecimalBigNumber';
import { UnstyledList } from 'styles/common';
import { useAuctionContext } from '../AuctionContext';
import { formatNumber } from 'utils/formatter';
import { useVaultContract, JoinType } from '../Trade/hooks/use-vault-contract';
import { AdminCryptoInput } from './components/AdminCryptoInput';

import {
  getInitialValues,
  createTokenDefaults,
  formatValueByType,
  formatDate,
  formatWeight,
} from './utils';

import { Props, FormToken, Values, InputType } from './types';

const MAX_TOKENS = 2;

export const LBPForm = ({ pool }: Props) => {
  const isEditMode = !!pool;

  const { setSwapEnabled, updateWeightsGradually } = usePoolContract(pool);
  const { balances, userBalances, vaultAddress } = useAuctionContext();
  const vaultContract = useVaultContract(pool!, vaultAddress as any);
  const { createPool } = useFactoryContract();
  const [addTokenAddress, setAddTokenAddress] = useState(
    env.tokens.temple.address
  );
  const [formValues, setFormValues] = useState(getInitialValues(pool));

  const setFormValue = <T,>(field: keyof Values, value: T) => {
    setFormValues((vals) => ({
      ...vals,
      [field]: value,
    }));
  };

  const createChangeHandler =
    (fieldKey: keyof Values, type: InputType) =>
    (event: React.ChangeEvent<any>) => {
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

  const getOrderedFormTokens = () =>
    Object.values(formValues.tokens).sort((a, b) =>
      a.address.localeCompare(b.address)
    );

  const saveForm = () => {
    const tokens = getOrderedFormTokens();

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
    const tokens = getOrderedFormTokens();
    const endWeights = tokens.map(({ endWeight }) => endWeight);
    return updateWeightsGradually.handler(
      formValues.startDate,
      formValues.endDate,
      endWeights
    );
  };

  const resetJoinPool = () => {
    // Clear join pool values
    setFormValues((values) => ({
      ...values,
      joinPool: Object.keys(formValues.tokens).reduce(
        (acc, address) => ({
          ...acc,
          [address]: '',
        }),
        {}
      ),
    }));
  };

  const updateSwapEnabled = async (enabled: boolean) => {
    return setSwapEnabled.handler(enabled);
  };

  const joinPool = async () => {
    if (!pool) {
      return;
    }

    const tokens = getOrderedFormTokens();
    const maxAmountsIn: DecimalBigNumber[] = [];
    for (const { address, decimals } of tokens) {
      const amount = formValues.joinPool[address];
      const number = DecimalBigNumber.parseUnits(amount || '0', decimals);
      maxAmountsIn.push(number);
    }

    try {
      const assets = tokens.map(({ address }) => address);
      const tx = await vaultContract.joinPool.request(
        pool.id,
        formValues.joinType,
        assets,
        maxAmountsIn
      );
      await tx.wait();
      resetJoinPool();
    } catch (err) {
      console.error(err);
    }
  };

  const drainPool = async () => {
    if (!pool) {
      return;
    }

    const tokens = getOrderedFormTokens().map(({ address }) => address);
    try {
      const tx = await vaultContract.exitPool.request(pool.id, tokens);
      await tx.wait();
    } catch (err) {
      console.error(err);
    }
  };

  const tokens = Object.values(formValues.tokens).sort(
    (a, b) => a.index - b.index
  );

  return (
    <Form>
      <br />
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
            {!isEditMode &&
              Object.keys(formValues.tokens).length < MAX_TOKENS && (
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
                        const addToken = envTokens.find(
                          ({ address }) => address === addTokenAddress
                        );
                        setFormValues((values) => ({
                          ...values,
                          tokens: {
                            ...values.tokens,
                            [addTokenAddress]: createTokenDefaults(
                              addToken,
                              tokens.length + 1
                            ),
                          },
                        }));
                        const currentTokens = new Set(
                          Object.keys(formValues.tokens).concat(addTokenAddress)
                        );
                        const nextToken = envTokens.filter(
                          ({ address }) => !currentTokens.has(address)
                        );
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
                  const poolBalance = balances![token.address as any];

                  return (
                    <li key={token.address}>
                      <FieldGroup>
                        <>
                          {i + 1}. <Bold>{token.name}</Bold> ({token.address})
                        </>
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
                          onChange={createTokenChangeHandler(
                            token.address,
                            'startWeight',
                            'bn'
                          )}
                        />
                        {isEditMode && (
                          <>
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
                              onChange={createTokenChangeHandler(
                                token.address,
                                'endWeight',
                                'bn'
                              )}
                            />
                            <br />
                            <Label>Current Liquidity</Label>
                            <Input
                              type="text"
                              placeholder="0"
                              readOnly
                              disabled
                              value={`${
                                poolBalance
                                  ? formatNumber(poolBalance.formatUnits())
                                  : 0
                              } $${token.symbol} `}
                            />
                          </>
                        )}
                      </FieldGroup>
                    </li>
                  );
                })}
              </UnstyledList>
            )}
            {isEditMode && (
              <Button
                isSmall
                autoWidth
                loading={updateWeightsGradually.isLoading}
                label="Update Weights"
                onClick={updateWeights}
              />
            )}
          </FieldGroup>
          {isEditMode && (
            <FieldGroup>
              <Label>
                {formValues.joinType === JoinType.Add ? 'Add' : 'Initialize'}{' '}
                Liquidity
              </Label>
              <Select
                value={formValues.joinType}
                onChange={createChangeHandler('joinType', 'number')}
              >
                <option value={JoinType.Init}>Init</option>
                <option value={JoinType.Add}>Add</option>
              </Select>
              <br />
              {Object.values(formValues.tokens).map((token) => {
                const userBalance = userBalances[token.address as any];

                return (
                  <div key={token.address}>
                    <AdminCryptoInput
                      token={token}
                      vaultAddress={vaultAddress as any}
                      userBalance={userBalance}
                      onHintClick={() => {
                        setFormValues((values) => ({
                          ...values,
                          joinPool: {
                            ...values.joinPool,
                            [token.address]: userBalance.formatUnits(),
                          },
                        }));
                      }}
                      value={formValues.joinPool[token.address] || ''}
                      handleChange={(value) => {
                        setFormValues((values) => ({
                          ...values,
                          joinPool: {
                            ...values.joinPool,
                            [token.address]: value,
                          },
                        }));
                      }}
                    />
                    <br />
                  </div>
                );
              })}
              <Button
                isSmall
                loading={vaultContract.joinPool.isLoading}
                disabled={vaultContract.joinPool.isLoading}
                label="Add To Pool"
                onClick={joinPool}
                autoWidth
              />
            </FieldGroup>
          )}
        </div>
      </Layout>
      {!isEditMode && (
        <Button
          isSmall
          loading={createPool.isLoading}
          label="Save"
          onClick={saveForm}
        />
      )}
      {createPool.error && <ErrorMessage>{`${createPool.error}`}</ErrorMessage>}
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
