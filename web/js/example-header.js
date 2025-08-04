// ES6 version of example-header.js
import { version } from './dc-graph.js';

// Create header when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createHeader);
} else {
    createHeader();
}

function createHeader() {
    var path = document.location.pathname;
    var filename = path.substring(path.lastIndexOf('/')+1);
    var jsFilename = filename.replace('html', 'js');

    // Find the script tag that loaded this module
    var scriptTag = document.querySelector('script[src*="example-header.js"]');
    var parentElement = scriptTag ? scriptTag.parentElement : document.body;

    // Create header element
    var headerDiv = document.createElement('div');
    headerDiv.id = 'header';
    headerDiv.style.padding = '1em';

    headerDiv.innerHTML = [
        '<a href="."><span style="font-size: 24px; font-weight: bold;">dc.graph</span></a>',
        '<span style="font-size: 18px; padding-left: 5em;">'+document.title+'</span>',
        '<span id="right-header" style="position: absolute; right: 2em; top: 2em; font-size: 12px;">',
        '<a href="https://github.com/dc-js/dc.graph.js/tree/develop/web/js/'+jsFilename+'">source</a>',
        '<span id="version" style="padding-left: 2em;">v'+version+'</span>',
        '</span>',
    ].join('');

    // Insert header at the beginning of parent element
    if (scriptTag) {
        parentElement.insertBefore(headerDiv, scriptTag);
    } else {
        parentElement.insertBefore(headerDiv, parentElement.firstChild);
    }
}
