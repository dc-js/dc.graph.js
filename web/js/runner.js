var make_runner = function(init, step, interval) {
    var timer;
    var stepped = false, timedOut = false, stopRequested = false;
    var times = [], last_start;
    interval = d3.functor(interval);

    function startTimer() {
        stepped = timedOut = false;
        last_start = window.performance.now();
        timer = window.setTimeout(function() {
            timedOut = true;
            kontinue();
        }, interval());
    }

    function kontinue() {
        if(!stepped || !timedOut)
            return;
        timer = null;
        if(!stopRequested) {
            step();
            startTimer();
        }
        stopRequested = false;
    }

    return {
        start: function() {
            init();
            startTimer();
            return this;
        },
        stop: function() {
            stopRequested = true;
            return this;
        },
        toggle: function() {
            if(timer)
                this.stop();
            else
                this.start();
            return this;
        },
        isRunning: function() {
            return !!timer;
        },
        lastTime: function() {
            return times[times.length-1];
        },
        avgTime: function() {
            return d3.sum(times)/times.length;
        },
        endStep: function() {
            stepped = true;
            times.push(window.performance.now() - last_start);
            kontinue();
            return this;
        }
    };
};
