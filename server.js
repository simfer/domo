var express = require('express');
var session = require('express-session');
var socket_io = require('socket.io');
var hash = require('./pass').hash;
var pidetect = require('./pidetect');
var ejs = require('ejs');
var privateSocket = null;

var routes = require('./routes/index');
var bodyParser = require("body-parser");

// detecting if we are on a real RASPBERRY or not
//const pitect = require('pitect');

if(pidetect.isPi()) {
	console.log('This is a Raspberry Pi.');
	console.log('This is: ' + pidetect.piModel().name);
	var GPIO = require('onoff').Gpio;	
} else {
	console.log('This is not a Raspberry!');
	var GPIO = require("./fakeonoff.js");
}

// dummy database 
// the following two lines should be managed differently
var users = { admin: { name: 'admin', password: 'Admin123' }};
hash(users.admin.password, function(err, salt, hash){ 
	if (err) throw err; 
	// store the salt & hash in the "db"
	users.admin.salt = salt; 
	users.admin.hash = hash.toString();
}); 

var app = express(); // creating the main application

// data are read from an external JSON file
var jsonfile = require('jsonfile');
var file = 'app_data.json'
var app_data = jsonfile.readFileSync(file);


// we are creating an arary to hos all the physical GPIOs we are going to open
app.locals.board = []; // the array of the physical GPIO objects on the Raspberry board

// parsing the data to populate the board array
// in this step we are physically creating the GPIOs in a different way based on the GPIO's direction
app_data.gpios.forEach(function(element) {
	app.locals.board[element.gpio] = new GPIO(element.gpio, element.direction, element.edge);
	if(element.direction == 'out') {
		console.log("Created pin [" + element.gpio + "] - Value [" + element.value + "]");
		app.locals.board[element.gpio].writeSync(element.value);
	} else {
		console.log("Created pin [" + element.gpio + "] - Direction [" + element.direction + "] - Edge [" + element.edge + "]");
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
    secret:'6C49-4A81-DapR3Qq',
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


/*
 * API server
 */

// reads all the GPIOs from the app_data variable
app.get('/readall', function(req, res){ 
	var out = JSON.stringify(app_data.gpios);
	res.send(out);
});



/// add a single GPIO if it doesn't exist
app.post('/addgpio/:gpio', function(req, res){
	var gpioNumber = req.params.gpio;

	var gpioActive = req.body.active;
	var gpioDirection = req.body.direction;
	var gpioEdge = req.body.edge;
	var gpioDescription = req.body.description;
	var gpioValue = req.body.value;

	// searching for the gpio
	var found = findGpio(gpioNumber);
	var gpioIndex = found.index;
	
	// if the gpio has been found
	if (gpioIndex > -1) {
		res.status(500).send('GPIO already existing!');
	} else {
		var newGpio = { 
			'gpio': gpioNumber,
			'active': gpioActive,
			'direction': gpioDirection,
			'edge': ((gpioDirection=='in') ? gpioEdge : 'none'),
			'value': ((gpioDirection=='out') ? gpioValue : 0),
			'description': gpioDescription 
		};
	
		app_data.gpios.push(newGpio);
	
		// writing data to the disk
		writeAppData();
	
		// let's write to the board	
		app.locals.board[gpioNumber] = new GPIO(gpioNumber, gpioDirection,gpioEdge);
		if(gpioDirection == 'out') app.locals.board[gpioNumber].writeSync(gpioValue);
		console.log(newGpio);
		//setSocketConnection();
		res.send(JSON.stringify(newGpio));
	}
}); 


/// sets a single GPIO from the local array
app.put('/setgpio/:gpio', function(req, res){
	var gpioNumber = req.params.gpio;
	
	// searching for the gpio
	var found = findGpio(gpioNumber);
	var gpioIndex = found.index;
	
	// if the gpio is not found
	if (gpioIndex == -1) {
		res.status(500).send('GPIO NOT found!');
	} else {
		console.log(req.body);

		var gpioActive = ((req.body.active != undefined) ? req.body.active : found.gpio.active);
		var gpioDirection = ((req.body.direction != undefined) ? req.body.direction : found.gpio.direction);
		var gpioEdge = ((req.body.edge != undefined) ? req.body.edge : found.gpio.edge);
		var gpioDescription = ((req.body.description != undefined) ? req.body.description : found.gpio.description);
		var gpioValue = ((req.body.value != undefined) ? req.body.value : found.gpio.value);
	
		/*
		console.log('[' + req.body.active  +'] - [' + gpioActive +']');
		console.log('[' + req.body.direction  +'] - [' + gpioDirection +']');
		console.log('[' + req.body.edge  +'] - [' + gpioEdge +']');		
		console.log('[' + req.body.description  +'] - [' + gpioDescription +']');
		console.log('[' + req.body.value  +'] - [' + gpioValue +']');	
		*/
		
		app_data.gpios[gpioIndex].active =  gpioActive;
		if (gpioDirection == 'in') {
			if (gpioActive == 0) {
				app.locals.board[gpioNumber].unwatchAll();
				console.log("Stopped watching on " + gpioNumber + "!");
			} else {
				console.log("Started watching on " + gpioNumber + "!");
				app.locals.board[gpioNumber].watch(function (err, value) {
					if (err) throw err;
					privateSocket.emit('toClient',{ 'gpio':gpioNumber,'value': value });
					console.log('Server sent GPIO [' + gpioNumber + ']  with value [' + value + '] to client!');
				});
			}
		}

		app_data.gpios[gpioIndex].direction = gpioDirection;
		app_data.gpios[gpioIndex].edge = ((gpioDirection=='in') ? gpioEdge : 'none');
		app_data.gpios[gpioIndex].description = gpioDescription;
		app_data.gpios[gpioIndex].value = ((gpioDirection=='out') ? gpioValue : 0);
		var result = app_data.gpios[gpioIndex];
		
		// if the direction is OUT let's write to the board
		if(gpioDirection == 'out') app.locals.board[gpioNumber].writeSync(gpioValue);

		// writing data to the disk
		writeAppData();
		
		res.send(JSON.stringify(result));		
	}	
}); 

// removes a GPIO from the app local array
app.delete('/removegpio/:gpio', function(req, res){ 
	var gpioNumber = req.params.gpio;

	// searching for the gpio
	var found = findGpio(gpioNumber);
	var gpioIndex = found.index;

	// if the gpio is not found
	if (gpioIndex == -1) {
		res.status(500).send('GPIO NOT found!');
	} else {
		if(app_data.gpios[gpioIndex].direction == 'out') {
			// if the direction is OUT I simply set the GPIO level to 0
			app.locals.board[gpioNumber].writeSync(0);
		} else {
			// if the diection is IN and the GPIO is active I remove any watching from this GPIO
			if(app_data.gpios[gpioIndex].active == 1) app.locals.board[gpioNumber].unwatchAll();		
		}
		app.locals.board[gpioNumber].unexport();
		app.locals.board[gpioNumber] = null;	
		app_data.gpios.splice(gpioIndex, 1); // I remove the i element

		writeAppData();

		res.send("GPIO " + gpioNumber + " successfully removed!");		
	}
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


var server = app.listen(3000);
console.log('Express started on port ' + 3000); 

var options = { pingInterval: 10000, pingTimeout: 5000 };

var io = require('socket.io').listen(server, options);

//var storeEachSocket = {};

io.set('authorization', function(handshake, accept){
	//var user = handshake._query.user;
	//  if(user in storeEachSocket) {
		//accept('User already connected', false);
	//  }
  	//else {
		accept(null, true);
	//}
});

// start listen with socket.io - simmaco
io.on('connection', function(socket){
	privateSocket = socket;

	//var query = socket.handshake.query;
	//var user = query.user;
	//storeEachSocket[user] = socket;

	//socket.on('fromClient', function(msg){
	//	io.emit('toClient', msg);
	//});
	

	for (i = 0; i < app_data.gpios.length; i++) {
		var gpioPort = app_data.gpios[i];
		if (gpioPort.direction == 'in') {
			if (gpioPort.active == 1) {
				(function(i){
					var gpioNumber = app_data.gpios[i].gpio;
					app.locals.board[gpioNumber].watch(function (err, value) {
						if (err) throw err;
						app_data.gpios[i].value = value;
						socket.emit('toClient', { 'gpio':gpioNumber,'value': value });
					});						
					console.log("Started watching on " + gpioNumber + "!");

				})(i);
			} else {
				var gpioNumber = app_data.gpios[i].gpio;
				console.log("Stopped watching on " + gpioNumber + "!");
				if (app.locals.board[gpioNumber]) {
					app.locals.board[gpioNumber].unwatchAll();
				}

			}
			console.log(JSON.stringify( app_data.gpios[i]));
		}
	}
});

io.on('disconnect', function(socket){
	console.log('disconnected');
	//var query = socket.handshake.query;
	//var user = query.user;
	//delete storeEachSocket[user]
	privateSocket = null;
 });


// FUNCTIONS

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

function findGpio(gpioNumber) {
	var result = {};
	result.index = -1;
	result.gpio = {};
	var found = -1;
	var i = 0;
	while ((found == -1) && (i < app_data.gpios.length)) {
		if (app_data.gpios[i].gpio == gpioNumber) { // the gpio already exists
			found = i; // I take the element's index
		}
		i++;
	}

	// if the gpio has been found
	if (found >= 0) {
		result.index = found;
		result.gpio = app_data.gpios[found];
	}
	
	return result;
}

function writeAppData() {
	var result = {};
	var jsonfile = require('jsonfile');
	var file = 'app_data.json'
 
	jsonfile.writeFile(file, app_data, function (err) {
		if(err) throw(err);
	});
};
