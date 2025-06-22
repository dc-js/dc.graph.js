import { deprecationWarning } from './core.js';

var dont_use_key = deprecationWarning('line_breaks now takes a string - d.key behavior is deprecated and will be removed in a later version');

export function lineBreaks(charexp, max_line_length) {
    var regexp = new RegExp(charexp, 'g');
    return function(s) {
        if(typeof s === 'object') { // backward compatibility
            dont_use_key();
            s = s.key;
        }
        var result;
        var line = '', lines = [], part, i = 0;
        do {
            result = regexp.exec(s);
            if(result)
                part = s.slice(i, regexp.lastIndex);
            else
                part = s.slice(i);
            if(line.length + part.length > max_line_length && line.length > 0) {
                lines.push(line);
                line = '';
            }
            line += part;
            i = regexp.lastIndex;
        }
        while(result !== null);
        lines.push(line);
        return lines;
    };
};
