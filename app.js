const express = require('express'); // Import expess.js
const routes = require('./pages/index'); // Import the index.js router
const path = require('path'); // (Handles path concatenation)

const app = express(); // Initiate express
const bodyParser = require('body-parser'); // Used for GET / POST query / body data
const expressip = require('express-ip'); // Handles IP info for logins
const session = require('express-session'); // Handles sessioning (cookie login)
const passport = require('passport') // Handles the login procedure.

/*
Explanation:

I used passport.js / express-session instead of a custom made solution because it is imperative to get the security
right on this product - hence I used widely known, tested, secure and frequently updated off-the-shelf software with custom
code configuration (mostly in index.js) to achieve a higher level of security assurance than I would have been able to deliver.

*/

app.locals.basedir = __dirname // Just to patch glitchy pug behaviour
app.use(passport.initialize()) // Sets up login
app.use(passport.session()) // Links cookie login

app.use('/assets',express.static('assets')); // Sets a static /assets endpoint for the client to references the assets directory.

app.use(session({ resave: false, saveUninitialized: false, secret: 'XXXXXXXXXXXXX', cookie: { maxAge: 60000000 }}))
// ^^ Used in conjunction with passport.session, sets up the cookie sessioning - secret is just a made up term.
// MaxAge is about a day which is reasonable for one night of windmill.

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(expressip().getIpInfoMiddleware);

app.enable('trust proxy') // Used so that the IP middleware can get real IP data.

app.set('views', path.join(__dirname, 'views')); // Sets up pug reference folder.
app.set('view engine', 'pug'); // Sets up the pug view engine. Described above.

app.use('/', routes); // Used to route for future expansion.

module.exports = app;