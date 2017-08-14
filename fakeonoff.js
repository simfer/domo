module.exports = function GPIO(pin,direction,edge) {
    this.pin        = pin;
    this.direction  = direction;
    this.edge        = edge;

    this.watch = function(cb) {
        setInterval(function(){
            console.log("Button pressed");
            cb(null,Math.round(Math.random()));
        }, 60000);
    }
}
