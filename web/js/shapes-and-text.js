var qs = querystring.parse();

var shapes = dc_graph.available_shapes();

function rand(n) {
    return Math.floor(Math.random()*n);
}
var nodes = [];
var lorem = lorem_ipsum().map(function(s) { return s.split(' '); });
var nshapes = qs.n || rand(36)+1;
for(var i=0; i<nshapes; ++i) {
    var source = lorem[rand(lorem.length)];
    var nlines = qs.lines || rand(10) + 1, j = 0, lines = [];
    while(nlines--) {
        var nword = rand(8)+1;
        lines.push(source.slice(j, j+nword).join(' '));
        j += nword;
        if(j>=source.length)
            break;
    }
    nodes.push({
        id: 'node' + nodes.length,
        label: lines,
        shape: {shape: qs.shape || shapes[rand(shapes.length)]}
    });
}

var node_flat = dc_graph.flat_group.make(nodes, function(d) { return d.id; }),
    edge_flat = dc_graph.flat_group.make([], function(d) { return d.source + '-' + d.target; });

var diagram = dc_graph.diagram('#graph');

diagram
    .width(window.innerWidth)
    .height(window.innerHeight)
    .layoutAlgorithm('cola')
    .transitionDuration(500)
    .stageTransitions('insmod')
    .showLayoutSteps(false)
    .nodeDimension(node_flat.dimension).nodeGroup(node_flat.group)
    .edgeDimension(edge_flat.dimension).edgeGroup(edge_flat.group)
    .edgeSource(function(e) { return e.value.source; })
    .edgeTarget(function(e) { return e.value.target; })
    .nodeLabel(function(n) { return n.value.label; })
    .nodeLineHeight(qs.lh || 1)
    .nodeShape(function(n) { return n.value.shape; })
    .edgeArrowhead('vee');

diagram.timeLimit(1000);

dc.renderAll();


function lorem_ipsum() {
    return [
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean nibh velit, interdum vel est ut, ultrices maximus augue. Vestibulum feugiat, massa a auctor placerat, metus metus dignissim sem, sit amet pharetra orci mauris vel nulla. Ut tincidunt nisi at ipsum imperdiet, in interdum nisl porttitor. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Nulla ac sodales diam, varius luctus dui. Etiam feugiat orci at magna maximus, finibus accumsan lectus aliquam. Nam pellentesque lacus a scelerisque tempor. Sed elit ligula, gravida a eleifend vel, porta in mauris. Vestibulum interdum mi id erat volutpat convallis. Duis condimentum iaculis placerat. Nam gravida dictum magna, non maximus velit suscipit id. Aliquam gravida quam in sem posuere, eget volutpat dui aliquam. Suspendisse quam nunc, tempor quis faucibus sit amet, rutrum vitae ex. Cras rhoncus ac erat quis fermentum. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed aliquet ante a magna tincidunt vulputate.",
        "Praesent sed mi elementum justo tincidunt laoreet. Nullam at viverra nisi, eu iaculis mauris. Aliquam feugiat orci ullamcorper, facilisis augue a, cursus massa. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean at lectus blandit, hendrerit lectus non, dapibus est. Suspendisse tempus magna eget massa egestas, sit amet tempus eros iaculis. Vestibulum risus lacus, vulputate eget velit nec, aliquet imperdiet eros. Fusce sollicitudin velit orci, ornare volutpat quam rutrum at. Nulla ac tellus viverra, rhoncus magna quis, efficitur lorem. Mauris non tincidunt turpis. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Suspendisse aliquet lacus quis arcu sodales pretium.",
        "Curabitur varius commodo nibh, ac vehicula justo lacinia ut. Vestibulum vitae orci vehicula, suscipit diam in, mollis mauris. Praesent dignissim leo at nisi bibendum mattis. Praesent tellus risus, iaculis vitae luctus a, condimentum eu elit. Ut id fermentum diam. Nam justo dui, interdum ut blandit ut, condimentum in diam. Morbi et malesuada magna. Ut dignissim pellentesque nisi, ut commodo augue convallis eu. Vivamus lectus lectus, venenatis eget mauris id, vestibulum pellentesque leo. Sed gravida tortor eu lectus vestibulum, elementum pretium ipsum pulvinar. Curabitur aliquet dictum euismod. Duis consectetur libero urna, id pellentesque lacus ultrices et. Maecenas pellentesque feugiat volutpat.",
        "Aliquam erat volutpat. Quisque rhoncus faucibus lobortis. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Nam ac lacus eros. Fusce iaculis dui quis efficitur tempus. Duis turpis purus, maximus ac arcu non, fermentum facilisis ligula. In id urna dolor. Cras a varius sem. Duis sed neque consectetur, luctus nibh a, volutpat sem. Etiam mollis vulputate commodo. Aenean pulvinar lacus eget porttitor rhoncus. Quisque tincidunt pharetra est, id imperdiet purus tempor id. Nam et euismod lacus. Sed auctor, dui eu blandit gravida, augue nisi mattis leo, at euismod lorem purus et risus. Aenean dictum nisl ut porta posuere.",
        "Praesent vel lacus bibendum, mattis tellus eget, consequat elit. Curabitur nec massa consectetur, sodales urna eget, egestas nisl. Phasellus interdum, nisi laoreet lacinia consectetur, est enim congue felis, nec laoreet tortor tellus quis tortor. Etiam vel orci felis. Aenean fringilla aliquam lectus, in pulvinar risus placerat a. Praesent fringilla enim diam, ornare rutrum mauris varius in. Cras facilisis augue ut nunc maximus, non eleifend orci laoreet. Quisque urna nulla, ullamcorper vel tellus vitae, condimentum efficitur urna. Maecenas odio odio, ultricies id dictum a, venenatis sed mi. Aenean dictum quis enim nec commodo. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Sed bibendum augue at nunc varius, in semper dui consectetur. Duis id enim odio. Nam varius elit libero, sed aliquet erat pulvinar at. Aliquam commodo turpis ipsum, et elementum erat rutrum ac.",
        "In hac habitasse platea dictumst. Vivamus fringilla est pulvinar pellentesque facilisis. Cras aliquet pretium felis, faucibus porttitor sem tempor placerat. In hac habitasse platea dictumst. Duis eleifend eleifend eros. Duis ac eros dolor. Maecenas efficitur bibendum ante, sit amet sodales arcu vestibulum vitae.",
        "Sed commodo lectus non massa suscipit tristique. Integer mattis turpis vitae bibendum cursus. Nunc at tortor non felis posuere convallis eget vel velit. Aenean vel luctus ipsum, at aliquam tellus. Suspendisse potenti. Pellentesque luctus enim ac lectus efficitur egestas. Nam eget volutpat augue. Ut eros lorem, ultrices non laoreet eu, luctus et erat. Praesent efficitur tortor vitae est fermentum ultricies. Sed id vestibulum diam, sit amet rhoncus lectus.",
        "Donec mollis ullamcorper condimentum. Curabitur ut odio cursus, dictum libero in, vulputate dolor. Morbi sed elit est. Proin lacinia commodo sapien, nec sollicitudin mauris facilisis non. Proin et diam sed tellus commodo facilisis. Nulla at eros consectetur, rutrum augue sit amet, porttitor ex. Suspendisse vitae nisi eget ante efficitur convallis pretium sit amet orci. Fusce vitae dapibus diam. Nulla semper sagittis malesuada. Pellentesque pulvinar quam a massa ultrices ullamcorper. Quisque non sem ligula. Vivamus hendrerit mauris diam, non volutpat nisi maximus sit amet. In luctus eros sit amet tortor volutpat pellentesque.",
        "Suspendisse ac enim metus. Phasellus bibendum lacus nec tincidunt vehicula. Sed nibh enim, molestie et blandit non, elementum nec purus. Nunc a porta velit. Donec iaculis, dolor sit amet viverra mollis, diam erat posuere ex, vel dignissim arcu risus in arcu. Morbi ac neque dictum, venenatis purus sed, sollicitudin nisi. Integer ornare est sed porttitor pretium. Etiam nisi turpis, porta vitae tellus eu, scelerisque finibus ligula. Donec rutrum nibh at commodo fermentum. Sed fermentum velit et nisl accumsan, ac lobortis felis eleifend. Sed quis mauris consectetur, aliquet orci vitae, rutrum mauris. Nullam pretium tristique massa ut porttitor. Pellentesque cursus nunc venenatis consequat mattis.",
        "Curabitur sodales hendrerit fermentum. Cras mi purus, fringilla vel tortor non, rhoncus posuere dui. Ut accumsan ac tellus at ullamcorper. Phasellus laoreet ligula leo, eu pretium nisl vehicula quis. Integer fermentum, justo in ullamcorper blandit, sem tellus blandit orci, eget suscipit nunc nibh quis orci. Sed in nulla molestie, condimentum eros quis, venenatis quam. Quisque risus nisi, porttitor sit amet arcu dapibus, placerat accumsan enim. Cras turpis massa, ultricies at mauris non, suscipit dapibus eros. Sed vel sollicitudin felis."];
}
