!function() {
    var path = document.location.pathname;
    var filename = path.substring(path.lastIndexOf('/')+1);
    var jsFilename = filename.replace('html', 'js');
    document.write([
        '<div id="header" style="padding: 1em;">',
        '<a href="."><span style="font-size: 24px; font-weight: bold;">dc.graph</span></a>',
        '<span style="font-size: 18px; padding-left: 5em;">', document.title, '</span>',
        '<span id="right-header" style="position: absolute; right: 2em; top: 2em; font-size: 12px;">',
        '<a href="https://github.com/dc-js/dc.graph.js/tree/develop/web/js/' + jsFilename,
        '">source</a>',
        '<span id="version" style="padding-left: 2em;"></span>',
        '</span>',
        '</div>'
    ].join(''));
    window.onload = function() {
        d3.select('#version').text('v' + dc_graph.version);
    };
}();
