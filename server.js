const platform = "PC"; // {PC,RASP}

var express = require('express');
var session = require('express-session');
var socket_io = require('socket.io');
var hash = require('./pass').hash;

var routes = require('./routes/index');
var bodyParser = require("body-parser");


if (platform == 'PC') {
	var GPIO = require("./fakeonoff.js");
} else {
	var GPIO = require('onoff').Gpio;	
}

//var cookieParser = require('cookie-parser');

var app = express();

app.locals.pins = [];
app.locals.pins[25] = {'direction':'out','edge':'none','value':0};
app.locals.pins[23] = {'direction':'out','edge':'none','value':0};
app.locals.pins[17] = {'direction':'in','edge':'both','value':0};
app.locals.pins[18] = {'direction':'in','edge':'both','value':0};


app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use('/static', express.static('public'));
app.use('/node_modules/bootstrap', express.static(__dirname + '/node_modules/bootstrap'));
app.use('/node_modules/jquery', express.static(__dirname + '/node_modules/jquery'));
app.use('/assets/images', express.static(__dirname + '/assets/images'));
app.use('/assets/styles', express.static(__dirname + '/assets/styles'));
app.use('/assets/fonts', express.static(__dirname + '/assets/fonts'));

//app.use(cookieParser());


// MIDDLEWARE
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret:'secret',
    resave: false,
    saveUninitialized: false
}));


app.use(function(req, res, next){ 
	var err = req.session.error;
	var msg = req.session.success;
	delete req.session.error; 
	delete req.session.success; 
    res.locals.message = '';
    
	if (err) res.locals.message ='<div class="alert alert-danger" role="alert"><span class="glyphicon glyphicon-exclamation-sign" aria-hidden="true"></span><span class="sr-only">Errore:</span>' + err + '</div>';
	if (msg) res.locals.message ='<div class="alert alert-success" role="alert"><span class="glyphicon glyphicon-ok" aria-hidden="true"></span><span class="sr-only">Successo:</span>' + msg + '</div>';
	next(); 
}); 

//app.use(function(req, res, next) {
//	var err = new Error('Not Found');
//	err.status = 404;
//	next(err);
//});

//app.use(function(err, req, res, next) {
//		res.status(err.status || 500);
//		res.render('error', {
//		message: err.message,
//		error: err
//	});
//});

app.use('/', routes);

app.get('/readall', function(req, res){ 
	var out = JSON.stringify(app.locals.pins);
	res.send(out);
});

app.get('/checkpin/:pinNumber', function(req, res){ 
	var pinNumber = req.params.pinNumber;
	var storedPin = app.locals.pins[pinNumber];
	var pinDirection = app.locals.pins[pinNumber].direction;

	//var pin = new GPIO(pinNumber, pinDirection);
	var pin = new GPIO(pinNumber);

	//physically read the status of the pin
    	var pinValue = pin.readSync();
	
	//if for some reason the status has changed I update it in the global array
	app.locals.pins[pinNumber].value = pinValue;

	storedPin = app.locals.pins[pinNumber];
	res.send(JSON.stringify(storedPin));
}); 

app.post('/setpin', function(req, res){
	var pinNumber = req.body.number;
	var pinDirection = req.body.direction;
	var pinValue = req.body.value;
	app.locals.pins[pinNumber].direction = pinDirection;
	app.locals.pins[pinNumber].value = pinValue;
	var pin = new GPIO(pinNumber, pinDirection);
    	pin.writeSync(pinValue);
	var out = app.locals.pins[pinNumber];
	res.send(JSON.stringify(out));
}); 

app.post('/login', function(req, res){
	var username = req.body.username;
	var password = req.body.password;

	authenticate(username, password, function(err, user){ 
		if (user) { 
			req.session.regenerate(function(){
				// Store the user's primary key 
				// in the session store to be retrieved,
				// or in this case the entire user object 
				req.session.user = user;
				res.redirect('home'); 
			}); 
		} else {
			req.session.error = 'Utente e/o password non validi!'; 
			res.redirect('/');
		} 
	}); 
}); 

app.get('/logout', function(req, res){
	// destroy the user's session to log them out 
	// will be re-created next request
	req.session.destroy(function(){ 
		res.redirect('/');
	}); 
}); 

var server = app.listen(3000);
console.log('Express started on port ' + 3000); 

var io = require('socket.io').listen(server);

// Web Socket Connection
io.on('connection', function (socket) {

	var buttons = [];

	for (i = 0; i <= 27; i++) {
		if (app.locals.pins[i]) {
			var x = app.locals.pins[i];
			if (x.direction == "in") {
				(function(i){
					var dest = 'ping'+i;
					buttons[i] = new GPIO(i, x.direction, x.edge);
					buttons[i].watch(function (err, value) {
				 		if (err) throw err;
						 socket.emit(dest,{ 'value': value });
					});
				 })(i);
			}
		}
	}
});

// FUNCTIONS

// dummy database 
var users = { admin: { name: 'admin' }};
hash('Admin123', function(err, salt, hash){ 
	if (err) throw err; 
	// store the salt & hash in the "db"
	users.admin.salt = salt; 
	users.admin.hash = hash.toString();
}); 

// Authenticate using our plain-object database of doom!
function authenticate(name, pass, fn) { 
	var user = users[name]; 
	// query the db for the given username
	if (!user) return fn(new Error('Utente non trovato!'));
    hash(pass, user.salt, function(err, hash){
		if (err) return fn(err);
		if (hash.toString() == user.hash) return fn(null, user);
		fn(new Error('Password non valida'));
	});
} 
