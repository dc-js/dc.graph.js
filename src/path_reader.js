dc_graph.path_reader = function(pathsgroup) {
    var highlight_paths_group = dc_graph.register_highlight_paths_group(pathsgroup || 'highlight-paths-group');
    var reader = {
        pathList: property(identity, false),
        elementList: property(identity, false),
        elementType: property(null, false),
        nodeKey: property(null, false),
        edgeSource: property(null, false),
        edgeTarget: property(null, false),
        data: function(data) {
            var nop = {}, eop = {};
            reader.pathList.eval(data).forEach(function(path) {
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
            });
            highlight_paths_group.paths_changed(nop, eop);
        }
    };

    return reader;
};

