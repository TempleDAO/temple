import React, { useState } from 'react';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

const useFormField = <T extends any>(initialValue: T) => {
  const [value, setValue] = useState(initialValue);

};

export const CreateAuctionPage = () => {
  const [overview, setOverview] = useState('');
  const [releasedToken, setReleasedToken] = useState('');
  const [accruedToken, setAccruedToken] = useState('');
  const [startWeight, setStartWeight] = useState(0);
  const [startingPrice, setStartingPrice] = useState(0);
  const [duration, setDuration] = useState<Date>();
  const [fees, setFees] = useState(0);

  return (
    <div>
      <h3>Create Auction</h3>
      <textarea
        onChange={(evt) => {
          setOverview(evt.target.value);
        }}
      >
        {overview}
      </textarea>
      <select>
        {}
      </select>
    </div>
  )
};
