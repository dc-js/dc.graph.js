var make_runner = function(init, step, interval) {
    var timer;
    var stepped = false, timedOut = false, stopRequested = false;
    interval = d3.functor(interval);

    function startTimer() {
        stepped = timedOut = false;
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
        endStep: function() {
            stepped = true;
            kontinue();
            return this;
        }
    };
};
