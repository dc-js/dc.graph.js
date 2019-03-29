function parsedraw (drawstr) {
    var t, n, i, j;
    var dir, dirs = [];

    t = drawstr.split (' ');
    n = t.length;
    if (t[n - 1] == '')
        n--;

    i = 0;
    while (i < n) {
        switch (t[i]) {
        case '':
            i++;
            break;
        case 'e':
        case 'E':
            dir = {
                type: t[i],
                c: { x: +t[i + 1], y: +t[i + 2] },
                s: { x: +t[i + 3], y: +t[i + 4] }
            };
            i += 5;
            dirs.push (dir);
            break;
        case 'p':
        case 'P':
            dir = {
                type: t[i], n: +t[i + 1], ps: []
            };
            i += 2;
            if (t[i] == '')
                i++; // I don't know why there's sometimes an extra space
            for (j = 0; j < dir.n; j++) {
                dir.ps[j] = { x: +t[i + j * 2], y: +t[i + j * 2 + 1] };
            }
            i += dir.n * 2;
            // these are closed polygons, so go from dir.ps[n-1] to dir.ps[0]
            dirs.push (dir);
            break;
        case 'L':
        case 'B':
        case 'b':
            dir = {
                type: t[i], n: +t[i + 1], ps: []
            };
            i += 2;
            if (t[i] == '')
                i++; // I don't know why there's sometimes an extra space
            for (j = 0; j < dir.n; j++) {
                dir.ps[j] = { x: +t[i + j * 2], y: +t[i + j * 2 + 1] };
            }
            i += dir.n * 2;
            dirs.push (dir);
            break;
        case 'T':
            dir = {
                type: t[i],
                p: { x: +t[i + 1], y: +t[i + 2] },
                j: t[i + 3], w: +t[i + 4], n: +t[i + 5], s: t[i + 6].slice (1)
            };
            i += 7;
            while (dir.n > dir.s.length) {
                dir.s += ' ' + t[i];
                i++;
            }
            dirs.push (dir);
            break;
        case 'c':
        case 'C':
            dir = {
                type: t[i],
                n: +t[i + 1], c: t[i + 2].slice (1)
            };
            i += 3;
            while (dir.n > dir.c.length) {
                dir.c += ' ' + t[i];
                i++;
            }
            dirs.push (dir);
            break;
        case 'F':
            dir = {
                type: t[i],
                fs: +t[i + 1],
                n: +t[i + 2], fn: t[i + 3].slice (1)
            };
            i += 4;
            while (dir.n > dir.fn.length) {
                dir.fn += ' ' + t[i];
                i++;
            }
            dirs.push (dir);
            break;
        case 'S':
            dir = {
                type: t[i],
                n: +t[i + 1], s: t[i + 2].slice (1)
            };
            i += 3;
            while (dir.n > dir.s.length) {
                dir.s += ' ' + t[i];
                i++;
            }
            dirs.push (dir);
            break;
        default:
            console.log ('unknown tag ' + t[i]);
            i++; // shouldn't happen
        }
    }
    return dirs;
}
