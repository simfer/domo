var express = require('express');
var hash = require('./pass').hash;
//var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var app = express();

// config 

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views'); 

app.use('/static', express.static('public'));
app.use('/node_modules/bootstrap', express.static(__dirname + '/node_modules/bootstrap'));
app.use('/node_modules/jquery', express.static(__dirname + '/node_modules/jquery'));
app.use('/assets/images', express.static(__dirname + '/assets/images'));
app.use('/assets/styles', express.static(__dirname + '/assets/styles'));

// middleware 

app.use(bodyParser());
//app.use(cookieParser('shhhh, very secret'));
//app.use(session()); 
app.use(session({
    secret:'secret',
    resave: false,
    saveUninitialized: false
}));
// Session-persisted message middleware 

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

app.get('/', function(req, res){
	res.redirect('index');
}); 

app.get('/home', function(req, res){
	res.render('home');
}); 

app.get('/logout', function(req, res){
	// destroy the user's session to log them out 
	// will be re-created next request
	req.session.destroy(function(){ 
		res.redirect('/');
	}); 
}); 

app.get('/index', function(req, res){ 
	res.render('index');
}); 

app.post('/login', function(req, res){
	authenticate(req.body.username, req.body.password, function(err, user){ 
	if (user) { 
		req.session.regenerate(function(){
			// Store the user's primary key 
			// in the session store to be retrieved,
			// or in this case the entire user object 
			req.session.user = user;
			//req.session.success = 'Authenticated as ' + user.name 
			//+ ' click to <a href="/logout">logout</a>. '
			//+ ' You may now access <a href="/restricted">/restricted</a>.'; 
			res.redirect('home'); 
		}); 
	} else {
		req.session.error = 'Utente e/o password non validi!'; 
		res.redirect('index');
	} 
	}); 
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
	//if (!module.parent) console.log('authenticating %s:%s', name, pass);
	var user = users[name]; 
	// query the db for the given username
	if (!user) return fn(new Error('Utente non trovato!'));

    hash(pass, user.salt, function(err, hash){
	if (err) return fn(err);
	if (hash.toString() == user.hash) return fn(null, user);
	fn(new Error('Password non valida'));
	})
} 

// SERVER START
app.listen(3000); 
console.log('Express started on port ' + 3000); 