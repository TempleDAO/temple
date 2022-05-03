import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import './App.css'

function App() {
  const oneDay = 24 * 60 * 60;
  const sevenDays = 7 * oneDay;
  const thirtyDays = 30 * oneDay;

  const network = new ethers.providers.JsonRpcProvider()
    const [currentTime, setCurrentTime] = useState(0);
    const [timeToSet, setTimeToSet] = useState(0);
    const [currentBlock, setCurrentBlock] = useState(0);
    const [miningInterval, setMiningInterval] = useState(0);
    const [updateUITimerID, setUpdateUITimerID] = useState<NodeJS.Timer>();

    const increaseOneDay = async () => await increaseTime(oneDay);
    const increaseSevenDays = async () => await increaseTime(sevenDays);
    const increaseThirtyDays = async () => await increaseTime(thirtyDays);

    const updateEVMTimeDisplay = async () => setCurrentTime(await getCurrentEVMTimestamp());

    const increaseTime = async (seconds: number) => {
        console.log(`Increase EVM time by ${seconds} seconds`)
        console.log(`Time before`)

        const timestampBefore = await getCurrentEVMTimestamp();
        console.log(timestampBefore)
        console.log(new Date(timestampBefore * 1000))

        await network.send('evm_increaseTime', [seconds]);
        await mineBlock()

        const timestampAfter = await getCurrentEVMTimestamp();
        console.log(`Time After`);
        console.log(timestampAfter);
        console.log(new Date(timestampAfter * 1000))

        await updateEVMTimeDisplay()
    }

    const setExplicitTime = async () => {
        await setEVMTime(timeToSet);
    }

    const setEVMTime = async (timestamp: number) => {
        console.log(`Setting EVM time to ${timestamp} seconds`)
        console.log(`Time before`)
        console.log(timestamp)

        const timestampBefore = await getCurrentEVMTimestamp();
        console.log(timestampBefore)
        console.log(new Date(timestampBefore * 1000))

        // I bloody love weakly typed languages. 
        await network.send('evm_setNextBlockTimestamp', [Number(timestamp)]);
        await mineBlock()

        const timestampAfter = await getCurrentEVMTimestamp();
        console.log(`Time After`);
        console.log(timestampAfter);
        console.log(new Date(timestampAfter * 1000))

        await updateEVMTimeDisplay()
    }

    const sendMiningInterval = async () => {
        await sendMiningIntervalToEVM(miningInterval)
    }

    const sendMiningIntervalToEVM = async (miningInterval: number) => {
        await network.send("evm_setIntervalMining", [Number(miningInterval)])
        if (updateUITimerID) {
            clearInterval(updateUITimerID)
        }
    
        if (miningInterval > 0) {
            let t = setInterval(async () => {
                await getAndSetCurrentBlock()
                await updateEVMTimeDisplay()
            }, miningInterval)
            setUpdateUITimerID(t)
        }
    }

    const mineBlock = async() => {
        await network.send('evm_mine', [])
        await getAndSetCurrentBlock()
    }

    const getAndSetCurrentBlock = async() => {
        const blockNumBefore = await network.send("eth_blockNumber",[]);
        console.log(blockNumBefore);
        setCurrentBlock(blockNumBefore);
    }

    const getCurrentEVMTimestamp = async (): Promise<number> => {
        const blockNum = await network.getBlockNumber();
        const block = await network.getBlock(blockNum);
        return block.timestamp;
    }

    const handleUpdateTimeToSet = async (e: React.FormEvent<HTMLInputElement>) => {
        setTimeToSet(Number.parseInt(e.currentTarget.value));
    };

    const handleUpdateMiningInterval = async (e: React.FormEvent<HTMLInputElement>) => {
        setMiningInterval(Number.parseInt(e.currentTarget.value));
    }

    const resetEVM = async () => {
        await network.send("hardhat_reset", [])
        await getAndSetCurrentBlock()
    }

    useEffect(() => {
        updateEVMTimeDisplay().catch(console.error)
        getAndSetCurrentBlock().catch(console.error)
        setTimeToSet(currentTime);
    }, [currentTime]);

  const [count, setCount] = useState(0)

  return (
    <div>
      <h1>Hardhat Control</h1>
      <div className="row">
        <div className="column">
          <h2>Timestamp</h2>
          <p>{currentTime} - {new Date(currentTime * 1000).toString()}</p>
        </div>

        <div className="column">
          <h2>Block Number</h2>
          <p>{currentBlock}</p>
        </div>
        <div className="row">
        <div className="column">
          <h2>Mine Time</h2>
          <button type="button" onClick={increaseOneDay}>+ 1 Day</button>
          <button type="button" onClick={increaseSevenDays}>+ 7 Days</button>
          <button type="button" onClick={increaseThirtyDays}>+ 30 Days</button>
        </div>
      </div>
        <div className="row">
        <div className="column">
          <h2>Mine Block</h2>
          <button type="button" onClick={mineBlock}>Mine Block</button>
          <button type="button" onClick={resetEVM}>Reset EVM</button>
        </div>

        <div className="column">
          <h2>Enable Auto Mine</h2>
          <p>Enter auto mining interval in milliseconds. This will create new blocks every interval milliseconds. Set to 0 to disable.</p>

          <input type="number" value={miningInterval} onChange={handleUpdateMiningInterval} />
          <button type="button" onClick={sendMiningInterval}>Set Mining Interval</button>
        </div>
</div>
<div className="row">
        <div className="column">
          <h2>Set Explicit Time</h2>
          <p>Please enter a unix time in seconds. Note: you <b>must</b> enter a timestamp greater than what is shown in the above section (i.e. in the future of the current time UTC).</p>

          <input type="number" value={timeToSet} onChange={handleUpdateTimeToSet} />
          <button type="button" onClick={setExplicitTime}>Set Time</button>
        </div>
        </div>
      </div>
    </div>
  )
}

export default App
