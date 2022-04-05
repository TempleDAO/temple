import React, { useEffect, useState } from 'react';
import { Input } from 'components/Input/Input';
import { Button, ButtonProps } from 'components/Button/Button';
import styled, { css } from 'styled-components';
import * as breakpoints from 'styles/breakpoints';
import { ethers } from 'ethers';
import { PageWrapper } from 'components/Pages/Core/utils';
import { phoneAndAbove } from 'styles/breakpoints';

const TimeStone = () => {
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

    const handleUpdateTimeToSet = async (value: number) => {
        setTimeToSet(value);
    };

    const handleUpdateMiningInterval = async (value: number) => {
        setMiningInterval(value);
    }

    const resetEVM = async () => {
        await network.send("hardhat_reset", [])
        await getAndSetCurrentBlock()
    }

    useEffect(() => {
        updateEVMTimeDisplay().catch(console.error)
        getAndSetCurrentBlock().catch(console.error)
    });

    return (
        <PageWrapper>
            <ProfileOverview>
                <ProfileMeta>
                    <FlexCol>
                        <h2>Timestamp</h2>
                        <TimestampDisplay>{currentTime} - {new Date(currentTime * 1000).toString()}</TimestampDisplay>
                    </FlexCol>
                </ProfileMeta>
                <ProfileMeta>
                    <FlexCol>
                        <h2>Block number</h2>
                        <TimestampDisplay>{currentBlock}</TimestampDisplay>
                    </FlexCol>
                </ProfileMeta>
            </ProfileOverview>
            <ProfileOverview>
                <ProfileMeta>
                    <FlexCol>
                    <h2>Mine time</h2>
                    <ButtonGroup>
                        <ButtonContainer>
                            <StyledButton label={'+ 1 Day'} isUppercase isSmall onClick={increaseOneDay} />
                        </ButtonContainer>
                        <ButtonContainer>
                            <StyledButton label={'+ 7 Days'} isUppercase isSmall onClick={increaseSevenDays} />
                        </ButtonContainer>
                        <ButtonContainer>
                            <StyledButton label={'+ 30 Days'} isUppercase isSmall onClick={increaseThirtyDays} />
                        </ButtonContainer>
                    </ButtonGroup>
                    <h2>Mine block</h2>
                    <ButtonGroup>
                        <ButtonContainer>
                            <StyledButton label={'Mine Block'} isUppercase isSmall onClick={mineBlock} />
                        </ButtonContainer>
                        <ButtonContainer>
                            <StyledButton label={'Reset EVM'} isUppercase isSmall onClick={resetEVM} />
                        </ButtonContainer>
                    </ButtonGroup>
                    <p>Enter auto mining interval in milliseconds. This will create new blocks every interval milliseconds. Set to 0 to disable.</p>

                    <Input
                        hint={`Must be greater than 0`}
                        crypto={{ kind: 'value', value: "Interval" }}
                        isNumber
                        min={0}
                        max={1669198714000}
                        value={miningInterval}
                        handleChange={
                            handleUpdateMiningInterval
                        }
                        placeholder={"0"}
                        pairTop
                    />
                    <Button
                        label={`Set Mining Interval`}
                        isUppercase
                        isSmall={true}
                        onClick={
                            sendMiningInterval
                        }
                        style={{margin: '50px 0 0 0'}}
                    />
                    </FlexCol>
                </ProfileMeta>
                <ProfileMeta>
                <FlexCol>
                    <h2>Set explicit time</h2>
                    <p>Please enter a unix time in seconds. Note: you <b>must</b> enter a timestamp greater than what is shown in the above section (i.e. in the future of the current time UTC).</p>

                    <Input
                        hint={`Must be greater than current time`}
                        crypto={{ kind: 'value', value: "Timestamp" }}
                        isNumber
                        min={0}
                        max={1669198714000}
                        value={timeToSet}
                        handleChange={
                            handleUpdateTimeToSet
                        }
                        placeholder={currentTime.toString()}
                        pairTop
                    />
                    <Button
                        label={`Set Time`}
                        isUppercase
                        isSmall={true}
                        onClick={
                            setExplicitTime
                        }
                        style={{margin: '50px 0 0 0'}}
                    />
                    </FlexCol>
                </ProfileMeta>
            </ProfileOverview>
        </PageWrapper>
    );
};

const TimestampDisplay = styled.div`
  text-align: center;
`

const Header = styled.div`
  width: 100%;
  color: ${(props) => props.theme.palette.light};
  ${(props) => props.theme.typography.h3};
  background-size: cover;
  background-position: center;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0rem 2.125rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  max-width: 24rem;
  width: 100%;
  margin: 0 auto 3rem;

  ${breakpoints.tabletAndAbove(`
    margin: 0 0 3.5rem;
    justify-content: space-between;
  `)}
`;

const ButtonContainer = styled.div`
  width: 9.6875rem;
`;

const StyledButton = styled(Button) <ButtonProps>`
  width: 100%;
`;

const ProfileOverview = styled.section`
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
  ${phoneAndAbove(`
    grid-template-columns: 1fr 1fr;
  `)}
`;

const FlexCol = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
`;

const ProfileMeta = styled.div`
  min-width: 50%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  ${phoneAndAbove(`
    padding-right: 0.75rem;
    .stats-pie {
      grid-column: 1 / -1;
    }
  `)}
`;

export default TimeStone;