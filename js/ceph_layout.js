app_layouts.ceph = function() {
    var view_ = 'ceph';
    var edgetypes_;

    var filters = {
        ceph: function(c) {
            return c === 'VM-VOL' || c === 'HOST-VM';
        },
        volume: function(c) {
            return c === 'TOR-CHOST' || c === 'CHOST-Backend' || c === 'Backend-Vol';
        }
    };
    function apply_view() {
        edgetypes_.filterFunction(filters[view_]);
    }

    return {
        init: function() {
            $('#app-options').append(['<div id="select-domain">',
                                      '<input type=radio name="ceph-domain" value="ceph" checked="true">ceph',
                                      '<input type=radio name="ceph-domain" value="infrastructure">infrastructure',
                                      '<input type=radio name="ceph-domain" value="tenant">tenant',
                                      '<input type=radio name="ceph-domain" value="volume">volume',
                                      '</div>'].join(''));
            $('#app-options input').click(function() {
                view_ = this.value;
                apply_view();
                dc.redrawAll();
            });
        },
        data: function(nodes, edges) {
            edgetypes_ = edges.crossfilter.dimension(function(e) {
                return e.class;
            });
            apply_view();
        },
        lengthStrategy: 'symmetric',
        initDiagram: function(diagram) {
            diagram.induceNodes(true)
                .showLayoutSteps(false)
                .transitionDuration(500);
        }
    };
}();
