// adapted from
// http://stackoverflow.com/questions/9308938/inline-text-editing-in-svg/#26644652

function edittext(svg, position, options) {
    var foreign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    var textdiv = document.createElement("div");
    var text = options.text || "type on me";
    var textnode = document.createTextNode(text);
    textdiv.appendChild(textnode);
    textdiv.setAttribute("contentEditable", "true");
    textdiv.setAttribute("width", "auto");
    textdiv.setAttribute("style", "display: inline-block; background-color: white; padding: 2px"); //to make div fit text
    foreign.setAttribute("width", "100%");
    foreign.setAttribute("height", "100%");
    foreign.setAttributeNS(null, "transform", "translate(" + position.x + " " + position.y + ")");
    svg.appendChild(foreign);
    foreign.appendChild(textdiv);

    function accept() {
        options.accept && options.accept(textdiv.innerText);
        textdiv.onblur = null;
        foreign.remove();
    }
    function cancel() {
        options.cancel && options.cancel();
        textdiv.onblur = null;
        foreign.remove();
    }

    textdiv.onkeydown = function(event) {
        if(event.keyCode===13) {
            event.preventDefault();
        }
    };
    textdiv.onkeyup = function(event) {
        if(event.keyCode===13) {
            accept();
        } else if(event.keyCode===27) {
            cancel();
        }
    };
    textdiv.onblur = cancel;
    textdiv.focus();

    var range = document.createRange();
    if(options.selectText) {
        range.selectNodeContents(textdiv);
    } else {
        range.setStart(textdiv, text.length);
        range.setEnd(textdiv, text.length);
    }
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

dc_graph.edit_text = function(svg, selection, options) {
    var position = options.position || {x: 0, y: 0};
    edittext(svg.node(), position, options);
};

