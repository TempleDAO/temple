import '@nomiclabs/hardhat-ethers';
import {
  runAsyncMain,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';
import { createSafeBatch, createSafeTransaction, writeSafeTransactionsBatch } from '../../../safe-tx-builder';
import path from 'path';

async function main() {
  const { TEMPLE_V2_ADDRESSES, TEMPLE_V2_INSTANCES } = await getDeployContext();

  const oldStrategyAddress = TEMPLE_V2_ADDRESSES.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS;
  const oldStrategyDetails = await TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.strategyDetails(oldStrategyAddress);
  const trvDaiDetails = await TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.borrowTokens(TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN);
  
  const batch = createSafeBatch(
    1,
    [
      /*
        TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.setStrategyIsShuttingDown(
          oldStrategyAddress, 
          true
        );
      */
      createSafeTransaction(
        TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS,
        "setStrategyIsShuttingDown",
        [
          {
            argType: "address",
            name: "strategy",
            value: oldStrategyAddress,
          },
          {
            argType: "bool",
            name: "isShuttingDown",
            value: "true",
          },
        ],
      ),

      /*
        TEMPLE_V2_INSTANCES.STRATEGIES.DSR_BASE_STRATEGY.INSTANCE.automatedShutdown("");
      */
      createSafeTransaction(
        TEMPLE_V2_ADDRESSES.STRATEGIES.DSR_BASE_STRATEGY.ADDRESS,
        "automatedShutdown",
        [
          {
            argType: "bytes",
            name: "shutdownParamsData",
            value: "",
          },
        ],
      ),

      /*
        TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.setBorrowToken(
          TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
          TEMPLE_V2_ADDRESSES.STRATEGIES.DAI_ORIGAMI_SKY_FARM_BASE_STRATEGY.ADDRESS,
          trvDaiDetails.baseStrategyWithdrawalBuffer,
          trvDaiDetails.baseStrategyDepositThreshold,
          trvDaiDetails.dToken
        );
      */
      createSafeTransaction(
        TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS,
        "setBorrowToken",
        [
          {
            argType: "address",
            name: "token",
            value: TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
          },
          {
            argType: "address",
            name: "baseStrategy",
            value: TEMPLE_V2_ADDRESSES.STRATEGIES.DAI_ORIGAMI_SKY_FARM_BASE_STRATEGY.ADDRESS,
          },
          {
            argType: "uint256",
            name: "baseStrategyWithdrawalBuffer",
            value: trvDaiDetails.baseStrategyWithdrawalBuffer.toString(),
          },
          {
            argType: "uint256",
            name: "baseStrategyDepositThreshold",
            value: trvDaiDetails.baseStrategyDepositThreshold.toString(),
          },
          {
            argType: "address",
            name: "dToken",
            value: trvDaiDetails.dToken,
          },
        ],
      ),

      /*
        TEMPLE_V2_INSTANCES.TREASURY_RESERVES_VAULT.INSTANCE.addStrategy(
          TEMPLE_V2_ADDRESSES.STRATEGIES.DAI_ORIGAMI_SKY_FARM_BASE_STRATEGY.ADDRESS,
          oldStrategyDetails.underperformingEquityThreshold,
          oldStrategyDetails.debtCeiling
        );
      */
      // NB: Hand crafted because of the custom type
      {
        to: TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS,
        value: "0",
        data: null,
        contractMethod: {
          inputs: [
            {
              internalType: "address",
              name: "strategy",
              type: "address"
            },
            {
              internalType: "int256",
              name: "underperformingEquityThreshold",
              type: "int256"
            },
            {
              components: [
                {
                  internalType: "address",
                  name: "asset",
                  type: "address"
                },
                {
                  internalType: "uint256",
                  name: "balance",
                  type: "uint256"
                }
              ],
              internalType: "struct ITempleStrategy.AssetBalance[]",
              name: "debtCeiling",
              type: "tuple[]"
            }
          ],
          name: "addStrategy",
          payable: false
        },
        contractInputsValues: {
          strategy: TEMPLE_V2_ADDRESSES.STRATEGIES.DAI_ORIGAMI_SKY_FARM_BASE_STRATEGY.ADDRESS,
          underperformingEquityThreshold: oldStrategyDetails.underperformingEquityThreshold.toString(),
          debtCeiling: JSON.stringify(oldStrategyDetails.debtCeiling)
        }
      }
    ],
  );

  const filename = path.join(__dirname, "./origami-sky-farm-transactions-batch.json");
  writeSafeTransactionsBatch(batch, filename);
  console.log(`Wrote Safe tx's batch to: ${filename}`);
}

runAsyncMain(main);
