var querystring = (function() {
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
        }
    };
})();
