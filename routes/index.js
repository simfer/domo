var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
	res.render('index');
});

router.get('/error', function(req, res) {
	var data = {};
	data.message = req.session.error;
	res.render('error',data);
});

router.get('/home', function(req, res) {
	if (req.session.authenticated) {
		var app_data = req.app.get('app_data');
		res.render('home',app_data);
	}
	else
		return res.sendStatus(401);
});

router.get('/settings', function(req, res) {
	var app_data = req.app.get('app_data');
	res.render('settings',app_data);
});

module.exports = router;