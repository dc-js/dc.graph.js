var make_runner = function(init, step, interval) {
    var timer;
    var stepped = false, timedOut = false, stopRequested = false;

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
        init: function() {
        },
        start: function(interval) {
            interval = d3.functor(interval);
            init();
            startTimer();
        },
        stop: function() {
            stopRequested = true;
        },
        toggle: function() {
            if(timer)
                this.stop();
            else
                this.start();
        },
        endStep: function() {
            stepped = true;
            kontinue();
        }
    };
};
