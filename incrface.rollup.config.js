import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';

export default {
    input: 'web/js/incrface.mjs',
    output: {
        name: 'incrface',
        file: 'incrface-umd.js',
        format: 'umd',
    },
    plugins: [
        nodeResolve({
            jsnext: true,
            main: true,
        }),
        commonjs(),
    ],
};
