var flat_group = (function() {
    // when there will be exactly one or zero items in a group, a reasonable reduction
    // is just to use the row or null
    function one_zero_reduce(group) {
        group.reduce(
            function(p, v) { return v; },
            function() { return null; },
            function() { return null; }
        );
    }
    // now we only really want to see the non-null values, so make a fake group
    function non_null(group) {
        return {
            all: function() {
                return group.all().filter(function(kv) {
                    return kv.value !== null;
                });
            }
        };
    }

    function dim_group(ndx, id_accessor) {
        var dimension = ndx.dimension(id_accessor),
            group = dimension.group();

        one_zero_reduce(group);
        return {crossfilter: ndx, dimension: dimension, group: non_null(group)};
    }

    return {
        make: function(vec, id_accessor) {
            var ndx = crossfilter(vec);
            return dim_group(ndx, id_accessor);
        },
        another: function(ndx, id_accessor) { // wretched name
            return dim_group(ndx, id_accessor);
        }
    };
})();


