dc_graph.path_reader = function(pathsgroup) {
    var highlight_paths_group = dc_graph.register_highlight_paths_group(pathsgroup || 'highlight-paths-group');
    var _intervals, _intervalTree, _time;

    function register_path_objs(path, nop, eop) {
        reader.elementList.eval(path).forEach(function(element) {
            var key, paths;
            switch(reader.elementType.eval(element)) {
            case 'node':
                key = reader.nodeKey.eval(element);
                paths = nop[key] = nop[key] || [];
                break;
            case 'edge':
                key = reader.edgeSource.eval(element) + '-' + reader.edgeTarget.eval(element);
                paths = eop[key] = eop[key] || [];
                break;
            }
            paths.push(path);
        });
    }

    var reader = {
        pathList: property(identity, false),
        timeRange: property(null, false),
        pathStrength: property(null, false),
        elementList: property(identity, false),
        elementType: property(null, false),
        nodeKey: property(null, false),
        edgeSource: property(null, false),
        edgeTarget: property(null, false),
        clear: function() {
            highlight_paths_group.paths_changed({}, {}, []);
        },
        data: function(data) {
            var nop = {}, eop = {}, allpaths = [], has_ranges;
            reader.pathList.eval(data).forEach(function(path) {
                if((path._range = reader.timeRange.eval(path))) { // ugh modifying user data
                    if(has_ranges===false)
                        throw new Error("can't have a mix of ranged and non-ranged paths");
                    has_ranges = true;
                } else {
                    if(has_ranges===true)
                        throw new Error("can't have a mix of ranged and non-ranged paths");
                    has_ranges = false;
                    register_path_objs(path, nop, eop);
                }
                allpaths.push(path);
            });
            if(has_ranges) {
                _intervals = allpaths.map(function(path) {
                    var interval = [path._range[0].getTime(), path._range[1].getTime()];
                    interval.path = path;
                    return interval;
                });
                // currently must include lysenko-interval-tree separately
                _intervalTree = lysenkoIntervalTree(_intervals);
                if(_time)
                    this.setTime(_time);
            } else {
                _intervals = null;
                _intervalTree = null;
                highlight_paths_group.paths_changed(nop, eop, allpaths);
            }
        },
        getIntervals: function() {
            return _intervals;
        },
        setTime: function(t) {
            if(t && _intervalTree) {
                var paths = [], nop = {}, eop = {};
                _intervalTree.queryPoint(t.getTime(), function(interval) {
                    paths.push(interval.path);
                    register_path_objs(interval.path, nop, eop);
                });
                highlight_paths_group.paths_changed(nop, eop, paths);
            }
            _time = t;
        }
    };

    return reader;
};

