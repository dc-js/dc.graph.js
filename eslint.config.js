import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';

// Helper function to create a non-fixable version of a rule
function makeRuleNonFixable(rule) {
    const newRule = {
        ...rule,
        meta: {
            ...rule.meta,
        },
        create(context) {
            // Create a wrapped context with modified report function
            const wrappedContext = Object.create(context);
            Object.defineProperty(wrappedContext, 'report', {
                value: descriptor => {
                    // Remove fix from the descriptor if it's an object
                    if (typeof descriptor === 'object' && descriptor !== null) {
                        const {fix, ...rest} = descriptor;
                        return context.report(rest);
                    }
                    return context.report(descriptor);
                },
                writable: false,
                enumerable: true,
                configurable: true,
            });

            return rule.create(wrappedContext);
        },
    };

    // Remove the fixable property from meta
    delete newRule.meta.fixable;

    return newRule;
}

// Create a modified version of import plugin for worker files
const importPluginNoFix = {
    ...importPlugin,
    rules: {
        ...importPlugin.rules,
        'first': makeRuleNonFixable(importPlugin.rules['first']),
        'no-duplicates': makeRuleNonFixable(importPlugin.rules['no-duplicates']),
    },
};

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
        plugins: {
            import: importPlugin,
        },
        rules: {
            // Import order rules
            'import/first': 'error', // All imports must come first
            'import/no-duplicates': 'error', // Combine duplicate imports

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

    // Apply same strict linting to key web files
    {
        files: [
            'web/js/{simple-viewer,brushing-filtering,compare-layouts,explore,flexbox,match-game,network-building,random,resizing,shapes-and-text,drag-drop-composition,app_layout,arrow-designer,ceph_layout,qfs_layout,vfc_layout,dynagraph-main,graph-error,sync-url-options,querystring,example-header,dc.graph.tracker.domain,parse-incrface,index,chart.registry,d3.flexdivs,timeline}.js',
        ],
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
            // Same promise checking as src files
            '@typescript-eslint/no-floating-promises': 'error',

            // Additional strict async/await rules
            '@typescript-eslint/require-await': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
        },
    },
    {
        // Special configuration for worker files - report errors but don't autofix
        files: ['src/workers/*.js'],
        plugins: {
            'import-nofix': importPluginNoFix,
        },
        rules: {
            // Disable the regular fixable import rules
            'import/first': 'off',
            'import/no-duplicates': 'off',

            // Use non-fixable versions instead
            'import-nofix/first': 'error',
            'import-nofix/no-duplicates': 'error',
        },
    },
];
