import node from "rollup-plugin-node-resolve";

export default {
  input: "node_modules/d3-force/index.js",
    output: {
        name: "d3v4",
        file: "d3v4-force.js",
        format: "umd"
    },
  plugins: [node()]
};
