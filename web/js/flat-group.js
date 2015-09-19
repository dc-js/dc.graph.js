// when there will be exactly one or zero items in a group, a reasonable reduction
// is just to use the row or null
var flat_group = (function() {
    function one_zero_reduce(group) {
        group.reduce(
            function(p, v) { return v; },
            function() { return null; },
            function() { return null; }
        );
    }
    function non_null(group) {
        return {
            all: function() {
                return group.all().filter(function(kv) {
                    return kv.value !== null;
                });
            }
        };
    }

    return {
        make: function(vec, id_accessor) {
            var ndx = crossfilter(vec);

            var dimension = ndx.dimension(id_accessor),
                group = dimension.group();

            one_zero_reduce(group);
            return {crossfilter: ndx, dimension: dimension, group: non_null(group)};
        }
    };
})();


