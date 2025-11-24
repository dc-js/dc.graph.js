import { app_layouts } from './app_layout.js';

app_layouts.ceph = function() {
    let view_ = 'ceph';
    let edgetypes_;

    const filters = {
        ceph(c) {
            return c === 'VM-VOL' || c === 'HOST-VM';
        },
        volume(c) {
            return c === 'TOR-CHOST' || c === 'CHOST-Backend' || c === 'Backend-Vol';
        },
    };
    function apply_view() {
        edgetypes_.filterFunction(filters[view_]);
    }

    return {
        init() {
            $('#app-options').append(
                [
                    '<div id="select-domain">',
                    '<input type=radio name="ceph-domain" value="ceph" checked="true">ceph',
                    '<input type=radio name="ceph-domain" value="infrastructure">infrastructure',
                    '<input type=radio name="ceph-domain" value="tenant">tenant',
                    '<input type=radio name="ceph-domain" value="volume">volume',
                    '</div>',
                ].join(''),
            );
            $('#app-options input').click(function() {
                view_ = this.value;
                apply_view();
                dc.redrawAll();
            });
        },
        data(nodes, edges) {
            edgetypes_ = edges.crossfilter.dimension(e => e.class);
            apply_view();
        },
        lengthStrategy: 'symmetric',
        initDiagram(diagram) {
            diagram.induceNodes(true)
                .showLayoutSteps(false)
                .transitionDuration(500);
        },
    };
}();
