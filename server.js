'use strict';

// Required Packages
const superagent = require('superagent');
const express = require('express');
const methodOverride = require('method-override');
const pg = require('pg');
require('dotenv').config();

// Imported Callback Functions

// Global Variables

const app = express();
const PORT = process.env.PORT || 5050;

// For Form Use

app.use(express.static('./public'));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_overrideMethod'));
// Config

app.set('view engine', 'ejs');

// Middleware
const client = new pg.Client(process.env.DATABASE_URL);
client.on('error', console.error);
client.connect();

// Server Locations
// Get, POST etc
app.get('/', homeTest);

app.post('/account/exist', accountLogin);
app.get('/account/login', renderLogin);
app.post('/account/create', createAccount);
app.get('/dashboard/survey', takeSurvey);
app.post('/dashboard/map', displayMap);
app.get('/dashboard/survey/get', getSurvey);
app.put('/dashboard/survey/update/done', updateSurvey);
app.get('/account/view', viewAccount);
app.put('/account/update', updateAccount);

// Route Callbacks

// test route for suggestions
app.get('/dashboard/suggestions', showSuggestions);

function showSuggestions(req, res) {
  res.render('complete/suggestions',{'user': req.query.username, 'id': req.query.id, 'loggedIn': true, 'ecoscore': '50'});
} // TODO: not retrieving actual eco score yet

//test route for CarbonFootprint API
app.get('/test2', getCarCO2);
function getCarCO2(req, res) {
  const url = 'https://carbonfootprint1.p.rapidapi.com/CarbonFootprintFromCarTravel';
  const myKey = process.env.RAPID_API_KEY;
  const queryForSuper = {
    distance: '100', //TODO: This will need to be updated to pull from req.body
    vehicle: 'SmallPetrolCar',
  };
  superagent.get(url)
    .set('x-rapidapi-key', myKey)
    .query(queryForSuper)
    .then(resultFromSuper => {
      const car = resultFromSuper.body.carbonEquivalent;
      let ecoScore = 50;
      if (car > 1.7) {
        ecoScore--;
      } else {
        ecoScore++;
      }
      const insertScore = `UPDATE profiles SET ecoscore=$1 WHERE username=$2`;
      const value = [ecoScore, 'bdavis']; //TODO: this needs updating
      client.query(insertScore, value)
        .then(eco => {
          console.log(eco);
        })
        .catch(error => {
          console.log('error from ecoScore :', error);
        })
      // Returns the CO2e in Kg from a travel by car
    })
    .catch(error => {
      console.log('error from getCarCO2 :', error);
    });
}

// Route '/'
function homeTest(req, res) {
  if (req.query.username) {
    const getEcoScore = 'SELECT ecoscore FROM profiles WHERE username=$1';
    const values = [req.query.username];
    client.query(getEcoScore, values)
      .then(returningEcoScore => {
        res.render('complete/index', { 'loggedIn': true, 'id': req.query.id, 'user': req.query.username, 'ecoscore': returningEcoScore.rows[0].ecoscore })
      })
      .catch(error => {
        console.log('error from homeTest sql query : ', error)
      });

  } else {
    res.render('complete/index', { 'loggedIn': false, 'user': req.query.username })
  }
}

// Route '/account/new'

function createAccount(req, res) {
  const sqluserName = 'INSERT INTO profiles (username) VALUES($1) RETURNING ID';
  const userNamevalue = [req.body.userName];
  client.query(sqluserName, userNamevalue)
    .then(username => {
      const zipCodeSql = 'INSERT INTO location (username, zipcode) VALUES($1, $2)';
      const zipcodeValue = [username.rows[0].id, req.body.zipCode];
      client.query(zipCodeSql, zipcodeValue)
        .then(zipcode => {
          res.render('complete/login', { 'accountCreated': true, 'failed': false, 'loggedIn': false });
        })
    })
}

// Route '/account/login'
function renderLogin(req, res) {
  res.render('complete/login', { 'accountCreated': false, 'failed': false, 'loggedIn': false });
}

function accountLogin(req, res) {
  const sql = 'SELECT * from profiles WHERE username=$1';
  const value = [req.body.userName];
  client.query(sql, value)
    .then(userInfo => {
      if (userInfo.rows.length > 0) {
        res.redirect('/?username=' + req.body.userName + '&id=' + userInfo.rows[0].id);
      } else {
        res.render('complete/login', { 'failed': true, 'accountCreated': false, 'loggedIn': false })
      }
    })
    .catch(error => {
      console.log('error from accountLogin: ', error);
    })
}

// Route '/dashboard/survey'
function takeSurvey(req, res) {
  const getEcoScore = 'SELECT ecoscore FROM profiles WHERE username=$1';
  const values = [req.query.username];
  client.query(getEcoScore, values)
    .then(returningEcoScore => {
      console.log(returningEcoScore.rows[0].ecoscore);
      res.render('complete/survey', { 'user': req.query.username, 'id': req.query.id, 'loggedIn': true, 'ecoscore': returningEcoScore.rows[0].ecoscore });
    })
    .catch(error => {
      console.log('error from homeTest sql query : ', error)
    });
}

// Route '/dashboard/map'
function displayMap(req, res) {
  const url = 'https://carbonfootprint1.p.rapidapi.com/CarbonFootprintFromCarTravel';
  const myKey = process.env.RAPID_API_KEY;
  const queryForSuper = {
    distance: '100', //TODO: This will need to be updated to pull from req.body
    vehicle: 'SmallPetrolCar',
  };
  superagent.get(url)
    .set('x-rapidapi-key', myKey)
    .query(queryForSuper)
    .then(resultFromSuper => {
      const car = resultFromSuper.body.carbonEquivalent;
      let ecoScore = 50;
      if (car > 1.7) {
        ecoScore--;
      } else {
        ecoScore++;
      }
      const insertScore = `UPDATE profiles SET ecoscore=$1 WHERE username=$2`;
      const value = [ecoScore, req.query.username];
      client.query(insertScore, value)
        .then(eco => {
          console.log(eco);

          const idSql = 'SELECT id FROM profiles WHERE username=$1';
          const idValue = [req.query.username];
          client.query(idSql, idValue)
            .then(id => {
              console.log(id);
              const sql = 'INSERT INTO surveyinfo (username, energy, shower, car_travel) VALUES($1, $2, $3, $4)';
              const values = [id.rows[0].id, req.body.electricity, req.body.shower, req.body.gas];
              client.query(sql, values)
                .then(result => {
                  const ecoScoreSql = 'SELECT ecoscore FROM profiles';
                  client.query(ecoScoreSql)
                    .then(eco => {
                      console.log(eco)
                      googleMap(req, res, eco, id.rows[0].id)
                    })
                })
            })
        })
    })

}

function googleMap(req, res, eco, id) {
  const zipSql = `SELECT zipcode FROM location WHERE username=${id}`;
  client.query(zipSql)
    .then(results => {
      const googleMaps = `https://maps.googleapis.com/maps/api/geocode/json?address=${results.rows[0].zipcode}&key=${process.env.MAP_API}`;
      superagent(googleMaps)
        .then(map => {
          const getEcoScore = 'SELECT ecoscore FROM profiles WHERE username=$1';
          const values = [req.query.username];
          client.query(getEcoScore, values)
            .then(returningEcoScore => {
              console.log(returningEcoScore.rows[0].ecoscore);
              console.log(eco.rows)
              res.render('complete/map', { 'location': map.body.results[0].geometry.location, 'key': process.env.MAP_API, 'eco': eco.rows, 'user': req.query.username, 'id': req.query.id, 'loggedIn': true, 'ecoscore': returningEcoScore.rows[0].ecoscore })
            })
            .catch(error => {
              console.log('error from homeTest sql query : ', error)
            });

        })
    })
}

//Route '/dashboard/survey/get'
function getSurvey(req, res) {
  const surveySql = 'SELECT id FROM profiles WHERE username=$1';
  const value = [req.query.username];
  client.query(surveySql, value)
    .then(id => {
      const updateSql = 'SELECT * FROM surveyinfo WHERE username=$1';
      const updateValue = [id.rows[0].id];
      client.query(updateSql, updateValue)
        .then(results => {
          const getEcoScore = 'SELECT ecoscore FROM profiles WHERE username=$1';
          const values = [req.query.username];
          client.query(getEcoScore, values)
            .then(returningEcoScore => {
              console.log(returningEcoScore.rows[0].ecoscore);
              res.render('complete/updateSurvey', { 'surveyInfo': results.rows[results.rows.length - 1], user: req.query.username, 'id': req.query.id, 'loggedIn': true, 'ecoscore': returningEcoScore.rows[0].ecoscore})
            })
            .catch(error => {
              console.log('error from homeTest sql query : ', error)
            });
        })
    })
}

// Route '/dashboard/survey/update'

function updateSurvey(req, res) {
  console.log(req.query)
  const sql = 'UPDATE surveyinfo SET energy=$1, shower=$2, car_travel=$3 WHERE username=$4';
  const values = [req.body.energy, req.body.shower, req.body.car_travel, req.query.id];
  client.query(sql, values)
    .then(result => {
      console.log(req.query.username)
      res.redirect('/dashboard/survey/get?username=' + req.query.username)
    })
}

// Route '/account/view'

function viewAccount(req, res) {
  const sql = 'SELECT * FROM profiles WHERE username=$1';
  const value = [req.query.username];
  client.query(sql, value)
    .then(results => {
      const zipSql = 'SELECT zipcode FROM location WHERE username=$1';
      const zipvalue = [req.query.id];
      client.query(zipSql, zipvalue)
        .then(zip => {
          res.render('complete/account', { 'user': results.rows[0], 'zipcode': zip.rows[0].zipcode, 'id': req.query.id })
        })
    })
}

// Route '/account/update'

function updateAccount(req, res) {
  const sql = 'UPDATE profiles SET username=$1 WHERE id=$2';
  const value = [req.body.username, req.query.id];
  client.query(sql, value)
    .then(() => {
      console.log(req.body)
      const zipSql = 'UPDATE location SET zipcode=$1 WHERE username=$2';
      const zipValue = [req.body.zipcode, req.query.id];
      client.query(zipSql, zipValue)
        .then(() => {
          res.redirect('/account/view?username=' + req.body.username + '&id=' + req.query.id)
        })
    })
}
//Listen

app.listen(PORT, () => { console.log(`Listening to PORT ${PORT}`) });
