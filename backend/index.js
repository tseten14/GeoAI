// API server entry

var express = require('express');
var path = require('path');
var fs = require('fs');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var ex_session = require('express-session');
var methodOverride = require('method-override');
var bcrypt = require('bcryptjs');

var username = 'sherpa_14';
var password = 'geocode';
password = bcrypt.hashSync(password, 10);

var routes = require('./routes/index');
var app = express();

var webDist = path.join(__dirname, '..', 'frontend', 'contacts', 'dist');
var webIndex = path.join(webDist, 'index.html');
var trafficDist = path.join(__dirname, '..', 'frontend', 'traffic', 'dist');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(methodOverride());
app.use(cookieParser());
app.use(ex_session({
  secret: 'cmps369',
  resave: false,
  saveUninitialized: false,
  cookie: { sameSite: 'lax', httpOnly: true }
}));

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  {
    usernameField: 'username',
    passwordField: 'password'
  },
  function (user, pswd, done) {
    if (user != username) {
      console.log('Username mismatch');
      return done(null, false);
    }

    bcrypt.compare(pswd, password, function (err, isMatch) {
      if (err) return done(err);
      if (!isMatch) {
        console.log('Password mismatch');
      } else {
        console.log('Valid credentials');
      }
      done(null, isMatch);
    });
  }
));

passport.serializeUser(function (username, done) {
  done(null, username);
});

passport.deserializeUser(function (username, done) {
  done(null, username);
});

app.use('/', routes);

var trafficApiRoute = require('./routes/traffic-api');
app.use('/api', trafficApiRoute);

app.use('/traffic', express.static(trafficDist));
app.get('/traffic/*', function (req, res) {
  res.sendFile(path.join(trafficDist, 'index.html'));
});

if (process.env.NODE_ENV === 'production' || fs.existsSync(webIndex)) {
  app.use(express.static(webDist));
  app.get('*', function (req, res, next) {
    if (req.path.startsWith('/api') || req.path.startsWith('/traffic')) {
      return next();
    }
    res.sendFile(webIndex);
  });
}

app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    if (req.path.indexOf('/api/') === 0) {
      return res.json({ message: err.message, error: err.stack });
    }
    res.type('html').send('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head><body><h1>'
      + err.message + '</h1><pre>' + (err.stack || '') + '</pre></body></html>');
  });
} else {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    if (req.path.indexOf('/api/') === 0) {
      return res.json({ message: err.message });
    }
    res.type('html').send('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head><body><h1>'
      + err.message + '</h1></body></html>');
  });
}

module.exports = app;

var debug = require('debug')('guess:server');
var http = require('http');

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

var server = http.createServer(app);
var hostname = '127.0.0.1';

(async function () {
  await routes.dbReady;
  server.listen(port, hostname);
  server.on('error', onError);
  server.on('listening', onListening);
})();

function normalizePort(val) {
  var port = parseInt(val, 10);
  if (isNaN(port)) {
    return val;
  }
  if (port >= 0) {
    return port;
  }
  return false;
}

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }
  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
