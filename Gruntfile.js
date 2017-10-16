module.exports = function (grunt) {
    'use strict';

    require('load-grunt-tasks')(grunt, {
        pattern: ['grunt-*']
    });
    require('time-grunt')(grunt);

    var config = {
        src: 'src',
        spec: 'spec',
        web: 'web',
        pkg: require('./package.json'),
        banner: grunt.file.read('./LICENSE_BANNER'),
        jsFiles: module.exports.jsFiles,
        colaWorkerFiles: [
            'src/core.js',
            'src/generate_objects.js',
            'src/graphviz_attrs.js',
            'src/cola_layout.js',
            'src/webworker_message.js'
        ],
        dagreWorkerFiles: [
            'src/core.js',
            'src/generate_objects.js',
            'src/graphviz_attrs.js',
            'src/dagre_layout.js',
            'src/webworker_message.js'
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
            colaWorker: {
                src: '<%= conf.colaWorkerFiles %>',
                dest: '<%= conf.pkg.name %>.cola.worker.js'
            },
            dagreWorker: {
                src: '<%= conf.dagreWorkerFiles %>',
                dest: '<%= conf.pkg.name %>.dagre.worker.js'
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
                tasks: ['build', 'copy']
            },
            docs: {
                files: ['welcome.md', '<%= conf.src %>/**/*.js', 'dc.graph.css'],
                tasks: ['docs']
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
                    port: process.env.PORT || 8888,
                    base: '.'
                }
            }
        },
        jsdoc: {
            dist: {
                src: ['welcome.md', '<%= conf.src %>/**/*.js', '!<%= conf.src %>/{banner,footer}.js'],
                options: {
                    destination: 'web/docs/html',
                    template: 'node_modules/ink-docstrap/template',
                    configure: 'jsdoc.conf.json'
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
                        nonull: true,
                        expand: true,
                        flatten: true,
                        src: [
                            '<%= conf.pkg.name %>.css',
                            'node_modules/bootstrap/dist/css/bootstrap.css',
                            'node_modules/dc/dc.css',
                            'node_modules/font-awesome/css/font-awesome.css',
                            'node_modules/jquery-ui-dist/jquery-ui.css'
                        ],
                        dest: '<%= conf.web %>/css/'
                    },
                    {
                        nonull: true,
                        expand: true,
                        flatten: true,
                        src: [
                            '<%= conf.pkg.name %>.js',
                            '<%= conf.pkg.name %>.js.map',
                            '<%= conf.pkg.name %>.min.js',
                            '<%= conf.pkg.name %>.min.js.map',
                            '<%= conf.pkg.name %>.cola.worker.js',
                            '<%= conf.pkg.name %>.cola.worker.js.map',
                            '<%= conf.pkg.name %>.dagre.worker.js',
                            '<%= conf.pkg.name %>.dagre.worker.js.map',
                            'd3.flexdivs.js',
                            'dc.graph.tracker.domain.js',
                            'lysenko-interval-tree.js',
                            'querystring.js',
                            'chart.registry.js',
                            'timeline.js',
                            'node_modules/bootstrap/dist/js/bootstrap.js',
                            'node_modules/crossfilter2/crossfilter.js',
                            'node_modules/d3/d3.js',
                            'node_modules/dc/dc.js',
                            'node_modules/jquery/dist/jquery.js',
                            'node_modules/jquery-ui-dist/jquery-ui.js',
                            'node_modules/lodash/lodash.js',
                            'node_modules/queue-async/build/queue.js',
                            'node_modules/dagre/dist/dagre.js',
                            'node_modules/webcola/WebCola/cola.js',
                            'node_modules/viz.js/viz.js'
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

    // task aliases
    grunt.registerTask('build', ['concat', 'uglify']);
    grunt.registerTask('docs', ['build', 'copy', 'jsdoc', 'jsdoc2md']);
    grunt.registerTask('web', ['docs', 'gh-pages']);
    grunt.registerTask('server', ['build', 'copy', 'connect:server', 'watch:scripts']);
    grunt.registerTask('server:docs', ['docs', 'connect:server', 'watch:docs']);
    grunt.registerTask('lint', ['build', 'jshint', 'jscs']);
    grunt.registerTask('default', ['build', 'shell:hooks']);
    grunt.registerTask('doc-debug', ['build', 'jsdoc', 'jsdoc2md', 'connect:server', 'watch:docs']);
};

module.exports.jsFiles = [
    'src/banner.js',   // NOTE: keep this first
    'src/core.js',
    'src/utils.js',
    'src/depth_first_traversal.js',
    'src/generate_objects.js',
    'src/shape.js',
    'src/node_contents.js',
    'src/diagram.js',
    'src/engine.js',
    'src/webworker_layout.js',
    'src/graphviz_attrs.js',
    'src/cola_layout.js',
    'src/dagre_layout.js',
    'src/tree_layout.js',
    'src/graphviz_layout.js',
    'src/place_ports.js',
    'src/troubleshoot.js',
    'src/validate.js',
    'src/legend.js',
    'src/constraint_pattern.js',
    'src/tree_positions.js',
    'src/tree_constraints.js',
    'src/behavior.js',
    'src/tip.js',
    'src/keyboard.js',
    'src/edit_text.js',
    'src/brush.js',
    'src/select_things.js',
    'src/select_nodes.js',
    'src/select_edges.js',
    'src/select_ports.js',
    'src/move_nodes.js',
    'src/fix_nodes.js',
    'src/filter_selection.js',
    'src/delete_things.js',
    'src/delete_nodes.js',
    'src/label_things.js',
    'src/label_nodes.js',
    'src/label_edges.js',
    'src/highlight_neighbors.js',
    'src/highlight_paths_group.js',
    'src/highlight_paths.js',
    'src/expand_collapse.js',
    'src/draw_graphs.js',
    'src/match_ports.js',
    'src/symbol_port_style.js',
    'src/load_graph.js',
    'src/munge_graph.js',
    'src/flat_group.js',
    'src/convert.js',
    'src/path_reader.js',
    'src/path_selector.js',
    'src/generate.js',
    'src/line_breaks.js',
    'src/type_graph.js',
    'src/footer.js'  // NOTE: keep this last
];
