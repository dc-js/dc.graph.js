// collapse edges between same source and target
dc_graph.deparallelize = function(group, sourceTag, targetTag, options) {
    options = options || {};
    var both = options.both || false,
        reduce = options.reduce || null;
    return {
        all: function() {
            var ST = {};
            group.all().forEach(function(kv) {
                var source = kv.value[sourceTag],
                    target = kv.value[targetTag];
                var dir = both ? true : source < target;
                var min = dir ? source : target, max = dir ? target : source;
                ST[min] = ST[min] || {};
                var entry;
                if(ST[min][max]) {
                    entry = ST[min][max];
                    if(reduce)
                        entry.original = reduce(entry.original, kv);
                } else ST[min][max] = entry = {in: 0, out: 0, original: Object.assign({}, kv)};
                if(dir)
                    ++entry.in;
                else
                    ++entry.out;
            });
            var ret = [];
            Object.keys(ST).forEach(function(source) {
                Object.keys(ST[source]).forEach(function(target) {
                    var entry = ST[source][target];
                    entry[sourceTag] = source;
                    entry[targetTag] = target;
                    ret.push({key: entry.original.key, value: entry});
                });
            });
            return ret;
        }
    };
};
