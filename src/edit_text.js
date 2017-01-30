// adapted from
// http://stackoverflow.com/questions/9308938/inline-text-editing-in-svg/#26644652

function getlocalmousecoord(svg, evt) {
    var pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    var localpoint = pt.matrixTransform(svg.getScreenCTM().inverse());
    localpoint.x = Math.round(localpoint.x);
    localpoint.y = Math.round(localpoint.y);
    return localpoint;
}

function edittext(localpoint, svg, dest, text, callbacks) {
    var myforeign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    var textdiv = document.createElement("div");
    text = text || "type on me";
    var textnode = document.createTextNode(text);
    textdiv.appendChild(textnode);
    textdiv.setAttribute("contentEditable", "true");
    textdiv.setAttribute("width", "auto");
    myforeign.setAttribute("width", "100%");
    myforeign.setAttribute("height", "100%");
    myforeign.setAttribute("style", "text-align: left"); //to make div fit text
    textdiv.setAttribute("style", "display: inline-block"); //to make div fit text
    myforeign.setAttributeNS(null, "transform", "translate(" + localpoint.x + " " + localpoint.y + ")");
    svg.appendChild(myforeign);
    myforeign.appendChild(textdiv);

    var range = document.createRange();
    range.selectNodeContents(textdiv);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    function accept() {
        callbacks.accept && callbacks.accept(textdiv.innerText);
        textdiv.onblur = null;
        myforeign.remove();
    }
    function cancel() {
        callbacks.cancel && callbacks.cancel();
        textdiv.onblur = null;
        myforeign.remove();
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
}

dc_graph.edit_text = function(svg, selection, text, callbacks) {
    var localpoint, dest;
    dest = selection.node();
    localpoint = {x: dest.getAttribute("x"), y: dest.getAttribute("y")};
    // text = dest.childNodes[0].nodeValue;
    edittext(localpoint, svg.node(), dest, text, callbacks);
};

