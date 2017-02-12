/**
 * `dc_graph.flat_group` implements a special ["fake group"](https://github.com/dc-js/dc.js/wiki/FAQ#fake-groups)
 * for the special case where you want a group that represents the filtered rows of the crossfilter.
 *
 * Although `dc_graph` can be used with reduced data, typically the nodes and edges are just rows of
 * the corresponding data arrays, and each array has a column which contains the unique identifier
 * for the node or edge. In this setup, there are other dimensions and groups which are aggregated
 * for the use of dc.js charts, but the graph just shows or does not show the nodes and edges from
 * the rows.
 *
 * This simple class supports that use case in three steps:
 *  1. It creates a dimension keyed on the unique identifier (specified to `flat_group.make`)
 *  2. It creates a group from the dimension with a reduction function that returns the row when the
 *  row is filtered in, and `null` when the row is filtered out.
 *  3. It wraps the group in a fake group which filters out the resulting nulls.
 *
 * The result is a fake group whose `.all()` method returns an array of the currently filtered-in
 * `{key, value}` pairs, where the key is that returned by the ID accessor, and the value is the raw
 * row object from the data.
 *
 * This could be a useful crossfilter utility outside of dc.graph. For example, bubble charts and
 * scatter plots often use similar functionality because each observation is either shown or not,
 * and it is helpful to have the entire row available as reduced data.
 *
 * But it would need to be generalized and cleaned up. (For example, the way it has to create the
 * crossfilter and dimension is kinda dumb.) And there is currently no such crossfilter utility
 * library to put it in.
 *
 * @namespace flat_group
 * @memberof dc_graph
 * @type {{}}
**/

dc_graph.flat_group = (function() {
    var reduce_01 = {
        add: function(p, v) { return v; },
        remove: function() { return null; },
        init: function() { return null; }
    };
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
        var dimension = ndx.dimension(id_accessor);
        return {
            crossfilter: ndx,
            dimension: dimension,
            group: non_null(dimension.group().reduce(reduce_01.add,
                                                     reduce_01.remove,
                                                     reduce_01.init))
        };
    }

    return {
        /**
         * Create a crossfilter, dimension, and flat group, as described in {@link dc_graph.flat_group flat_group}.
         * Returns an object containing all three.

         * @method make
         * @memberof dc_graph.flat_group
         * @param {Array} vec - the data array for crossfilter
         * @param {Function} id_accessor - accessor function taking a row object and returning its
         * unique identifier
         * @return {Object} `{crossfilter, dimension, group}`
         **/
        make: function(vec, id_accessor) {
            var ndx = crossfilter(vec);
            return dim_group(ndx, id_accessor);
        },
        /**
         * Create a flat dimension and group from an existing crossfilter.
         *
         * This is a wretched name for this function.

         * @method another
         * @memberof dc_graph.flat_group
         * @param {Object} ndx - crossfilter instance
         * @param {Function} id_accessor - accessor function taking a row object and returning its
         * unique identifier
         * @return {Object} `{crossfilter, dimension, group}`
         **/
        another: function(ndx, id_accessor) {
            return dim_group(ndx, id_accessor);
        }
    };
})();


