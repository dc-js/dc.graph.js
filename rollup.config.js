import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

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
    'metagraph',
    'queue-async',
    'tippy.js'
  ],
  plugins: [
    json(),
    resolve({
      preferBuiltins: false
    }),
    commonjs()
  ]
};