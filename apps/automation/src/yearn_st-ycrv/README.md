# Yearn st-yCRV

TempleDAO and Yearn have an agreement where they bribe the `STAX Temple/FRAX LP gauge`, and both Temple & Yearn profit share the CRV proceeds.

TempleDAO converts the CRV rewards into st-yCRV (to earn yield), until such time that it needs the CRV for bribing.

## Automation Steps

1. `1_split_yearn_crv`: Ensures that the rewards are harvested & split across yearn and temple
   1. TRIGGER: When profit share rewards haven't been harvested for 3.5 days
1. Convert the CRV rewards to st-yCRV (to earn yield)
   1. `2_pull_crv`: Pull the CRV rewards from the multisig
      1. TRIGGER: When there is 10k CRV in the multisig
   1. `3_zap_crv_to_st-ycrv`: Zap the CRV into st-yCRV using Yearn's zapper
      1. TRIGGER: When the relayer receives CRV
      1. Sends the st-yCRV to the multisig
1. Convert the st-yCRV back into CRV (to use for bribes)
   1. `4_pull_st-ycrv`: Pull the st-yCRV from the multisig
      1. TRIGGER: On a schedule - when bribes are due to be actioned
   1. `5_zap_st_ycrv_to_crv`: Zap the st-yCRV into CRV using Yearn's zapper
      1. TRIGGER: When the relayer receives st-yCRV
      1. Sends the CRV to a treasury operator hot wallet to use for bribing
