/* this independent library is looking for a home
 it provides round-trip query string parsing & generating
 Copyright 2016 AT&T Intellectual Property
 License: Apache v2
 */

var querystring = (function() {
    var listsep_ = '|';
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
        get_url: function(m) {
            var url = window.location.protocol + '//' + window.location.host + window.location.pathname;
            var params = this.generate(m);
            if(params)
                url += '?' + params;
            return url;
        },
        update: function(m) {
            window.history.pushState(null, null, this.get_url(m));
            return this;
        },
        option_tracker: function() {
            throw new Error('use independent url_options library');
        }
    };
})();
