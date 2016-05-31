module.exports = function (grunt) {
    'use strict';

    require('load-grunt-tasks')(grunt, {
        pattern: ['grunt-*', '!grunt-lib-phantomjs', '!grunt-template-jasmine-istanbul']
    });
    require('time-grunt')(grunt);

    var config = {
        src: 'src',
        spec: 'spec',
        web: 'web',
        pkg: require('./package.json'),
        banner: grunt.file.read('./LICENSE_BANNER'),
        jsFiles: module.exports.jsFiles,
        jsWorkerFiles: [
            'src/generate_objects.js',
            'src/cola-worker.js'
        ]
    };

    grunt.initConfig({
        conf: config,

        concat: {
            options : {
                process: true,
                sourceMap: true,
                banner : '<%= conf.banner %>'
            },
            main: {
                src: '<%= conf.jsFiles %>',
                dest: '<%= conf.pkg.name %>.js'
            },
            worker: {
                src: '<%= conf.jsWorkerFiles %>',
                dest: '<%= conf.pkg.name %>-worker.js'
            }
        },
        uglify: {
            jsmin: {
                options: {
                    mangle: true,
                    compress: true,
                    sourceMap: true,
                    banner : '<%= conf.banner %>'
                },
                src: '<%= conf.pkg.name %>.js',
                dest: '<%= conf.pkg.name %>.min.js'
            }
        },
        jscs: {
            old: {
                src: ['<%= conf.spec %>/**/*.js'],
                options: {
                    validateIndentation: 4
                }
            },
            source: {
                src: ['<%= conf.src %>/**/*.js', '!<%= conf.src %>/{banner,footer}.js', 'Gruntfile.js',
                    'grunt/*.js', '<%= conf.web %>/stock.js'],
                options: {
                    config: '.jscsrc'
                }
            }
        },
        jshint: {
            source: {
                src: ['<%= conf.src %>/**/*.js', 'Gruntfile.js', 'grunt/*.js', '<%= conf.web %>/stock.js'],
                options: {
                    jshintrc: '.jshintrc',
                    ignores: ['<%= conf.src %>/banner.js', '<%= conf.src %>/footer.js']
                }
            }
        },
        watch: {
            scripts: {
                files: ['<%= conf.src %>/**/*.js', 'dc.graph.css'],
                tasks: ['docs']
            },
            jsdoc2md: {
                files: ['<%= conf.src %>/**/*.js'],
                tasks: ['build', 'jsdoc2md']
            },
            jasmineRunner: {
                files: ['<%= conf.spec %>/**/*.js'],
                tasks: ['jasmine:specs:build']
            },
            tests: {
                files: ['<%= conf.src %>/**/*.js', '<%= conf.spec %>/**/*.js'],
                tasks: ['test']
            },
            reload: {
                files: ['<%= conf.pkg.name %>.js',
                    '<%= conf.pkg.name %>css',
                    '<%= conf.web %>/js/<%= conf.pkg.name %>.js',
                    '<%= conf.web %>/css/<%= conf.pkg.name %>.css',
                    '<%= conf.pkg.name %>.min.js'],
                options: {
                    livereload: true
                }
            }
        },
        connect: {
            server: {
                options: {
                    port: 8888,
                    base: '.'
                }
            }
        },
        jasmine: {
            specs: {
                options: {
                    display: 'short',
                    summary: true,
                    specs:  '<%= conf.spec %>/*-spec.js',
                    helpers: '<%= conf.spec %>/helpers/*.js',
                    version: '2.0.0',
                    outfile: '<%= conf.spec %>/index.html',
                    keepRunner: true
                },
                src: [
                    '<%= conf.web %>/js/d3.js',
                    '<%= conf.web %>/js/crossfilter.js',
                    '<%= conf.web %>/js/colorbrewer.js',
                    '<%= conf.pkg.name %>.js'
                ]
            },
            coverage:{
                src: '<%= jasmine.specs.src %>',
                options:{
                    specs: '<%= jasmine.specs.options.specs %>',
                    helpers: '<%= jasmine.specs.options.helpers %>',
                    version: '<%= jasmine.specs.options.version %>',
                    template: require('grunt-template-jasmine-istanbul'),
                    templateOptions: {
                        coverage: 'coverage/jasmine/coverage.json',
                        report: [
                            {
                                type: 'html',
                                options: {
                                    dir: 'coverage/jasmine'
                                }
                            }
                        ]
                    }
                }
            },
            browserify: {
                options: {
                    display: 'short',
                    summary: true,
                    specs:  '<%= conf.spec %>/*-spec.js',
                    helpers: '<%= conf.spec %>/helpers/*.js',
                    version: '2.0.0',
                    outfile: '<%= conf.spec %>/index-browserify.html',
                    keepRunner: true
                },
                src: [
                    'bundle.js'
                ]
            }
        },
        'saucelabs-jasmine': {
            all: {
                options: {
                    urls: ['http://localhost:8888/spec/'],
                    tunnelTimeout: 5,
                    build: process.env.TRAVIS_JOB_ID,
                    concurrency: 3,
                    browsers: [
                        {
                            browserName: 'firefox',
                            version: '25',
                            platform: 'linux'
                        },
                        {
                            browserName: 'safari',
                            version: '7',
                            platform: 'OS X 10.9'
                        },
                        {
                            browserName: 'internet explorer',
                            version: '10',
                            platform: 'WIN8'
                        }
                    ],
                    testname: '<%= conf.pkg.name %>.js'
                }
            }
        },
        jsdoc2md: {
            dist: {
                src: 'dc.graph.js',
                dest: 'web/docs/api-latest.md'
            }
        },
        copy: {
            'dc-to-gh': {
                files: [
                    {
                        expand: true,
                        flatten: true,
                        src: [
                            '<%= conf.pkg.name %>.css',
                            'node_modules/dc/dc.css',
                            'node_modules/font-awesome/css/font-awesome.css'
                        ],
                        dest: '<%= conf.web %>/css/'
                    },
                    {
                        expand: true,
                        flatten: true,
                        src: [
                            '<%= conf.pkg.name %>.js',
                            '<%= conf.pkg.name %>.js.map',
                            '<%= conf.pkg.name %>.min.js',
                            '<%= conf.pkg.name %>.min.js.map',
                            '<%= conf.pkg.name %>-worker.js',
                            '<%= conf.pkg.name %>-worker.js.map',
                            'node_modules/jquery/dist/jquery.js',
                            'node_modules/d3/d3.js',
                            'node_modules/queue-async/queue.js',
                            'node_modules/dc/dc.js',
                            'node_modules/crossfilter/crossfilter.js',
                            'test/env-data.js'
                        ],
                        dest: '<%= conf.web %>/js/'
                    },
                    {
                        expand: true,
                        flatten: true,
                        src: [
                            'node_modules/font-awesome/fonts/*'
                        ],
                        dest: '<%= conf.web %>/fonts/'
                    },
                    {
                        expand: true,
                        flatten: true,
                        src: 'node_modules/d3-tip/index.js',
                        dest: '<%= conf.web %>/js/d3-tip/'
                    },
                    {
                        expand: true,
                        flatten: true,
                        src: 'node_modules/d3-tip/examples/example-styles.css',
                        dest: '<%= conf.web %>/css/d3-tip/'
                    }
                ]
            }
        },
        'gh-pages': {
            options: {
                base: '<%= conf.web %>',
                message: 'Synced from from master branch.'
            },
            src: ['**']
        },
        shell: {
            merge: {
                command: function (pr) {
                    return [
                        'git fetch origin',
                        'git checkout master',
                        'git reset --hard origin/master',
                        'git fetch origin',
                        'git merge --no-ff origin/pr/' + pr + ' -m \'Merge pull request #' + pr + '\''
                    ].join('&&');
                },
                options: {
                    stdout: true,
                    failOnError: true
                }
            },
            amend: {
                command: 'git commit -a --amend --no-edit',
                options: {
                    stdout: true,
                    failOnError: true
                }
            },
            hooks: {
                command: 'cp -n scripts/pre-commit.sh .git/hooks/pre-commit' +
                    ' || echo \'Cowardly refusing to overwrite your existing git pre-commit hook.\''
            }
        },
        browserify: {
            dev: {
                src: '<%= conf.pkg.name %>.js',
                dest: 'bundle.js',
                options: {
                    browserifyOptions: {
                        standalone: 'dc'
                    }
                }
            }
        }
    });

    // custom tasks
    grunt.registerTask('merge', 'Merge a github pull request.', function (pr) {
        grunt.log.writeln('Merge Github Pull Request #' + pr);
        grunt.task.run(['shell:merge:' + pr, 'test' , 'shell:amend']);
    });
    grunt.registerTask('test-stock-example', 'Test a new rendering of the stock example web page against a ' +
        'baseline rendering', function (option) {
            require('./regression/stock-regression-test.js').testStockExample(this.async(), option === 'diff');
        });
    grunt.registerTask('update-stock-example', 'Update the baseline stock example web page.', function () {
        require('./regression/stock-regression-test.js').updateStockExample(this.async());
    });
    grunt.registerTask('watch:jasmine', function () {
        grunt.config('watch', {
            options: {
                interrupt: true
            },
            runner: grunt.config('watch').jasmineRunner,
            scripts: grunt.config('watch').scripts
        });
        grunt.task.run('watch');
    });

    // task aliases
    grunt.registerTask('build', ['concat', 'uglify']);
    grunt.registerTask('docs', ['build', 'copy', 'jsdoc2md']);
    grunt.registerTask('web', ['docs', 'gh-pages']);
    grunt.registerTask('server', ['docs', 'jasmine:specs:build', 'connect:server', 'watch:jasmine']);
    grunt.registerTask('test', ['build', 'jasmine:specs']);
    grunt.registerTask('test-browserify', ['build', 'browserify', 'jasmine:browserify']);
    grunt.registerTask('coverage', ['build', 'jasmine:coverage']);
    grunt.registerTask('ci', ['test', 'jasmine:specs:build', 'connect:server', 'saucelabs-jasmine']);
    grunt.registerTask('ci-pull', ['test', 'jasmine:specs:build', 'connect:server']);
    grunt.registerTask('lint', ['build', 'jshint', 'jscs']);
    grunt.registerTask('jsdoc', ['build', 'jsdoc2md', 'watch:jsdoc2md']);
    grunt.registerTask('default', ['build', 'shell:hooks']);
};

module.exports.jsFiles = [
    'src/banner.js',   // NOTE: keep this first
    'src/core.js',
    'src/depth_first_traversal.js',
    'src/generate_objects.js',
    'src/shape.js',
    'src/diagram.js',
    'src/legend.js',
    'src/constraint_pattern.js',
    'src/tree_constraints.js',
    'src/tree_positions.js',
    'src/behavior.js',
    'src/tip.js',
    'src/highlight_neighbors.js',
    'src/highlight_paths_group.js',
    'src/highlight_paths.js',
    'src/expand_collapse.js',
    'src/load_graph.js',
    'src/convert_nest.js',
    'src/path_reader.js',
    'src/generate.js',
    'src/type-graph.js',
    'src/footer.js'  // NOTE: keep this last
];
