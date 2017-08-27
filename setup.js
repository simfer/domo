var hash = require('./pass').hash;
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('domodb');

/*

var users = { admin: { name: 'admin', password: 'Admin123' }};
hash(users.admin.password, function(err, salt, hash){ 
	if (err) throw err; 
	// store the salt & hash in the "db"
	users.admin.salt = salt; 
	users.admin.hash = hash.toString();
}); 

*/

var users = [
  { username: 'simfer', password: 'Admin123', salt: '', hash: '', firstname: 'Simmaco', lastname: 'Ferriero', role: 'admin' },
  { username: 'antcas', password: 'Welcome1', salt: '', hash: '', firstname: 'Antonio', lastname: 'Casertano', role: 'user' }
];

users.forEach(function (element) {
  hash(element.password, function (err, salt, hash) {
    if (err) throw err;
    element.salt = salt;
    element.hash = hash.toString();
  });
});

db.serialize(function () {
  db.run("DROP TABLE IF EXISTS users");
  db.run("CREATE TABLE users (id INT, username TEXT, salt TEXT, hash TEXT, fisrtname TEXT, lastname TEXT, role TEXT)");
  
  db.run("DROP TABLE IF EXISTS inputports");
  db.run("CREATE TABLE inputports (gpio INT, description TEXT, direction TEXT, edge TEXT, active INT, value INT)");

  db.run("DROP TABLE IF EXISTS outputports");
  db.run("CREATE TABLE outputports (gpio INT, description TEXT, direction TEXT, edge TEXT, active INT, value INT)");
  
  db.run("DROP TABLE IF EXISTS in2out");
  db.run("CREATE TABLE in2out (gpioin INT, gpioout INT, gpiooutvalue INT)");
  
  var counter = 0;

  users.forEach(function (element) {
    counter++;

    var stmt = db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?)");

    hash(element.password, function (err, salt, hash) {
      if (err) throw err;
      stmt.run(counter, element.username, salt, hash.toString(), element.firstname, element.lastname, element.role);
      stmt.finalize();
    });
  });

  var stmt = db.prepare("INSERT INTO inputports VALUES (?,?,?,?,?,?)");
  stmt.run(17,'Main Gate','in','both',1,0);
  stmt.run(18,'Roof window','in','both',0,0);
  stmt.finalize();
  
  var stmt = db.prepare("INSERT INTO outputports VALUES (?,?,?,?,?,?)");
  stmt.run(25,'Garden lights','out','',1,0);
  stmt.run(24,'Garage door','out','',1,1);
  stmt.finalize();
  
  var stmt = db.prepare("INSERT INTO in2out VALUES (?,?,?)");
  stmt.run(17,24,1);
  stmt.run(17,25,0);
  stmt.finalize();

  db.each("SELECT * FROM users", function (err, row) {
    console.log(row);
  });

  db.each("SELECT * FROM inputports", function (err, row) {
    console.log(row);
  });

  db.each("SELECT * FROM outputports", function (err, row) {
    console.log(row);
  });

  db.each("SELECT * FROM in2out", function (err, row) {
    console.log(row);
  });

  db.close();

});


