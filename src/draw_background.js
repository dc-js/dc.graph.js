dc_graph.draw_background = function() {
    function draw(diagram, node, edge, ehover) {
        var background = diagram.layoutEngine().background && diagram.layoutEngine().background();
        if(background) {
            var bkg = diagram.g().selectAll('g.background').data([0]);
            bkg.enter().insert('g', ':first-child');
            var polygons = [], fillColor, penColor;
            background.forEach(function(cmd) {
                switch(cmd.type) {
                case 'c':
                    penColor = cmd.c;
                    break;
                case 'C':
                    fillColor = cmd.c;
                    break;
                case 'P':
                    polygons.push({
                        points: cmd.ps,
                        penColor: penColor,
                        fillColor: fillColor
                    });
                }
            });
            var shapes = bkg.selectAll('path.background').data(polygons);
            shapes.exit().remove();
            shapes.enter().append('path')
                .attr('class', 'background')
                .attr('d', function(poly) {
                    return generate_path(poly.points, 1, false);
                })
                .attr('stroke', function(poly) {
                    return poly.penColor;
                })
                .attr('fill', function(poly) {
                    return poly.fillColor;
                });
        }
    }
    function remove(diagram, node, edge, ehover) {
    }
    var _mode = dc_graph.mode('draw-background', {
        laterDraw: true,
        draw: draw,
        remove: remove
    });
    return _mode;
};

