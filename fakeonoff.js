module.exports = function GPIO(pin,direction,edge) {
    this.pin        = pin;
    this.direction  = direction;
    this.edge        = edge;
    this.value      = 0;

    this.watch = function(cb) {
        var v = this.value;
        setInterval(function(){
            console.log("Button pressed value " + v);
            cb(null,v);
            v = Math.abs(v-1);
        }, 30000);
    }

    this.readSync = function() {
        return this.value;
    }

    this.writeSync = function(v) {
        this.value = v;
    }

}
