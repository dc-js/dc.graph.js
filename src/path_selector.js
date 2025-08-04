import { registerHighlightPathsGroup } from './highlight_paths_group.js';
import { property } from './core.js';
import { registerChart } from 'dc';

// External dependency loaded as global
import { select } from 'd3-selection';

export function pathSelector(parent, reader, pathsgroup, chartgroup) {
    const highlight_paths_group = registerHighlightPathsGroup(pathsgroup || 'highlight-paths-group');
    const root = select(parent).append('svg');
    let paths_ = [];
    let hovered = null, selected = null;

    // unfortunately these functions are copied from highlightPaths
    function contains_path(paths) {
        return function(path) {
            return paths ? paths.indexOf(path)>=0 : false;
        };
    }

    function doesnt_contain_path(paths) {
        const cp = contains_path(paths);
        return function(path) {
            return !cp(path);
        };
    }

    function toggle_paths(pathsA, pathsB) {
        if(!pathsA)
            return pathsB;
        else if(!pathsB)
            return pathsA;
        if(pathsB.every(contains_path(pathsA)))
            return pathsA.filter(doesnt_contain_path(pathsB));
        else return pathsA.concat(pathsB.filter(doesnt_contain_path(pathsA)));
    }

    // this should use the whole cascading architecture
    // and allow customization rather than hardcoding everything
    // in fact, you can't even reliably overlap attributes without that (so we don't)

    function draw_paths(diagram, paths) {
        if(paths.length === 0) return;
        const xpadding = 30;
        const space = 30;
        const radius = 8;
        // set the height of SVG accordingly
        root.attr('height', 20*(paths.length+1))
          .attr('width', xpadding+(space+2*radius)*(paths.length/2+1)+20);

        root.selectAll('.path-selector').remove();

        const pathlist = root.selectAll('g.path-selector').data(paths);
        pathlist.enter()
          .append('g')
          .attr('class', 'path-selector')
          .attr("transform", (path, i) => `translate(0, ${  i*20  })`)
          .each(function(path_data, i) {
            const nodes = path_data.element_list.filter((d) => d.element_type === 'node');
            // line
            const line = select(this).append('line');
            line.attr('x1', xpadding+space)
              .attr('y1', radius+1)
              .attr('x2', xpadding+space*nodes.length)
              .attr('y2', radius+1)
              .attr('opacity', 0.4)
              .attr('stroke-width', 5)
              .attr('stroke', '#bdbdbd');

            // dots
            const path = select(this).selectAll('circle').data(nodes);
            path.enter()
              .append('circle')
              .attr('cx', (d, i) => xpadding+space*(i+1))
              .attr('cy', radius+1)
              .attr('r', radius)
              .attr('opacity', 0.4)
              .attr('fill', (d) => {
                // TODO path_selector shouldn't know the data structure of orignal node objects
                const regeneratedNode = {key:d.property_map.ecomp_uid, value:d.property_map};
                return diagram.nodeStroke()(regeneratedNode);
              });

            // label
            const text = select(this).append('text');
            text.text(`Path ${i}`)
              .attr('class', 'path_label')
              .attr('x', 0)
              .attr('y', radius*1.7)
              .on('mouseover.path-selector', () => {
                  highlight_paths_group.hover_changed([path_data]);
              })
              .on('mouseout.path-selector', () => {
                  highlight_paths_group.hover_changed(null);
              })
              .on('click.path-selector', () => {
                  highlight_paths_group.select_changed(toggle_paths(selected, [path_data]));
              });
          });
        pathlist.exit().transition(1000).attr('opacity', 0).remove();
    }

    function draw_hovered() {
      const is_hovered = contains_path(hovered);
      root.selectAll('g.path-selector')
        .each(function(d, _i) {
          const textColor = is_hovered(d) ? '#e41a1c' : 'black';
          const lineColor = is_hovered(d) ? 'black' : '#bdbdbd';
          const opacity = is_hovered(d) ? '1' : '0.4';
          select(this).select('.path_label').attr('fill', textColor);
          select(this).selectAll('line')
            .attr('stroke', lineColor)
            .attr('opacity', opacity);
          select(this).selectAll('circle').attr('opacity', opacity);
        });
    }

    function draw_selected() {
        const is_selected = contains_path(selected);
        root.selectAll('g.path-selector')
          .each(function(d, _i) {
            const textWeight = is_selected(d) ? 'bold' : 'normal';
            const lineColor = is_selected(d) ? 'black' : '#bdbdbd';
            const opacity = is_selected(d) ? '1' : '0.4';
            select(this).select('.path_label')
              .attr('font-weight', textWeight);
            select(this).selectAll('line')
              .attr('stroke', lineColor)
              .attr('opacity', opacity);
            select(this).selectAll('circle').attr('opacity', opacity);
          });
    }

    highlight_paths_group
        .on('paths_changed.path-selector', (nop, eop, paths) => {
            hovered = selected = null;
            paths_ = paths;
            selector.redraw();
        })
        .on('hover_changed.path-selector', (hpaths) => {
            hovered = hpaths;
            draw_hovered();
        })
        .on('select_changed.path-selector', (spaths) => {
            selected = spaths;
            draw_selected();
        });
    const selector = {
        default_text: property('Nothing here'),
        zero_text: property('No paths'),
        error_text: property(null),
        queried: property(false),
        redraw() {
            draw_paths(selector, paths_);
            draw_hovered();
            draw_selected();
        },
        render() {
            this.redraw();
            return this;
        }
    };
    registerChart(selector, chartgroup);
    return selector;
};
