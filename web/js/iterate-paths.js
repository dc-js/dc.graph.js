// not that this is really a reusable utility, just trying not to copy and paste
// too much between index.js and nepal.js

function iterate_paths(diagram, paths) {
    if(paths) {
        // make sure it draws first (?)
        setTimeout(function() {
            d3.json(paths, function(error, data) {
                if(error)
                    throw new Error(error);
                var i = 0;
                var highlight_paths = diagram.child('highlight-paths');
                highlight_paths.data(data);
                diagram.relayout().redraw();
            });
        }, 1000);
    }
}
