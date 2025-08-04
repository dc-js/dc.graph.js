/**
 * `flatGroup` implements a
 * ["fake crossfilter group"](https://github.com/dc-js/dc.js/wiki/FAQ#fake-groups)
 * for the case of a group which is 1:1 with the rows of the data array.
 *
 * Although `dc_graph` can be used with aggregated or reduced data, typically the nodes and edges
 * are rows of two data arrays, and each row has a column which contains the unique identifier for
 * the node or edge.
 */

import crossfilter from 'crossfilter2';

export const flatGroup = (function() {
    const reduce_01 = {
        add(p, v) {
            return v;
        },
        remove() {
            return null;
        },
        init() {
            return null;
        },
    };
    // now we only really want to see the non-null values, so make a fake group
    function non_null(group) {
        return {
            all() {
                return group.all().filter(kv => kv.value !== null);
            },
        };
    }

    function dim_group(ndx, id_accessor) {
        const dimension = ndx.dimension(id_accessor);
        return {
            crossfilter: ndx,
            dimension,
            group: non_null(
                dimension.group().reduce(reduce_01.add, reduce_01.remove, reduce_01.init),
            ),
        };
    }

    return {
        /**
         * Create a crossfilter, dimension, and flat group. Returns an object containing all three.
         *
         *  1. If `source` is an array, create a crossfilter from it. Otherwise assume it is a
         *  crossfilter instance.
         *  2. Create a dimension on the crossfilter keyed by `id_accessor`
         *  3. Create a group from the dimension, reducing to the row when it's filtered in, or
         * `null` when it's out.
         *  4. Wrap the group in a fake group which filters out the nulls.
         *
         * The resulting fake group's `.all()` method returns an array of the currently filtered-in
         * `{key, value}` pairs where the key is `id_accessor(row)` and the value is the row.
         * @method make
         * @memberof dc_graph.flat_group
         * @param {Array} source - the data array for crossfilter, or a crossfilter
         * @param {Function} id_accessor - accessor function taking a row object and returning its
         * unique identifier
         * @return {Object} `{crossfilter, dimension, group}`
         */
        make(source, id_accessor) {
            let cf;
            if (Array.isArray(source))
                cf = crossfilter(source);
            else cf = source;
            return dim_group(cf, id_accessor);
        },
        /**
         * Create a flat dimension and group from an existing crossfilter.
         *
         * @method another
         * @memberof dc_graph.flat_group
         * @deprecated use .make() instead
         * @param {Object} ndx - crossfilter instance
         * @param {Function} id_accessor - accessor function taking a row object and returning its
         * unique identifier
         * @return {Object} `{crossfilter, dimension, group}`
         */
        another(cf, id_accessor) {
            console.warn('flat_group.another() is deprecated, use .make() instead');
            return this.make(cf, id_accessor);
        },
    };
})();
