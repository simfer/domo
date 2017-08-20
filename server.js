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

var jsonfile = require('jsonfile');
var file = 'app_data.json'

var app_data = jsonfile.readFileSync(file);

// this is the variable hosting initial data. These data could come from a DB
/*
var settings = [
	{'gpio':17,'active':1,'direction':'in','edge':'both','value':0,'description':'Garage door'},
	{'gpio':18,'active':0,'direction':'in','edge':'both','value':0,'description':'Main gate'},
	{'gpio':23,'active':1,'direction':'out','edge':'none','value':0,'description':'Garage light'},
	{'gpio':25,'active':1,'direction':'out','edge':'none','value':1,'description':'Outside lights'}
];

// LANGUAGE
var language = {
	'inputTableTitle': 'INPUT Ports',
	'outputTableTitle': 'OUTPUT Ports',
	'msgInEditTitle': 'INPUT Port',
	'msgOutEditTitle': 'OUTPUT Port',
	'add': 'Add',
	'active': 'Attivo',
	'gpio': 'GPIO',
	'edge': 'EDGE',
	'direction': 'Direction',
	'description': 'Description',
	'value': 'Value',
	'status': 'Status',
	'actions': 'Actions',
	'on': 'ON',
	'off': 'OFF',
	'ok': 'OK!',
	'alarm': 'ALARM!',
	'cancel': 'Cancel',
	'save': 'Save',
	'error': 'ERROR',
	'EINVUIDPWD':'Invalid user ID and/or password!'
};
*/

//var app_data = {
//	gpios: settings,
//	language: language
//};


//var jsonfile = require('jsonfile');

//var file = 'app_data.json'
 
//jsonfile.writeFile(file, app_data, function (err) {
//  console.error(err)
//});

// data is transformed into an array in order to better work with it
//app.locals.gpios = []; // the array of the GPIO details
app.locals.board = []; // the array of the physical GPIO objects on the Raspberry board

// parsing the settings to populate the array of the GPIO details and
// doing a setup for the GPIO pins on the board
app_data.gpios.forEach(function(element) {
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
app.set('app_data', app_data); 

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
    
	if (err) res.locals.message ='<div class="alert alert-danger" role="alert"><span class="glyphicon glyphicon-exclamation-sign" aria-hidden="true"></span><span class="sr-only">Error:</span>' + err + '</div>';
	if (msg) res.locals.message ='<div class="alert alert-success" role="alert"><span class="glyphicon glyphicon-ok" aria-hidden="true"></span><span class="sr-only">Success:</span>' + msg + '</div>';
	next(); 
}); 

app.use(logger);
app.use('/', routes);

// API server


// reads all the GPIOs from the app local array
app.get('/writeappdata', function(req, res){
	var jsonfile = require('jsonfile');
	var file = 'app_data.json'
 
	jsonfile.writeFile(file, app_data, function (err) {
		if(err) res.send(err);
		var out = app_data
		res.send(out);
	});
});


// reads all the GPIOs from the app local array
app.get('/readall', function(req, res){ 
	var out = JSON.stringify(app_data.gpios); //maybe I could stringify settings
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
	
	var found = -1;
	for (i = 0; i < app_data.gpios.length; i++) {
		if (app_data.gpios[i].gpio == gpioNumber) { // the gpio already exists
			found = i; // I take the element's position
		}
	}

	// if the gpio has been found
	if (found >= 0) {
		app_data.gpios.splice(found, 1); // I remove the i element
	}
	app.locals.board[gpioNumber] = null;	
	res.send("GPIO " + gpioNumber + " removed!");	
});




/// sets a single GPIO from the local array
app.put('/setgpioprop/:gpio', function(req, res){
	var gpioNumber = req.params.gpio;
	//var gpioActive = req.body.active;
	//var gpioDirection = req.body.direction;
	//var gpioEdge = req.body.edge;
	//var gpioDescription = req.body.description;
	var gpioValue = req.body.value;

	var found = -1;
	for (i = 0; i < app_data.gpios.length; i++) {
		if (app_data.gpios[i].gpio == gpioNumber) { // the gpio already exists
			found = i; // I take the element's position
		}
	}

	// if the gpio has been found
	if (found >= 0) {
		//console.log(app_data.gpios[i]);
		app_data.gpios[found].value = gpioValue;
		// let's write to the board
		app.locals.board[gpioNumber].writeSync(gpioValue);
	}

	//console.log(found);
	//console.log(app.locals.board);

	
	//var out = app.locals.gpios[gpioNumber];
	res.send(JSON.stringify(app_data.gpios[found]));
}); 


app.put('/setgpioactive/:gpio', function(req, res){
	var gpioNumber = req.params.gpio;
	var gpioActive = req.body.active;

	var found = -1;
	for (i = 0; i < app_data.gpios.length; i++) {
		if (app_data.gpios[i].gpio == gpioNumber) { // the gpio already exists
			found = i; // I take the element's position
		}
	}

	// if the gpio has been found
	if (found >= 0) {
		app_data.gpios[found].active = gpioActive;
	}
	console.log(gpioNumber,app_data.gpios[found]);

	res.send(JSON.stringify(app_data.gpios[found]));
}); 



/// sets a single GPIO from the local array
app.post('/setgpio', function(req, res){
	var gpioNumber = req.body.gpio;
	var gpioActive = req.body.active;
	var gpioDirection = req.body.direction;
	var gpioEdge = req.body.edge;
	var gpioDescription = req.body.description;
	var gpioValue = req.body.value;

	var found = -1;
	for (i = 0; i < app_data.gpios.length; i++) {
		if (app_data.gpios[i].gpio == gpioNumber) { // the gpio already exists
			found = i; // I take the element's position
		}
	}

	// if the gpio has been found
	if (found >= 0) {
		app_data.gpios.splice(found, 1); // I remove the i element
	}

	var newGpio = { 
		'gpio': gpioNumber,
		'active': gpioActive,
		'direction': gpioDirection,
		'edge': ((gpioDirection=='in') ? gpioEdge : 'none'),
		'value': ((gpioDirection=='out') ? gpioValue : 0),
		'description': gpioDescription 
	};

	app_data.gpios.push(newGpio);

	// let's write to the board
	//app.locals.board[gpioNumber].unexport();
	//app.locals.board[gpioNumber] = null;	
	app.locals.board[gpioNumber] = new GPIO(gpioNumber, gpioDirection,gpioEdge);
	app.locals.board[gpioNumber].writeSync(gpioValue);
	
	//var out = app.locals.gpios[gpioNumber];
	res.send(JSON.stringify(newGpio));
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
			req.session.error = app_data.language.EINVUIDPWD; 
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

//Socket test

/* var io = require('socket.io').listen(server);

io.on('connection', function (socket) {
	console.log('timeout started');
	setTimeout(function(){
		console.log("emitted1");
		socket.emit('receiver',{ 'sender':'dummy1','value': 1 });
	}, 10000);
	setTimeout(function(){
		console.log("emitted2");
		socket.emit('receiver',{ 'sender':'dummy2','value': 0 });
	}, 30000);
});

*/

setSocketConnection();


function setSocketConnection() {
	var io = require('socket.io').listen(server);
	
	// Web Socket Connection
	io.on('connection', function (socket) {
		for (i = 0; i < app_data.gpios.length; i++) {
			var x = app_data.gpios[i];
			var gpioNumber = x.gpio;
			if ((x.direction == "in") && (x.active == 1)) {
				(function(i){
					var sender = app_data.gpios[i].gpio;
					console.log('sender ' + sender);
					app.locals.board[sender].watch(function (err, value) {
						 if (err) throw err;
						socket.emit('receiver',{ 'sender':sender,'value': value });
					});
				})(i);
			} else {
				//var sender = app_data.gpios[i].gpio;
				//console.log(sender);
				//if (app.locals.board[sender]) {
				//	app.locals.board[sender].unwatchAll();
				//}
			}
		}
	});
	
}

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

