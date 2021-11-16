const express = require('express')
const bodyParser = require('body-parser') //https://www.npmjs.com/package/body-parser
const bcrypt = require('bcrypt'); //https://www.npmjs.com/package/bcrypt
const cookie = require('cookie'); //https://www.npmjs.com/package/cookie
const escapeHtml = require('escape-html'); //https://www.npmjs.com/package/escape-html
const cors = require('cors') //https://www.npmjs.com/package/cors
const mysql = require('mysql'); //https://www.npmjs.com/package/mysql
const app = express()
 
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
app.use(bodyParser.json())
app.use(cors())

/* 
    ERROR:Client does not support authentication protocol requested by server; consider upgrading MySQL client

    If you run into this error using the following code execute it in mysql workbench

    Where root as your user localhost as your URL and password as your password
    ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';

    Then run this query to refresh privileges:
    flush privileges;
    

    ref:https://stackoverflow.com/questions/50093144/mysql-8-0-client-does-not-support-authentication-protocol-requested-by-server

*/

var connection;

function mysqlInit(){
    //modify host, user, password, and database to yours.
    connection = mysql.createConnection({
        host     : 'localhost',
        user     : 'root',
        password : 'root',
        database : 'wear0'
    });
    connection.connect(function(err) {
        if (err) {
            return console.error('error: ' + err.message);
          }
        
        let createGuest = `create table if not exists guest(
            id int primary key auto_increment,
            cookievalue varchar(500) unique not null,
            joineddate varchar(100) not null
        )`;
        let createUsers = `create table if not exists users(
          id int primary key auto_increment,
          username varchar(500) unique not null,
          name varchar(500) not null,
          password varchar(200) not null,
          joineddate varchar(100) not null
      )`;
        let createGuestCart = `create table if not exists guestcart(
          id int primary key auto_increment,
          ownercookievalue varchar(500) not null,
          productid varchar(100) not null,
          productImage varchar(200) not null,
          productName varchar(50) not null,
          productPrice SMALLINT not null,
          quantity TINYINT not null
        )`;
        let createCart = `create table if not exists cart(
            id int primary key auto_increment,
            user varchar(500) not null,
            productid varchar(100) not null,
            productImage varchar(200) not null,
            productName varchar(50) not null,
            productPrice SMALLINT not null,
            quantity TINYINT not null
        )`;
        let createProduct = `create table if not exists product(
          id int primary key auto_increment,
          productId varchar(50) unique not null,
          productName varchar(50) not null,
          productImg1 varchar(200) not null,
          productImg2 varchar(200) not null,
          productImg3 varchar(200) not null,
          productImg4 varchar(200) not null,
          productSize varchar(20) not null,
          productColor varchar(100) not null,
          productMaterial varchar(20) not null,
          productDesc varchar(200) not null,
          productPrice SMALLINT not null,
          productCheckout SMALLINT not null,
          productCategory varchar(20) not null,
          productBrand varchar(100) not null
        )`;
        let createProductStock = `create table if not exists stock(
          id int primary key auto_increment,
          productId varchar(50) not null,
          productSize varchar(50) not null,
          productSizeStock SMALLINT not null
        )`;
        connection.query(createGuest, function(err, results, fields) {
          if (err) {
            console.log(err.message);
          }
        });
        connection.query(createGuestCart, function(err, results, fields) {
            if (err) {
              console.log(err.message);
            }
          });
        connection.query(createProduct, function(err, results, fields) {
          if (err) {
            console.log(err.message);
          }
        });
        connection.query(createProductStock, function(err, results, fields) {
            if (err) {
              console.log(err.message);
            }
          });
        connection.query(createCart, function(err, results, fields) {
          if (err) {
            console.log(err.message);
          }
        });
        connection.query(createUsers, function(err, results, fields) {
          if (err) {
            console.log(err.message);
          }
        });
        connection.end(function(err) {
          if (err) {
            return console.log(err.message);
          }
        });
    });
}
  /*
   INSERT INTO product (productId, productName, productImg1, productImg2,productImg3,productImg4,
productSize,productColor,productMaterial,productDesc,productPrice,productCheckout,productCategory,
productBrand)
VALUES ('532462','CALIENTE TACO TUESDAY','/TestingImage/532462-1','/TestingImage/532462-1','',
'','multisize','Brown/Red','cotton',
'The Puma Caliente hoodie is the perfect addition to your Puma collection',
65.00,0,'MensApparel','PUMA');
*/

app.listen(8080,function(){
    console.log("Listing port 8080")
    mysqlInit() //this will create table if not yet inserted
})