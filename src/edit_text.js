// adapted from
// http://stackoverflow.com/questions/9308938/inline-text-editing-in-svg/#26644652

import { event as d3Event } from 'd3-selection';


export function editText(parent, options) {
    const foreign = parent.append('foreignObject')
        .attr('height', '100%')
        .attr('width', '100%'); // don't wrap
    const padding = options.padding !== undefined ? options.padding : 2;
    function reposition() {
        let pos;
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
        foreign.attr('transform', `translate(${  pos.join(' ')  })`);
    }
    const textdiv = foreign.append('xhtml:div');
    const text = options.text || "type on me";
    textdiv.text(text)
        .attr('contenteditable', true)
        .attr('width', 'auto')
        .attr('class', options.class || null).style({
        display: 'inline-block',
        'background-color': 'white',
        padding: `${padding  }px`
    });

    function stopProp() {
        d3Event.stopPropagation();
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

    textdiv.on('keydown.edit-text', () => {
        // prevent keyboard mode from seeing this (especially delete key!)
        d3Event.stopPropagation();
        if(d3Event.keyCode===13) {
            d3Event.preventDefault();
        }
    }).on('keyup.edit-text', () => {
        d3Event.stopPropagation();
        if(d3Event.keyCode===13) {
            accept();
        } else if(d3Event.keyCode===27) {
            cancel();
        }
        reposition();
    }).on('blur.edit-text', cancel);
    reposition();
    textdiv.node().focus();

    const range = document.createRange();
    if(options.selectText) {
        range.selectNodeContents(textdiv.node());
    } else {
        range.setStart(textdiv.node(), 1);
        range.setEnd(textdiv.node(), 1);
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
};
