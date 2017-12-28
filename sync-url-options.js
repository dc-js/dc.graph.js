// utility to keep query string parameters in sync with some inputs (and vice versa)
// currently uses jquery but otherwise it maybe should be released separately of dc.graph
// Copyright 2016-2017 AT&T Intellectual Property
// License: Apache v2

var sync_url_options = (function() {
    if(!querystring)
        throw new Error('need querystring library');
    function read_query(type, val) {
        switch(type) {
        case 'boolean':
            return val === 'true';
        case 'number':
            return +val;
        case 'string':
            return val;
        case 'array':
            return val.split(querystring.listsep());
        default: throw new Error('unsupported query type ' + type);
        }
    }

    function write_query(type, val) {
        switch(type) {
        case 'array':
            return val.join(querystring.listsep());
        case 'boolean':
        case 'number':
        case 'string':
            return '' + val;
        default: throw new Error('unsupported query type ' + type);
        }
    }

    function query_type(val) {
        return Array.isArray(val) ? 'array' : typeof val;
    }

    // we could probably depend on _, but _.pick is the only thing we need atm
    function pick(object, fields) {
        return fields.reduce(function(reduced, key) {
            if(key in object)
                reduced[key] = object[key];
            return reduced;
        }, {});
    }

    function option_synchronizer(options, domain, args) {
        var qs = querystring.parse();
        var settings = {};

        function update_interesting(qs) {
            var interesting = Object.keys(options)
                    .filter(function(k) {
                        return qs[options[k].query] !== write_query(query_type(options[k].default), options[k].default);
                    }).map(function(k) {
                        return options[k].query || k;
                    });
            var interested = pick(qs, interesting);
            querystring.update(interested);
        }

        function do_option(key, opt, callback) {
            settings[key] = opt.default;
            var query = opt.query = opt.query || key;
            var type = query_type(opt.default);
            if(query in qs)
                settings[key] = read_query(type, qs[query]);

            function update_setting(opt, val) {
                settings[key] = val;
                if(opt.query) {
                    qs[opt.query] = write_query(type, val);
                    update_interesting(qs);
                }
            }
            if(opt.values) { // generate <select> options
                var select = d3.select(opt.selector);
                var opts = select.selectAll('option').data(opt.values);
                opts.enter().append('option').attr({
                    value: function(x) { return x; },
                    selected: function(x) { return x === settings[key]; }
                }).text(function(x) { return x; });
                select
                    .property('value', settings[key]);
            }
            if(opt.selector) {
                switch(type) {
                case 'boolean':
                    if(!opt.set)
                        opt.set = function(val) {
                            $(opt.selector)
                                .prop('checked', val);
                        };
                    if(!opt.subscribe)
                        opt.subscribe = function(k) {
                            $(opt.selector)
                                .change(function() {
                                    var val = $(this).is(':checked');
                                    k(val);
                                });
                        };
                    break;
                case 'number':
                case 'string':
                    if(!opt.set)
                        opt.set = function(val) {
                            $(opt.selector)
                                .val(val);
                        };
                    if(!opt.subscribe)
                        opt.subscribe = function(k) {
                            $(opt.selector)
                                .change(function() {
                                    var val = $(this).val();
                                    k(val);
                                });
                        };
                    break;
                default: throw new Error('unsupported selector type ' + type);
                }
            }
            if(opt.set)
                opt.set(settings[key]);
            if(opt.subscribe)
                opt.subscribe(function(val) {
                    update_setting(opt, val);
                    callback && callback(val);
                });
        }

        for(var key in options) {
            var callback = function(opt, val) {
                args[0] = val;
                if(opt.exert && !opt.dont_exert_after_subscribe)
                    opt.exert.apply(opt, args);
                if(domain && domain.on_exert)
                    domain.on_exert(opt);
            };
            do_option(key, options[key], callback.bind(null, options[key]));
        }

        return {
            vals: settings,
            exert: function() {
                for(var key in options)
                    if(options[key].exert) {
                        args[0] = settings[key];
                        options[key].exert.apply(options[key], args);
                    }
            }
        };
    }
    return function(options, domain /* ... arguments for exert ... */) {
        var args = Array.prototype.slice.call(arguments, 2);
        args.unshift(0);
        return option_synchronizer(options, domain, args);
    };
})();

