// adapted from
// http://stackoverflow.com/questions/9308938/inline-text-editing-in-svg/#26644652

function edittext(svg, position, options) {
    var foreign = svg.append('foreignObject').attr({
        width: '100%',
        height: '100%',
        transform: 'translate(' + position.x + ' ' + position.y + ')'
    });
    var textdiv = foreign.append('xhtml:div');
    var text = options.text || "type on me";
    textdiv.text(text).attr({
        contenteditable: true,
        width: 'auto'
    }).style({
        display: 'inline-block',
        'background-color': 'white',
        padding: '2px'
    });

    function accept() {
        options.accept && options.accept(textdiv.text());
        textdiv.on('blur.edittext', null);
        foreign.remove();
    }
    function cancel() {
        options.cancel && options.cancel();
        textdiv.on('blur.edittext', null);
        foreign.remove();
    }

    textdiv.on('keydown.edittext', function() {
        if(d3.event.keyCode===13) {
            d3.event.preventDefault();
        }
    }).on('keyup.edittext', function() {
        if(d3.event.keyCode===13) {
            accept();
        } else if(d3.event.keyCode===27) {
            cancel();
        }
    }).on('blur.edittext', cancel);
    textdiv.node().focus();

    var range = document.createRange();
    if(options.selectText) {
        range.selectNodeContents(textdiv.node());
    } else {
        range.setStart(textdiv.node(), text.length);
        range.setEnd(textdiv.node(), text.length);
    }
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

dc_graph.edit_text = function(svg, selection, options) {
    var position = options.position || {x: 0, y: 0};
    edittext(svg, position, options);
};

