import { useState } from 'react';
import { BigNumber, Contract } from 'ethers';
import styled, { css } from 'styled-components';
import { Pool } from 'components/Layouts/Ascend/types';
import env from 'constants/env';
import { Button } from 'components/Button/Button';
import { usePoolContract } from './use-pool-contract';
import { useFactoryContract } from './use-pool-factory';
import { format } from 'date-fns';
import { formatUnits } from 'ethers/lib/utils';
import { Link } from 'react-router-dom';
interface Values {
  id?: string;
  name: string;
  symbol: string;
  releasedToken: string;
  accruedToken: string;
  startWeight1: BigNumber;
  startWeight2: BigNumber;
  startDate: Date;
  endDate: Date;
  fees: number;
  address: string;
  endWeight1: BigNumber;
  endWeight2: BigNumber;
}

const getInitialValues = (pool?: Pool): Values => {
  if (!pool) {
    return {
      symbol: '',
      name: '',
      releasedToken: env.tokens.temple.address,
      accruedToken: env.tokens.frax.address,
      startWeight1: BigNumber.from(0),
      startWeight2: BigNumber.from(0),
      startDate: new Date(0),
      endDate: new Date(0),
      fees: 1,
      address: '',
      endWeight1: BigNumber.from(0),
      endWeight2: BigNumber.from(0),
    };
  }

  const initialWeights = pool.weightUpdates[0];
  const lastWeightUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];

  return {
    id: pool.id,
    name: pool.name,
    symbol: pool.symbol,
    releasedToken: pool.tokens[0].address,
    accruedToken: pool.tokens[1].address,
    startWeight1: initialWeights.startWeights[0],
    startWeight2: initialWeights.startWeights[1],
    startDate: lastWeightUpdate.startTimestamp,
    endDate: lastWeightUpdate.endTimestamp,
    fees: 1,
    address: pool.address,
    endWeight1: lastWeightUpdate.endWeights[0],
    endWeight2: lastWeightUpdate.endWeights[1],
  };
};

interface Props {
  pool?: Pool;
}

const Form = styled.form`
  display: flex;
  flex-direction: column;
`;

const InputGroup = styled.div`
  padding: 1rem;
  border: 1px solid #1d1a1a;
  margin: 0 0 1.5rem;
  max-width: calc(30rem + 2rem);
  width: 100%;
`;

const inputCss = css`
  appearance: none;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  padding: 1rem;
  display: block;
  max-width: 30rem;
  width: 100%;
  background: none;
  color: #fff;
  ${({ theme }) => theme.typography.body}
  font-size: 1rem;
`;

const Input = styled.input`
  ${inputCss}
`;

const Label = styled.label`
  font-size: 0.875rem;
  margin-bottom: 1rem;
  display: block;
  text-transform: uppercase;
  font-weight: 700;
`;

const TextArea = styled.textarea`
  ${inputCss}
`;

const Select = styled.select`
  ${inputCss}
  appearance: auto;
  margin-bottom: 1rem;
`;

const Note = styled.span`
  display: block;
  color: ${({ theme }) => theme.palette.brand};
  font-size: 0.875rem;
`;

export const LBPForm = ({ pool }: Props) => {
  const isEditMode = !!pool;

  const { updateWeightsGradually, setSwapEnabled } = usePoolContract(pool);
  const { createPool } = useFactoryContract();

  const [formValues, setFormValues] = useState(getInitialValues(pool));

  const setFormValue = <T extends any>(field: keyof Values, value: T) => {
    setFormValues((vals) => ({
      ...vals,
      [field]: value,
    }));
  };

  const createChangeHandler = (fieldKey: keyof Values) => (event: React.ChangeEvent<any>) => {
    setFormValue(fieldKey, event.target.value);
  };


  const saveForm = () => {
    // TODO: Any of the UX around transactions e.g. waiting, failed, complete
    createPool({
      name: formValues.name,
      symbol: formValues.symbol,
      tokenAddresses: [formValues.releasedToken, formValues.accruedToken],
      feePercentage: BigNumber.from(formValues.fees),
      swapEnabledOnStart: true,
      weights: [formValues.startWeight1, formValues.startWeight2],
    });
  };

  const updateWeights = () => {
    // TODO: Any of the UX around transactions e.g. waiting, failed, complete
    updateWeightsGradually(formValues.startDate, formValues.endDate, formValues.endWeight1, formValues.endWeight2);
  };

  const updateSwapEnabled = (enabled: boolean) => {
    // TODO: Any of the UX around transactions e.g. waiting, failed, complete
    setSwapEnabled(enabled);
  };

  const drainPool = () => {
    console.log('Invoke drain pool');
  };

  const formatDate = (date: Date) => {
    return format(date, "yyyy-LL-dd'T'kk:mm");
  };

  const formatWeight = (weight: BigNumber) => {
    if (!weight) return 0;
    return Math.trunc(Number(formatUnits(weight, 16)));
  };

  return (
    <Form>
      <h2>{isEditMode ? 'Edit' : 'Create'} LBP</h2>
      <Link to="/dapp/ascend/admin">Back to List</Link>
      <br />
      <InputGroup hidden={!formValues.id}>
        <Label htmlFor="address">Address</Label>
        <Input type="text" id="name" disabled readOnly value={formValues.address} />
      </InputGroup>
      <InputGroup>
        <Label htmlFor="name">Name</Label>
        <Input type="text" id="name" required onChange={createChangeHandler('name')} value={formValues.name} />
      </InputGroup>
      <InputGroup>
        <Label htmlFor="symbol">Symbol</Label>
        <Input type="text" id="symbol" required onChange={createChangeHandler('symbol')} value={formValues.symbol} />
      </InputGroup>
      <InputGroup>
        <Label htmlFor="released-token">Released</Label>
        <Select id="released-token" onChange={createChangeHandler('releasedToken')} value={formValues.releasedToken}>
          {Object.values(env.tokens).map((token) => (
            <option value={token.address} key={token.address}>
              {token.name}
            </option>
          ))}
        </Select>
        {formValues.releasedToken && <Note>Address: {formValues.releasedToken}</Note>}
      </InputGroup>
      <InputGroup>
        <Label htmlFor="accrued-token">Accrued</Label>
        <Select id="accrued-token" onChange={createChangeHandler('accruedToken')} value={formValues.accruedToken}>
          {Object.values(env.tokens).map((token) => (
            <option value={token.address} key={token.address}>
              {token.name}
            </option>
          ))}
        </Select>
        {formValues.accruedToken && <Note>Address: {formValues.accruedToken}</Note>}
      </InputGroup>
      <InputGroup>
        <Label htmlFor="fees">Fee Percent</Label>
        <Input
          id="fees"
          type="number"
          min="0"
          max="100"
          placeholder="-"
          value={formValues.fees}
          onChange={createChangeHandler('fees')}
        />
      </InputGroup>
      <InputGroup>
        <h5>Starting Weights</h5>
        <Label htmlFor="startWeight1">Weight 1</Label>
        <Input
          id="startWeight1"
          type="number"
          disabled={isEditMode}
          readOnly={isEditMode}
          min="0"
          max="100"
          placeholder="0"
          defaultValue={formatWeight(formValues.startWeight1)}
          onChange={createChangeHandler('startWeight1')}
        />
        <br />
        <Label htmlFor="startWeight2">Weight 2</Label>
        <Input
          id="startWeight2"
          type="number"
          disabled={isEditMode}
          readOnly={isEditMode}
          min="0"
          max="100"
          placeholder="0"
          defaultValue={formatWeight(formValues.startWeight2)}
          onChange={createChangeHandler('startWeight2')}
        />
      </InputGroup>
      {isEditMode && (
        // TODO: If there was never a weight update,
        // Maybe put some text to say it is needed
        <InputGroup>
          <h5>Ending Weights</h5>
          <Label htmlFor="start-time">Start Time</Label>
          <Input
            id="start-time"
            defaultValue={formatDate(formValues.startDate)}
            type="datetime-local"
            onChange={createChangeHandler('startDate')}
          />
          <br />
          <Label htmlFor="end-date">End Time</Label>
          <Input
            id="end-time"
            defaultValue={formatDate(formValues.endDate)}
            type="datetime-local"
            onChange={createChangeHandler('endDate')}
          />
          <br />
          <Label htmlFor="weight1">Weight 1</Label>
          <Input
            id="weight1"
            type="number"
            min="0"
            max="100"
            placeholder="0"
            defaultValue={formatWeight(formValues.endWeight1)}
            onChange={createChangeHandler('endWeight1')}
          />
          <br />
          <Label htmlFor="weight1">Weight 2</Label>
          <Input
            id="weight2"
            type="number"
            min="0"
            max="100"
            placeholder="0"
            defaultValue={formatWeight(formValues.endWeight2)}
            onChange={createChangeHandler('endWeight2')}
          />
          <br />
          <Button isSmall label="Update Weights" onClick={updateWeights} />
        </InputGroup>
      )}
      {isEditMode && (
        <InputGroup>
          <h5>Pool Status</h5>
          <h5>{pool.swapEnabled ? 'ACTIVE' : 'PAUSED'}</h5>
          {pool.swapEnabled ? (
            <Button isSmall label="Pause Pool" onClick={() => updateSwapEnabled(false)} />
          ) : (
            <Button isSmall label="Resume Pool" onClick={() => updateSwapEnabled(true)} />
          )}
        </InputGroup>
      )}
      {isEditMode && (
        <InputGroup>
          <h5>Drain Pool</h5>
          Lorem ipsum dolor sit amet
          <Button isSmall label="Drain Pool" onClick={drainPool} />
        </InputGroup>
      )}
      {!isEditMode && <Button isSmall label="Save" onClick={saveForm} />}
    </Form>
  );
};
