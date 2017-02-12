/* this independent library is looking for a home
 it provides round-trip query string parsing & generating
 Copyright 2016 Gordon Woodhull, MIT License
 */

var querystring = (function() {
    var listsep_ = '|';
    function read_query(type, val) {
        switch(type) {
        case 'boolean':
            return val === 'true';
        case 'number':
            return +val;
        case 'string':
            return val;
        case 'array':
            return val.split(listsep_);
        default: throw new Error('unsupported query type ' + type);
        }
    }

    function write_query(type, val) {
        switch(type) {
        case 'array':
            return val.join(listsep_);
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

    function create_tracker(options, domain, args) {
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

    return {
        listsep: function(s) {
            if(!arguments.length)
                return listsep_;
            listsep_ = s;
            return this;
        },
        parse: function(opts) {
            opts = opts || {};
            return (function(a) {
                if (a == "") return {};
                var b = {};
                for (var i = 0; i < a.length; ++i)
                {
                    var p=a[i].split('=', 2);
                    if (p.length == 1)
                        b[p[0]] = opts.boolean ? true : "";
                    else
                        b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
                }
                return b;
            })(window.location.search.substr(1).split('&'));
        },
        generate: function(m) {
            var parts = [];
            for(var k in m)
                parts.push(k + '=' + encodeURIComponent(m[k]));
            return parts.length ? parts.join('&') : '';
        },
        update: function(m) {
            var url = window.location.protocol + '//' + window.location.host + window.location.pathname;
            var params = this.generate(m);
            if(params)
                url += '?' + params;
            window.history.pushState(null, null, url);
            return this;
        },
        option_tracker: function(options, domain /* ... arguments for exert ... */) {
            var args = Array.prototype.slice.call(arguments, 2);
            args.unshift(0);
            return create_tracker(options, domain, args);
        }
    };
})();
