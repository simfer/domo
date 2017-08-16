var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
	res.render('index');
});

router.get('/home', function(req, res) {
	if (req.session.authenticated)
		res.render('home');
	else
		return res.sendStatus(401);
});

router.get('/settings', function(req, res) {
	res.render('settings');
});

module.exports = router;