module.exports = function GPIO(pin,direction,edge) {
    this.pin        = pin;
    this.direction  = direction;
    this.edge        = edge;
    this.value      = 0;

    this.watch = function(cb) {
        var v = this.value;
        var p = this.pin;
        var t = ((p % 6) + 1) * 10000; // it simply generates different intervals
        setInterval(function(){
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

}
