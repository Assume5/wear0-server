const express = require("express");
const bodyParser = require("body-parser"); //https://www.npmjs.com/package/body-parser
const bcrypt = require("bcrypt"); //https://www.npmjs.com/package/bcrypt
const escapeHtml = require("escape-html"); //https://www.npmjs.com/package/escape-html
const cors = require("cors"); //https://www.npmjs.com/package/cors
const mysql = require("mysql"); //https://www.npmjs.com/package/mysql
const app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(__dirname + "/public"));

const saltRounds = 15;
const salt = bcrypt.genSaltSync(saltRounds);

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

function mysqlInit() {
    //modify host, user, password, and database to yours.
    connection = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "root",
        database: "wear0",
    });
    let createGuest = `create table if not exists guest(
            id int primary key auto_increment,
            cookievalue varchar(500) unique not null,
            joineddate varchar(100) not null
        )`;
    let createUsers = `create table if not exists users(
          id int primary key auto_increment,
          email varchar(100) unique not null,
          fullname varchar(100),
          first varchar(100),
          last varchar(100),
          phone varchar(100),
          address1 varchar(100),
          address2 varchar(100) ,
          city varchar(100),
          state varchar(100),
          zip varchar(100),
          password varchar(200) not null,
          joineddate varchar(100) not null,
          hashedId varchar(500) not null
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
          productImg1 varchar(200),
          productImg2 varchar(200),
          productImg3 varchar(200),
          productImg4 varchar(200),
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
    let query = [
        createGuest,
        createUsers,
        createGuestCart,
        createCart,
        createProduct,
        createProductStock,
    ];
    for (let i = 0; i < query.length; i++) {
        connection.query(query[i], function (err, results, fields) {
            if (err) {
                console.log(err.message);
            }
        });
    }
}
/*
   INSERT INTO product (productId, productName, productImg1, productImg2,productImg3,productImg4,
productSize,productColor,productMaterial,productDesc,productPrice,productCheckout,productCategory,
productBrand)
VALUES ('1-45','Kaws Brown','','/TestingImage/532462-1','',
'','multisize','Brown','Vinyl',
'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Etiam sit amet nisl purus. Bibendum enim facilisis gravida neque convallis a. Faucibus nisl tincidunt eget nullam non nisi est sit. Sem fringilla ut morbi tincidunt.',
99.99,0,'Accessories','KAWS');
*/

function checkIfExists(table, col, value) {
    let sql = `SELECT * FROM ${table} WHERE ${col} = '${value}'`;
    var exists = false;
    return new Promise((resolve, reject) => {
        connection.query(sql, (err, result) => {
            if (err) {
                console.log(err);
            }
            exists = result.length > 0;
            resolve(exists);
        });
    });
}

function encryptValue(value) {
    return bcrypt.hashSync(value, salt);
}

function compareEncryptValue(plainText, hashedText) {
    return bcrypt.compareSync(plainText, hashedText);
}

function handleLogin(email) {
    let sql = `SELECT * FROM users WHERE email = '${email}'`;
    console.log(sql);
    return new Promise((resolve, reject) => {
        connection.query(sql, (err, result) => {
            if (err) {
                console.log(err);
            }
            resolve(result);
        });
    });
}

app.get("/", (req, res) => {
    res.send("WEAR0 Server");
});

app.get("/public/productImages/:id/:image", (req, res) => {
    let id = req.params.id
    let imageFile = req.params.image
    res.sendFile(`public/productImages/${id}/${imageFile}` , { root : __dirname});
});

app.post("/register", (req, res) => {
    let email = req.body.email;
    let name = req.body.name;
    let password = req.body.password;
    let today = new Date();
    let date =
        today.getFullYear() +
        "/" +
        (today.getMonth() + 1) +
        "/" +
        today.getDate();
    // var d1 = new Date(2013, 0, 1);
    // var d2 = new Date(2013, 0, 2);
    // d1 <  d2; // true
    // d1 <= d2; // true
    // d1 >  d2; // false
    // d1 >= d2; // false
    checkIfExists("users", "email", email)
        .then((result) => {
            let check = result;

            if (!check) {
                let hashedId;
                let hashedPassword = encryptValue(password);
                let lastId = "SELECT id FROM users ORDER BY id DESC LIMIT 1";
                connection.query(lastId, (err, result) => {
                    if (err) {
                        console.log(err);
                    }
                    if (result.length === 0) {
                        let id = 1;
                        hashedId = encryptValue(id.toString());
                    } else {
                        hashedId = encryptValue(result[0].id.toString());
                    }
                    let sql = `INSERT INTO users (fullname, email, password,joineddate, hashedId) VALUES ('${name}', '${email}', '${hashedPassword}', '${date}', '${hashedId}')`;
                    connection.query(sql, (err, result) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                });

                res.json(true);
            } else if (check) res.json("Email has been registered");
        })
        .catch((err) => {
            throw err;
        });
});

app.post("/login", (req, res) => {
    let email = req.body.email;
    let password = req.body.password;
    handleLogin(email).then((result) => {
        let success = false;
        if (result.length) {
            success = compareEncryptValue(password, result[0].password);
        }
        if (success) {
            let fullName = result[0].fullname;
            let id = result[0].hashedId;
            res.json({
                success: true,
                fullname: fullName,
                id: id,
            });
        } else {
            res.json("Email or Password incorrect");
        }
    });
});

app.listen(8080, function () {
    console.log("Listing port 8080");
    mysqlInit(); //this will create table if not yet inserted
});
