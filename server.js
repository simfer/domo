const platform = "PC"; // {PC = emulated mode, RASP = Raspberry mode}

var express = require('express');
var session = require('express-session');
var socket_io = require('socket.io');
var hash = require('./pass').hash;
var ejs = require('ejs');

var routes = require('./routes/index');
var bodyParser = require("body-parser");

// if I've enabled the emulated mode I use the fake GPIO module else
// I use the real "onoff" library
if (platform == 'PC') {
	var GPIO = require("./fakeonoff.js");
} else {
	var GPIO = require('onoff').Gpio;	
}

var users = { admin: { name: 'admin' }};
var adminPassword = 'Admin123'; // this should be managed differently

var app = express();

// this is the variable hosting initial data. These data could come from a DB
var settings = [
	{'gpio':17,'active':1,'direction':'in','edge':'both','value':0,'description':'Garage door'},
	{'gpio':18,'active':0,'direction':'in','edge':'both','value':0,'description':'Main gate'},
	{'gpio':23,'active':1,'direction':'out','edge':'none','value':0,'description':'Garage light'},
	{'gpio':25,'active':1,'direction':'out','edge':'none','value':1,'description':'Outside lights'}
];

// LANGUAGE
app.locals.language = {};
app.locals.language.inputTableTitle = "INPUT Ports";
app.locals.language.outputTableTitle = "OUTPUT Ports";
app.locals.language.msgInEditTitle = "INPUT Port";
app.locals.language.msgOutEditTitle = "OUTPUT Port";
app.locals.language.msgAdd = "Add";
app.locals.language.msgActive = "Active";
app.locals.language.msgGPIO = "GPIO";
app.locals.language.msgEdge = "EDGE";
app.locals.language.msgDirection = "Direction";
app.locals.language.msgDescription = "Description";
app.locals.language.msgValue = "Value";
app.locals.language.msgStatus = "Status";
app.locals.language.msgActions = "Actions";
app.locals.language.msgOn = "ON";
app.locals.language.msgOff = "OFF";
app.locals.language.msgOk = "OK!";
app.locals.language.msgAlarm = "ALARM!";
app.locals.language.msgFormCancel = "Cancel";
app.locals.language.msgFormSave = "Save";


// data is transformed into an array in order to better work with it
app.locals.gpios = []; // the array of the GPIO details
app.locals.board = []; // the array of the physical GPIO objects on the Raspberry board

// parsing the settings to populate the array of the GPIO details and
// doing a setup for the GPIO pins on the board
settings.forEach(function(element) {
	app.locals.gpios[element.gpio] = {};
	app.locals.gpios[element.gpio].active = element.active;
	app.locals.gpios[element.gpio].direction = element.direction;
	app.locals.gpios[element.gpio].edge = element.edge;
	app.locals.gpios[element.gpio].value = element.value;
	app.locals.gpios[element.gpio].description = element.description;

	if(element.active == 1) {
		app.locals.board[element.gpio] = new GPIO(element.gpio, element.direction, element.edge);
		if(element.direction == 'out') {
			console.log("Created OUTPUT pin [" + element.gpio + "]");
			console.log("	Value for pin [" + element.gpio + "] set to [" + element.value + "]");
			app.locals.board[element.gpio].writeSync(element.value);
		} else {
			console.log("Created INPUT pin [" + element.gpio + "]");
			console.log("	Direction for pin [" + element.gpio + "] set to [" + element.direction + "]");
			console.log("	Edge for pin [" + element.gpio + "] set to [" + element.edge + "]");
		}
	}
}, this);

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// MIDDLEWARE
app.use('/static', express.static('public'));
app.use('/node_modules/bootstrap', express.static(__dirname + '/node_modules/bootstrap'));
app.use('/node_modules/jquery', express.static(__dirname + '/node_modules/jquery'));
app.use('/node_modules/ejs', express.static(__dirname + '/node_modules/ejs'));
app.use('/assets/images', express.static(__dirname + '/assets/images'));
app.use('/assets/styles', express.static(__dirname + '/assets/styles'));
app.use('/assets/fonts', express.static(__dirname + '/assets/fonts'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret:'2C44-4D44-WppQ38S',
    resave: true,
    saveUninitialized: true
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

app.use(logger);
app.use('/', routes);

// API server

// reads all the GPIOs from the app local array
app.get('/readall', function(req, res){ 
	var out = JSON.stringify(app.locals.gpios); //maybe I could stringify settings
	res.send(out);
});

// reads a single GPIO from the app local array
app.get('/readgpio/:gpio', function(req, res){ 
	var gpioNumber = req.params.gpio;
	var localGpio = app.locals.gpios[gpioNumber];

	var gpioActive = localGpio.active;
	var gpioDirection = localGpio.direction;
	var gpioEdge = localGpio.edge;

	//physically read the status of the pin
    var gpioValue = app.locals.board[gpioNumber].readSync();
	
	//if for some reason the status has changed I update it in the global array
	app.locals.gpios[gpioNumber].value = gpioValue;

	localGpio.value = gpioValue;
	res.send(JSON.stringify(localGpio));	
});

// removes a GPIO from the app local array
app.delete('/removegpio/:gpio', function(req, res){ 
	var gpioNumber = req.params.gpio;
	app.locals.gpios[gpioNumber] = null;
	res.send("GPIO " + gpioNumber + " removed!");	
});


/// sets a single GPIO from the local array
app.post('/setgpio', function(req, res){
	var gpioNumber = req.body.gpio;
	var gpioActive = req.body.active;
	var gpioDirection = req.body.direction;
	var gpioEdge = req.body.edge;
	var gpioDescription = req.body.description;
	var gpioValue = req.body.value;

	app.locals.gpios[gpioNumber] = {};
	app.locals.gpios[gpioNumber].active = gpioActive;
	app.locals.gpios[gpioNumber].direction = gpioDirection;
	app.locals.gpios[gpioNumber].edge = ((gpioDirection=='in') ? gpioEdge : 'none');
	app.locals.gpios[gpioNumber].description = gpioDescription;
	app.locals.gpios[gpioNumber].value = ((gpioDirection=='out') ? gpioValue : 0);
	
	// let's write to the board
	//app.locals.board[gpioNumber].unexport();
	//app.locals.board[gpioNumber] = null;	
	app.locals.board[gpioNumber] = new GPIO(gpioNumber, gpioDirection,gpioEdge);
	app.locals.board[gpioNumber].writeSync(gpioValue);
	
	var out = app.locals.gpios[gpioNumber];
	res.send(JSON.stringify(out));
}); 

// login 
app.post('/login', function(req, res){
	var username = req.body.username;
	var password = req.body.password;
	req.session.authenticated = false;
	authenticate(username, password, function(err, user){ 
		if (user) { 
			req.session.regenerate(function(){
				// Store the user's primary key 
				// in the session store to be retrieved,
				// or in this case the entire user object 
				req.session.user = user;
				req.session.authenticated = true;
				res.redirect('home'); 
			}); 
		} else {
			req.session.error = 'Invalid user and/or password!'; 
			res.redirect('/');
		} 
	}); 
}); 

// logout
app.get('/logout', function(req, res){
	// destroy the user's session to log them out 
	// will be re-created next request
	req.session.destroy(function(){ 
		res.redirect('/');
	}); 
}); 


/* app.post('/setpin', function(req, res){
	var pinNumber = req.body.number;
	var pinDirection = req.body.direction;
	var pinValue = req.body.value;
	app.locals.gpios[pinNumber].direction = pinDirection;
	app.locals.gpios[pinNumber].value = pinValue;
	var pin = new GPIO(pinNumber, pinDirection);
    	pin.writeSync(pinValue);
	var out = app.locals.gpios[pinNumber];
	res.send(JSON.stringify(out));
});*/ 



var server = app.listen(3000);
console.log('Express started on port ' + 3000); 

var io = require('socket.io').listen(server);

// Web Socket Connection
io.on('connection', function (socket) {
	for (i = 2; i <= 27; i++) {
		if (app.locals.gpios[i]) {
			var x = app.locals.gpios[i];
			if ((x.direction == "in") && (x.active == 1)) {
				(function(i){
					var dest = 'ping'+i;
					//app.locals.board[i] = new GPIO(i, x.direction, x.edge);
					//console.log(app.locals.board[i]);
					app.locals.board[i].watch(function (err, value) {
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
hash(adminPassword, function(err, salt, hash){ 
	if (err) throw err; 
	// store the salt & hash in the "db"
	users.admin.salt = salt; 
	users.admin.hash = hash.toString();
}); 

// Authenticate using our plain-object database of doom!
function authenticate(name, pass, fn) { 
	var user = users[name]; 
	// query the db for the given username
	if (!user) return fn(new Error('User not found!'));
    hash(pass, user.salt, function(err, hash){
		if (err) return fn(err);
		if (hash.toString() == user.hash) return fn(null, user);
		fn(new Error('Invalid password!'));
	});
} 

function logger(req,res,next){
  console.log(new Date(), req.method, req.url);
  next();
}

