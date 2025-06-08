import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'popup/index.js',
  output: {
    file: 'dist/sidepanel.bundle.js',
    format: 'iife',
    name: 'TabOrganizer'
  },
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs()
  ]
};

