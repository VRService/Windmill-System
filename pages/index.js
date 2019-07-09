const express = require('express');

const router = express.Router(); // Run the express router


const bcrypt = require('bcryptjs'); // Handles password hashing

const co = require('co'); // Used previously to test async calls
var csrf = require('csurf') // Runs the CSRF endpoint.

var csrfProtection = csrf({ cookie: false }); // Setup CSRF to work w/o cookies (and hence via passport-session)

var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy; // Use the username/password strategy via passport.js

const uri = "your database connection here";
// The login for the
// Redacted the database connection information


const sgMail = require('@sendgrid/mail'); // SendGrid email account for sending notification emails.
sgMail.setApiKey('your sendgrid key here'); // For emails

const MongoClient = require('mongodb').MongoClient; // Define monogdb client

const { body, validationResult } = require('express-validator/check'); // Unused in prod

const client = new MongoClient(uri, { useNewUrlParser: true }); // Begin mongodb client worker.

client.connect(function(err, db) { // Connect to DB.
  if (err) throw err;
  var dbo = client.db("WindmillDevA");
  if (!err) {
    console.log("[windersDB] Connected to WindmillStore DB on Atlas")
  } else {
      console.log("[windersDB] Error connecting to WindmillStore:")
      console.log(err);
      return;
  }
  passport.use(new LocalStrategy({ // Login system
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true,
  },
    function(req, username, password, done) { // Callback to that
      dbo.collection("Users").findOne({ email: username.toLowerCase() }, function(err, user) { // Finds user from DB
        if (err) {
           console.log("DB error"); // DB Failed
           return done(err); 
          }
        if (!user) {
          console.log("User not found") // No user found
          return done(null, false, { message: 'Incorrect username.' });
        }
        if (!bcrypt.compareSync(password, user.password_hash)) { // Uses bcrypt hash to compare passwords securely.
          console.log("Not correct password")
          return done(null, false, { message: 'Incorrect password.' });
        }
        return done(null, user);
      });
    }
  ));
  router.get('/',function(req,res) { // re-renders home (no redirect)
    if (req.session && req.session.passport && req.session.passport.user) {
      res.render('home',{title: 'Home', loggedIn: true})
    } else {
        res.redirect('/login');
    }
  })
  router.get('/logout', function(req, res){ // Logs out via passport.js
    req.logout();
    res.redirect('/login'); // Go back to login
  });
  router.get('/user-profile', csrfProtection, (req,res) => { // user-profile (renders tab.pug) - sends csrf token too for /api/v1/processOrder
    if (req.session && req.session.passport && req.session.passport.user && req.query && req.query.first_name && req.query.last_name) { // Check all the information is present
      dbo.collection("Users").findOne({ first_name: req.query.first_name, last_name: req.query.last_name },function(err, userGuy) {
        if (!userGuy) { // No user found
          res.redirect('/home'); // Redirect
        } else { // User found by query data
          dbo.collection("Products").find({ }).toArray(function(err, products) { // List all products 
            // ...Then render into pug w/ csrfToken sent into flash params
            res.render('tab',{title: 'User Tab', csrfToken: req.csrfToken(), products: products, loggedIn: true,user: req.session.passport.user, pupil: userGuy})
          });
        }
      });
    } else {
        res.redirect('/login');
    }
  }) 
  router.get('/home',(req,res) => { // Get homepage 
    if (req.session && req.session.passport && req.session.passport.user) { // Default redirect wrapper
      res.render('home',{title: 'Home', loggedIn: true,user: req.session.passport.user})
    } else {
        res.redirect('/login');
    }
  })
  var users_ordering_list = {};
  router.post('/api/v1/processOrder', csrfProtection, (req,res) => { // Process order. Wrappeed in csrfProtection (if no CSRF-Token present / valid, it rejects automatically)
    var retValue = "Unspecified error"
    if (req.session && req.session.passport && req.session.passport.user) {
      if (users_ordering_list[req.session.passport.user._id] != null || (req.session.passport.user.acc_type != "aux_admin" && req.session.passport.user.acc_type != "staff")) { // Check the account is authorised
        res.statusCode = 403;
        retValue = "You are not authorised to charge accounts / ordering too fast!"
      } else { // OK to charge
        var dateNow = Date.now()
        users_ordering_list[req.session.passport.user._id] = dateNow;
        setTimeout(function() {
          if (users_ordering_list[req.session.passport.user._id] === dateNow) {
            users_ordering_list[req.session.passport.user._id] = null;
          }
        },1000)
        if (req.body && req.body.user && req.body.products) { // Double check parameters are safe.
          dbo.collection("Users").find({ }).toArray(function(err, users) {
            var user;
            for (let index = 0; index < users.length; index++) { // Weird bug: findOne() doesn't work by ID fetch. So we had to do a hackier solution.
              const element = users[index];
              if (element._id == req.body.user) {
                user = element;
                break;
              }
            }
            if (user == null) {
              res.statusCode = 404;
              retValue = 'User not found'
              res.end(JSON.stringify({success: false,reason: retValue}))
            } else {
              if (typeof req.body.products === "object") {
                var productCount = {};
                var finalPrice = 0;
                dbo.collection("Products").find({ }).toArray(function(err, products) { // Get all products
                  var product_list = {};
                  products.forEach(element => {
                    product_list[element.product_name] = element.product_price;
                  });
                  req.body.products.forEach(product => {
                    if (product_list[product]) {
                        if (!productCount[product]) {
                            productCount[product] = 0;
                        }
                        finalPrice += parseFloat(product_list[product]);
                        productCount[product] += 1; // Same logic as tab.js
                    }
                  });
                  // Log info into console
                  console.log("Final Count:")
                  console.log(productCount);
                  console.log("Final Price:")
                  console.log("£"+finalPrice);
                  if (user.account_balance >= finalPrice) { // Check they can actually afford it
                    dbo.collection("Users").updateOne( // Update DB with new price.
                      { _id: user._id },
                      { $set: { "account_balance": user.account_balance - finalPrice } }
                    ) // PAYMENT SUCCESS!
                    res.end(JSON.stringify({success: true}))
                    var str = "Your Order: "; // Base string
                    for (const key in productCount) { 
                        if (productCount.hasOwnProperty(key)) {
                            str = str + key + " x" + productCount[key] + "\n" // String concatenation
                        }
                    }
                    var msg = {
                      to: req.session.passport.user.email,
                      from: 'windmill@ampleforth.org.uk',
                      subject: 'You have made an order',
                      text: `Hey,${req.session.passport.user.first_name}!\n\nYou have just made an order at Windmill.\n\n${str}\n\nIf this wasn't you, contact your houseparent immediately.\n\nThanks, \nWindmill Staff`, // Parse GeoIP Info
                    };
                    sgMail.send(msg); // Send email via sendgrid.
                    // Forward to receipt
                    // Receipt then log action into DB. (we don't have hardware access here (yet) so this is a future expansion)
                  } else {
                    req.statusCode = 418 // I'm a teapot
                    res.end(JSON.stringify({success: false,reason: "I'm a teapot"}))
                  }
                });
              } else {
                req.statusCode = 500; // Other error.
                res.end(JSON.stringify({success: false,reason: retValue}))
              }
            }
          });
        }
      }
    } else {
        res.statusCode = 403;
        retValue = "403 authentication failed"
    }
    if (res.statusCode != 200) {
      res.end(JSON.stringify({success: false,reason: retValue})) // Fail value outside of promises
    }
  })
  router.get('/login', (req, res) => { // Shows login page (GET)
    res.render('login', { title: 'Login'}); // Pug render
  });
  router.post('/login', 
    passport.authenticate('local', { failureRedirect: '/login' }),
    function(req, res) {
      if (req.ipInfo && req.ip) { // IP GeoLocation online
        var msg = {
          to: req.session.passport.user.email,
          from: 'windmill@domain.org.uk',
          subject: 'New login detected',
          text: `You have logged in from the IP ${req.ipInfo.region}, ${req.ipInfo.country} (from IP: ${req.ip})`, // Parse GeoIP Info
        };
        sgMail.send(msg); // Send email via sendgrid.
      }
      res.redirect('/home'); // Redirect to homepage after login
    });

  passport.serializeUser(function(user, done) { // Starts user cookie session.
    console.log(user);
    done(null, user);
  });
  // This logic removes the user's session when they log out.
  passport.deserializeUser(function (user, done) {
      dbo.collection("Users").findById({id: user}).toArray(function (err, user) {
          done(err, user);
      });
  }); 

});

module.exports = router;