/* this independent library is looking for a home
 it provides round-trip query string parsing & generating
 Copyright 2016 AT&T Intellectual Property
 License: Apache v2
 */

let listsep_ = '|';

const querystring = {
    listsep(s) {
        if (!arguments.length)
            return listsep_;
        listsep_ = s;
        return this;
    },
    parse(opts = {}) {
        return (a => {
            if (a === '')
                return {};
            const b = {};
            for (let i = 0; i < a.length; ++i) {
                const p = a[i].split('=', 2);
                if (p.length === 1)
                    b[p[0]] = opts.boolean ? true : '';
                else
                    b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, ' '));
            }
            return b;
        })(window.location.search.substr(1).split('&'));
    },
    generate(m, encode = true) {
        const parts = [];
        for (const k in m)
            parts.push(`${k}=${encode ? encodeURIComponent(m[k]) : m[k]}`);
        return parts.length ? parts.join('&') : '';
    },
    get_url(m, encode) {
        let url = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
        const params = this.generate(m, encode);
        if (params)
            url += `?${params}`;
        return url;
    },
    update(m, encode) {
        window.history.pushState(null, null, this.get_url(m, encode));
        return this;
    },
    option_tracker() {
        throw new Error('use independent url_options library');
    },
};

export default querystring;
