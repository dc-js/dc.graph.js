import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Standard browser/Node.js globals
                globalThis: 'readonly',
                self: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                window: 'readonly',
                navigator: 'readonly',
                document: 'readonly',
                structuredClone: 'readonly',
                Worker: 'readonly',
                URL: 'readonly',
                SVGElement: 'readonly',
                HTMLDivElement: 'readonly',

                // Web Worker globals
                postMessage: 'readonly',
                onmessage: 'writable',
                importScripts: 'readonly',

                // Library-specific globals (consider migrating to imports)
                THREE: 'readonly',
                setcola: 'readonly',
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
            'no-undef': 'error',
            'no-prototype-builtins': 'off',
        },
    },
    {
        files: ['web/**/*.js', 'examples/**/*.js'],
        languageOptions: {
            globals: {
                // Browser APIs
                FileReader: 'readonly',
                URLSearchParams: 'readonly',
                confirm: 'readonly',
                prompt: 'readonly',
                alert: 'readonly',

                // Library globals (to be removed in jQuery migration)
                $: 'readonly',
                _: 'readonly',

                // DC.js ecosystem globals
                d3: 'readonly',
                dc: 'readonly',
                crossfilter: 'readonly',
                cola: 'readonly',

                // Standard browser globals
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
    {
        files: ['*.config.js', 'scripts/**/*.js'],
        languageOptions: {
            globals: {
                // Node.js globals
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                global: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                require: 'readonly',
            },
        },
    },

    // TypeScript parser for promise checking in source files
    {
        files: ['src/**/*.js'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            '@typescript-eslint/no-floating-promises': 'error',
        },
    },
];
