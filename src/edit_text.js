// adapted from
// http://stackoverflow.com/questions/9308938/inline-text-editing-in-svg/#26644652

dc_graph.edit_text = function(parent, options) {
    var foreign = parent.append('foreignObject').attr({
        width: '100%' // don't wrap
    });
    function reposition() {
        var pos;
        switch(options.align) {
        case 'left':
        default:
        case 'center':
            pos = [
                options.position.x - textdiv.node().offsetWidth/2,
                options.position.y - textdiv.node().offsetHeight/2
            ];
            break;
        }
        foreign.attr('transform', 'translate(' + pos.join(' ') + ')');
    }
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
        reposition();
    }).on('blur.edittext', cancel);
    reposition();
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
};
