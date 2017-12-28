import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
    input: "node_modules/interval-tree-1d/interval-tree.js",
    output: {
        name: "lysenkoIntervalTree",
        file: "lysenko-interval-tree.js",
        format: "umd"
    },
    plugins: [
        nodeResolve({
            jsnext: true,
            main: true
        }),
        commonjs()
    ]
};
