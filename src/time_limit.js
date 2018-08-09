// imposes a time limit on any asynchronous layout engine which sends ticks (currently just cola_layout)
dc_graph.time_limit = function() {
  var _startTime;
  var _limit = {
    engine: property(null).react(function(engine) {
      engine.on('start', function() {
        _startTime = Date.now();
      }).on('tick', function() {
        if(_limit.limit()) {
          var elapsed = Date.now() - _startTime;
          if(elapsed > _limit.limit()) {
            console.log('stopping algo ' + engine.layoutAlgorithm() + ' after ' + _limit.limit() + 'ms');
            engine.stop();
          }
        }
      });
    }),
    limit: property(0)
  };
  return _limit;
};
