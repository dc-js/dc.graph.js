import { select } from 'd3-selection';

export function display_error(heading, message) {
    select('#message')
        .style('display', null)
        .html(
            '<div><h1>'+heading+'</h1>'
                +(message ? '<code>'+message+'</code></div>' : ''),
        );
    throw new Error(message);
}

export function hide_error() {
    select('#message')
        .style('display', 'none');
}
