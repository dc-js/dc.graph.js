import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
    input: "node_modules/yoga-layout/dist/entry-browser.js",
    output: {
        name: "yogaLayout",
        file: "yoga-layout.js",
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
