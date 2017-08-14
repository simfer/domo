var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
	console.log(req.session);
	
	res.render('index');
});

router.get('/home', function(req, res) {
	res.render('home');
});

router.get('/settings', function(req, res) {
	res.render('settings');
});

module.exports = router;