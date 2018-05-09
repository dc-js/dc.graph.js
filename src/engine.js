dc_graph.spawn_engine = function(layout, args, worker) {
    args = args || {};
    var engine = dc_graph.engines.instantiate(layout, args, worker);
    if(!engine) {
        console.warn('layout engine ' + layout + ' not found; using default ' + dc_graph._default_engine);
        engine = dc_graph.engines.instantiate(dc_graph._default_engine, args, worker);
    }
    return engine;
};

dc_graph._engines = [
    {
        name: 'dagre',
        params: ['rankdir'],
        instantiate: function() {
            return dc_graph.dagre_layout();
        }
    },
    {
        name: 'd3force',
        instantiate: function() {
            return dc_graph.d3_force_layout();
        }
    },
    {
        name: 'd3v4force',
        instantiate: function() {
            return dc_graph.d3v4_force_layout();
        }
    },
    {
        name: 'tree',
        instantiate: function() {
            return dc_graph.tree_layout();
        }
    },
    {
        names: ['circo', 'dot', 'neato', 'osage', 'twopi', 'fdp'],
        instantiate: function(layout, args) {
            return dc_graph.graphviz_layout(null, layout, args.server);
        }
    },
    {
        name: 'cola',
        params: ['lengthStrategy'],
        instantiate: function() {
            return dc_graph.cola_layout();
        }
    }
];
dc_graph._default_engine = 'cola';

dc_graph.engines = {
    entry_pred: function(layoutName) {
        return function(e) {
            return e.name === layoutName || e.names && e.names.includes(layoutName);
        };
    },
    get: function(layoutName) {
        return dc_graph._engines.find(this.entry_pred(layoutName));
    },
    instantiate: function(layout, args, worker) {
        var entry = this.get(layout);
        if(!entry)
            return null;
        var engine = entry.instantiate(layout, args),
            params = entry.params || [];
        params.forEach(function(p) {
            if(args[p])
                engine[p](args[p]);
        });
        if(engine.supportsWebworker && engine.supportsWebworker() && worker)
            engine = dc_graph.webworker_layout(engine);
        return engine;
    },
    available: function() {
        return dc_graph._engines.reduce(function(avail, entry) {
            return avail.concat(entry.name ? [entry.name] : entry.names);
        }, []);
    },
    unregister: function(layoutName) {
        // meh. this is a bit much. there is such a thing as making the api too "easy".
        var i = dc_graph._engines.findIndex(this.entry_pred(layoutName));
        var remove = false;
        if(i < 0)
            return false;
        var entry = dc_graph._engines[i];
        if(entry.name === layoutName)
            remove = true;
        else {
            var j = entry.names.indexOf(layoutName);
            if(j >= 0)
                entry.names.splice(j, 1);
            else
                console.warn('search for engine failed', layoutName);
            if(entry.names.length === 0)
                remove = true;
        }
        if(remove)
            dc_graph._engines.splice(i, 1);
        return true;
    },
    register: function(entry) {
        var that = this;
        if(!entry.instantiate) {
            console.error('engine definition needs instantiate: function(layout, args) { ... }');
            return this;
        }
        if(entry.name)
            this.unregister(entry.name);
        else if(entry.names)
            entry.names.forEach(function(layoutName) {
                that.unregister(layoutName);
            });
        else {
            console.error('engine definition needs name or names[]');
            return this;
        }
        dc_graph._engines.push(entry);
        return this;
    }
};
