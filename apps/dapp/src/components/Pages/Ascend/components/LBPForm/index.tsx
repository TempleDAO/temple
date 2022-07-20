import { useState } from 'react';
import { BigNumber } from 'ethers';
import styled, { css } from 'styled-components';

import { Pool } from 'components/Layouts/Ascend/types';
import env from 'constants/env';
import { Button } from 'components/Button/Button';

interface Values {
  id?: string;
  name: string;
  overview: string;
  releasedToken: string;
  accruedToken: string;
  startWeight: [BigNumber, BigNumber];
  startDate: Date;
  endDate: Date;
  fees: number;
  address: string;
}

const getInitialValues = (pool?: Pool): Values => {
  if (!pool) {
    return {
      overview: '',
      name: '',
      releasedToken: env.tokens.temple.address,
      accruedToken: env.tokens.frax.address,
      startWeight: [BigNumber.from(0), BigNumber.from(0)],
      startDate: new Date(0),
      endDate: new Date(0),
      fees: 1,
      address: '',
    };
  }

  const lastWeightUpdate = pool.weightUpdates[pool.weightUpdates.length - 1];

  return {
    id: pool.id,
    name: pool.name,
    overview: '',
    releasedToken: pool.tokens[0].address,
    accruedToken: pool.tokens[1].address,
    startWeight: lastWeightUpdate.startWeights,
    startDate: new Date(0),
    endDate: new Date(0),
    fees: 1,
    address: pool.address,
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
    console.log('Saving form, with values');
    console.log(formValues);
  };

  const completePoolSetup = () => {
    console.log('Complete pool setup');
    console.log('Invoke upgradeWeightsGradually');
  };

  const pausePool = () => {
    console.log('Invoke pause pool');
  };

  const drainPool = () => {
    console.log('Invoke drain pool');
  };

  // TODO: Do we need any of the other fields in the form? I suspect we do.

  return (
    <Form>
      <h2>{formValues.id ? 'Edit' : 'Create'} LBP</h2>
      <InputGroup hidden={!formValues.id}>
        <Label htmlFor="address">Address</Label>
        <Input type="text" id="name" disabled readOnly value={formValues.address} />
      </InputGroup>
      <InputGroup>
        <Label htmlFor="name">Name</Label>
        <Input type="text" id="name" required onChange={createChangeHandler('name')} value={formValues.name} />
      </InputGroup>
      <InputGroup>
        <Label htmlFor="overview">Overview</Label>
        <TextArea required id="overview" onChange={createChangeHandler('overview')} value={formValues.overview} />
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
        <Label htmlFor="start-date">Start Date</Label>
        <Input id="start-date" type="datetime-local" onChange={createChangeHandler('startDate')} />
        <br />
        <Label htmlFor="end-date">End Date</Label>
        <Input id="end-date" type="datetime-local" onChange={createChangeHandler('endDate')} />
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
      {/* // TODO: Add logic to determine, if we're editing, and the setup is not "complete" */}
      {/* // Then show the "compelte pool setup" button, which will call upgradeWeightsGradually */}
      {formValues.id && <Button isSmall label="Complete Pool Setup" onClick={completePoolSetup} />}
      {formValues.id && <Button isSmall label="Pause Pool" onClick={pausePool} />}
      {formValues.id && <Button isSmall label="Drain Pool" onClick={drainPool} />}
      <Button isSmall label="Save" onClick={saveForm} />
    </Form>
  );
};
