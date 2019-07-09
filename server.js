// Max O'Hegarty
// (C) 2019
// Released under the CC BY-SA 2.5 License
// https://creativecommons.org/licenses/by-sa/2.5/

const PORT = 3999;

/*
## Brief Description of Inner Workings

This system is really quite simple - it is a generic industry standard express.js server operating on node.js.
It renders the DOM sent to clients through "pug" - a widely used parser for dynamic content pages. It routes requests
to the "pages" folder, which contains two of each page: the .pug file (for the DOM), and a .js file (for the processing of requests)

The Database is run through MongoDB. I made the decision to use MongoDB Atlas so we could keep the same database across production and development,
as well as leveraging automatic backups during a quite lengthy development process.

# Here is how a request might come in:

Request to login > Sent to login.js > login.js contacts MongoDB with POST data > MongoDB server shows DB > .pug file renders response if fail / 301 Redirect if success

## To-Do Feature List

- Database Connection: Y
- Sessioning: Y
    > (later) OAuth: X
- Transaction Process Page: Y

Later Feature List:

- Manual Product Add / Remove
- Launch into a Prod Server: Y
- 2-Factor: X
- SSL: X
- iSAMS Connection: X
*/


const app = require('./app');

// Setup Routing

const server = app.listen(PORT, () => {
    console.log(`[windersDB] Routing Server is running on port ${server.address().port}`);
  });