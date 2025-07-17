import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import builtins from 'builtin-modules';

if (!process.env.ROLLUP_INPUT) {
    throw new Error("$ROLLUP_INPUT not defined");
}

export default {
  input: process.env.ROLLUP_INPUT,
  output: {
    file: 'dist/index.js',
    format: 'cjs',
  },
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    json({ compact: true }),
    typescript({tsconfig: './tsconfig-rollup.json'}),
  ],
  external: [
    ...builtins,
    'ethers',
    'aws-sdk/clients/lambda',
    /^defender-relay-client(\/.*)?$/,
  ],
};