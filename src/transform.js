// collapse edges between same source and target
export function deparallelize(group, sourceTag, targetTag, options) {
    options = options || {};
    const both = options.both || false,
        reduce = options.reduce || null;
    return {
        all() {
            const ST = {};
            group.all().forEach((kv) => {
                const source = kv.value[sourceTag],
                    target = kv.value[targetTag];
                const dir = both ? true : source < target;
                const min = dir ? source : target, max = dir ? target : source;
                ST[min] = ST[min] || {};
                let entry;
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
            const ret = [];
            Object.keys(ST).forEach((source) => {
                Object.keys(ST[source]).forEach((target) => {
                    const entry = ST[source][target];
                    entry[sourceTag] = source;
                    entry[targetTag] = target;
                    ret.push({key: entry.original.key, value: entry});
                });
            });
            return ret;
        }
    };
};
