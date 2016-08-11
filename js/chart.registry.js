/*
 This is an abstraction of dc.chartRegistry using d3.dispatch.

 https://github.com/dc-js/dc.js/blob/develop/web/docs/api-latest.md#dc.chartRegistry

 Will eventually be cleaned up and modularized, and dc.js will use it (while preserving its legacy interface).
*/
(function() {
    var chart_registry = window.chart_registry || {};
    window.chart_registry = chart_registry;

    var types = {};

    chart_registry.create_type = function(type, constructor) {
        if(!types[type])
            types[type] = {constructor: constructor, groups: {}};

        return types[type];
    };

    chart_registry.create_group = function(type, groupname) {
        if(!types[type])
            throw new Error('chart registry type "' + type + '" not known');
        if(!types[type][groupname])
            types[type][groupname] = types[type].constructor();
        return types[type][groupname];
    };
})();
