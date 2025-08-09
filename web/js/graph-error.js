import { select } from 'd3-selection';

export function display_error(heading, messageOrError) {
    let message, originalError;

    // Handle both string messages and Error objects
    if (messageOrError instanceof Error) {
        originalError = messageOrError;
        message = messageOrError.message;
    } else {
        message = messageOrError;
    }

    select('#message')
        .style('display', null)
        .html(
            `<div><h1>${heading}</h1>${message ? `<code>${message}</code></div>` : ''}`,
        );

    // Re-throw the original error to preserve stack trace, or create new one
    if (originalError) {
        throw originalError;
    } else {
        throw new Error(message);
    }
}

export function hide_error() {
    select('#message')
        .style('display', 'none');
}
