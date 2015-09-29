var make_runner = function(init, step, interval) {
    var timer;
    var stepped = false, timedOut = false, run_mode = false;
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
        if(run_mode) {
            step();
            startTimer();
        }
    }

    return {
        init: function() { // run once but don't continue
            last_start = window.performance.now();
            init();
            return this;
        },
        start: function() { // start loop
            run_mode = true;
            startTimer();
            init();
            return this;
        },
        stop: function() { // stop loop
            run_mode = false;
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
            return times.length ? times[times.length-1] : 0;
        },
        avgTime: function() {
            return times.length ? d3.sum(times)/times.length : 0;
        },
        endStep: function() {
            stepped = true;
            times.push(window.performance.now() - last_start);
            kontinue();
            return this;
        }
    };
};
