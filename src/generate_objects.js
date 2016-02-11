// create or re-use objects in a map, delete the ones that were not reused
function regenerate_objects(preserved, list, key, assign) {
    var keep = {};
    function wrap(o) {
        var k = key(o);
        if(!preserved[k]) preserved[k] = {};
        var o1 = preserved[k];
        assign(o1, o);
        keep[k] = true;
        return o1;
    }
    var wlist = list.map(wrap);
    // delete any objects from last round that are no longer used
    for(var k in preserved)
        if(!keep[k])
            delete preserved[k];
    return wlist;
}
