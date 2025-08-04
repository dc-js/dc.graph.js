import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                globalThis: 'readonly',
                self: 'readonly',
                postMessage: 'readonly',
                onmessage: 'writable',
                importScripts: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                window: 'readonly',
                navigator: 'readonly',
                document: 'readonly',
                THREE: 'readonly',
                setcola: 'readonly',
                Viz: 'readonly',
                graphlibDot: 'readonly',
                '_': 'readonly',
                lysenkoIntervalTree: 'readonly',
                metagraph: 'readonly',
                structuredClone: 'readonly',
                computeLayout: 'readonly',
                Worker: 'readonly',
                URL: 'readonly',
                SVGElement: 'readonly',
                HTMLDivElement: 'readonly',
                dc_graph: 'readonly',
                importScripts: 'readonly',
                onmessage: 'writable',
                postMessage: 'readonly',
            },
        },
        rules: {
            // Arrow function conversion rules
            'prefer-arrow-callback': ['error', {
                allowNamedFunctions: false,
                allowUnboundThis: true,
            }],
            'arrow-body-style': ['error', 'as-needed'],

            // Modernization rules (auto-fixable)
            'prefer-const': 'error',
            'no-var': 'error',
            'prefer-object-has-own': 'error',
            'prefer-exponentiation-operator': 'error',
            'prefer-numeric-literals': 'error',
            'prefer-template': 'error',
            'object-shorthand': ['error', 'always'],

            // Unused variables - allow underscore prefix
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],

            // Relaxed rules for legacy code
            'no-undef': 'warn',
            'no-prototype-builtins': 'off',
        },
    },
    {
        files: ['web/**/*.js', 'examples/**/*.js'],
        languageOptions: {
            globals: {
                d3: 'readonly',
                dc: 'readonly',
                dc_graph: 'readonly',
                crossfilter: 'readonly',
                cola: 'readonly',
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
            },
        },
    },
    {
        files: ['**/*.worker.js', 'src/workers/**/*.js'],
        languageOptions: {
            globals: {
                // Web worker specific globals
                postMessage: 'readonly',
                onmessage: 'writable',
                importScripts: 'readonly',
                self: 'readonly',
            },
        },
    },
];
