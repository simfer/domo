module.exports = function GPIO(pin,direction,edge) {
    this.pin        = pin;
    this.direction  = direction;
    this.edge       = edge;
    this.value      = 0;
    this.counter    = 0;

    this.watch = function(cb) {
        var v = this.value;
        var p = this.pin;
        var t = ((p % 2) + 1) * 2000; // it simply generates different intervals
        var that = this;


        this.interval = setInterval(function(){
            console.log("Button " + p + " pressed value " + v + " after time " + t);
            cb(null,v);
            v = Math.abs(v-1);
        }, t);
    }

    this.readSync = function() {
        return this.value;
    }

    this.writeSync = function(v) {
        this.value = v;
    }

    this.unwatchAll = function() {
        if (this.interval) {
            console.log("clearing interval");
            clearInterval(this.interval);
        }
        console.log("unwatchAll");
    }

    this.unexport = function() {
        console.log("unexport");
    }
}
