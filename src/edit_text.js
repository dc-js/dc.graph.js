// adapted from
// http://stackoverflow.com/questions/9308938/inline-text-editing-in-svg/#26644652

dc_graph.edit_text = function(parent, options) {
    var foreign = parent.append('foreignObject').attr({
        height: '100%',
        width: '100%' // don't wrap
    });
    function reposition() {
        var pos;
        switch(options.align) {
        case 'left':
            pos = [options.box.x, options.box.y];
            break;
        default:
        case 'center':
            pos = [
                options.box.x + (options.box.width - textdiv.node().offsetWidth)/2,
                options.box.y + (options.box.height - textdiv.node().offsetHeight)/2
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

    function stopProp() {
        d3.event.stopPropagation();
    }
    foreign
        .on('mousedown', stopProp)
        .on('mousemove', stopProp)
        .on('mouseup', stopProp)
        .on('dblclick', stopProp);

    function accept() {
        options.accept && options.accept(textdiv.text());
        textdiv.on('blur.edittext', null);
        foreign.remove();
        options.finally && options.finally();
    }
    function cancel() {
        options.cancel && options.cancel();
        textdiv.on('blur.edittext', null);
        foreign.remove();
        options.finally && options.finally();
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
        range.setStart(textdiv.node(), 1);
        range.setEnd(textdiv.node(), 1);
    }
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
};
