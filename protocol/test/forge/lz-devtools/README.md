# LayerZero DevTools (forked)

`TestHelperOz5.sol` and other contracts forked from [LayerZero-Labs/devtools](https://github.com/LayerZero-Labs/devtools/tree/14d414c74d1bf75c0e5a9da5bd248c319f248762/packages/test-devtools-evm-foundry)

The LZ contracts include a [MessagingComposer::lzComposeAlert()](https://github.com/LayerZero-Labs/LayerZero-v2/blob/1fde89479fdc68b1a54cda7f19efa84483fcacc4/protocol/contracts/MessagingComposer.sol#L67) function and event emit with a tonne of parameters - causing solc to stack too deep when running `forge coverage`

This function is not required in tests - so the devtools was forked to be the same but with that function commented out.
