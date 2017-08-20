var express = require('express');
var router = express.Router();
var my_data = {title: 'pippo',supplies: ['mop', 'broom', 'duster']};

router.get('/', function(req, res) {
	res.render('index');
});

router.get('/home', function(req, res) {
	if (req.session.authenticated || 1) {
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