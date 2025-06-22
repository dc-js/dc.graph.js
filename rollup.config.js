import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/dc-graph.js',
    format: 'es',
    sourcemap: true
  },
  external: [
    'd3',
    'dc',
    'crossfilter2',
    'webcola', 
    'dagre',
    'viz.js',
    'css-layout',
    'yoga-layout',
    'metagraph',
    'queue-async'
  ],
  plugins: [
    resolve({
      preferBuiltins: false
    }),
    commonjs()
  ]
};