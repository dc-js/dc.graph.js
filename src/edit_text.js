// adapted from
// http://stackoverflow.com/questions/9308938/inline-text-editing-in-svg/#26644652

dc_graph.edit_text = function(parent, options) {
    var foreign = parent.append('foreignObject').attr({
        height: '100%',
        width: '100%' // don't wrap
    });
    var padding = options.padding !== undefined ? options.padding : 2;
    function reposition() {
        var pos;
        switch(options.align) {
        case 'left':
            pos = [options.box.x-padding, options.box.y-padding];
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
        width: 'auto',
        class: options.class || null
    }).style({
        display: 'inline-block',
        'background-color': 'white',
        padding: padding + 'px'
    });

    function stopProp() {
        d3.event.stopPropagation();
    }
    foreign
        .on('mousedown.edit-text', stopProp)
        .on('mousemove.edit-text', stopProp)
        .on('mouseup.edit-text', stopProp)
        .on('dblclick.edit-text', stopProp);

    function accept() {
        options.accept && options.accept(textdiv.text());
        textdiv.on('blur.edit-text', null);
        foreign.remove();
        options.finally && options.finally();
    }
    function cancel() {
        options.cancel && options.cancel();
        textdiv.on('blur.edit-text', null);
        foreign.remove();
        options.finally && options.finally();
    }

    textdiv.on('keydown.edit-text', function() {
        if(d3.event.keyCode===13) {
            d3.event.preventDefault();
        }
    }).on('keyup.edit-text', function() {
        if(d3.event.keyCode===13) {
            accept();
        } else if(d3.event.keyCode===27) {
            cancel();
        }
        reposition();
    }).on('blur.edit-text', cancel);
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
