var querystring = (function() {
    function read_query(type, val) {
        switch(type) {
        case 'boolean':
            return val === 'true';
        case 'number':
            return +val;
        case 'string':
            return val;
        case 'array':
            return val.split('|');
        default: throw new Error('unsupported query type ' + type);
        }
    }

    function write_query(type, val) {
        switch(type) {
        case 'array':
            return val.join('|');
        case 'boolean':
        case 'number':
        case 'string':
            return '' + val;
        default: throw new Error('unsupported query type ' + type);
        }
    }

    function query_type(val) {
        return _.isArray(val) ? 'array' : typeof val;
    }

    function update_interesting() {
        var interesting = _.keys(options)
                .filter(function(k) {
                    return qs[options[k].query] !== write_query(query_type(options[k].default), options[k].default);
                }).map(function(k) {
                    return options[k].query || k;
                });
        querystring.update(_.pick(qs, interesting));
    }

    function do_option(settings, key, opt) {
        settings[key] = opt.default;
        var query = opt.query = opt.query || key;
        var type = query_type(opt.default);
        if(query in qs)
            settings[key] = read_query(type, qs[query]);

        function update_setting(opt, val) {
            settings[key] = val;
            if(opt.query) {
                qs[opt.query] = write_query(type, val);
                update_interesting();
            }
            if(opt.apply && !opt.dont_apply_after_subscribe)
                opt.apply(val, diagram, filters);
            if(opt.needs_relayout)
                diagram.relayout();
            if(opt.needs_redraw)
                do_redraw();
        }
        if(opt.selector) {
            switch(type) {
            case 'boolean':
                if(!opt.set && opt.selector)
                    opt.set = function(val) {
                        $(opt.selector)
                            .prop('checked', val);
                    };
                if(!opt.subscribe && opt.selector)
                    opt.subscribe = function(k) {
                        $(opt.selector)
                            .change(function() {
                                var val = $(this).is(':checked');
                                k(val);
                            });
                    };
                break;
            case 'string':
                if(!opt.set && opt.selector)
                    opt.set = function(val) {
                        $(opt.selector)
                            .val(val);
                    };
                if(!opt.subscribe && opt.selector)
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
            });
    }

    return {
        parse: function() {
            return (function(a) {
                if (a == "") return {};
                var b = {};
                for (var i = 0; i < a.length; ++i)
                {
                    var p=a[i].split('=', 2);
                    if (p.length == 1)
                        b[p[0]] = "";
                    else
                        b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
                }
                return b;
            })(window.location.search.substr(1).split('&'));
        },
        update: function(m) {
            var base = window.location.protocol + '//' + window.location.host + window.location.pathname;
            var parts = [];
            for(var k in m)
                parts.push(k + '=' + encodeURIComponent(m[k]));
            var url = base + '?' + parts.join('&');
            window.history.pushState(null, null, url);
            return this;
        },
        do_options: function(options) {
            var settings = {};
            for(var key in options)
                do_option(settings, key, options[key]);
            return settings;
        },
        apply_options: function(options, settings /* ... */) {
            var args = Array.prototype.slice.call(arguments, 2);
            args.unshift(0);
            for(var key in options)
                if(options[key].apply) {
                    args[0] = settings[key];
                    options[key].apply.apply(options[key], args);
                }
        }
    };
})();
