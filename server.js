const express = require("express");
const bodyParser = require("body-parser"); //https://www.npmjs.com/package/body-parser
const bcrypt = require("bcrypt"); //https://www.npmjs.com/package/bcrypt
const escapeHtml = require("escape-html"); //https://www.npmjs.com/package/escape-html
const cors = require("cors"); //https://www.npmjs.com/package/cors
const mysql = require("mysql"); //https://www.npmjs.com/package/mysql
const app = express();
const sqlInit = require("./db.js");

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

//modify host, user, password, and database to yours.
var connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
});

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

function retrieveDataHome(table) {
    let sql = `SELECT a.*, SUM(b.productSizeStock) AS totalStock FROM products a JOIN stock b on a.productId = b.productId GROUP BY productId`;
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
    let id = req.params.id;
    let imageFile = req.params.image;
    res.sendFile(`public/productImages/${id}/${imageFile}`, {
        root: __dirname,
    });
});

app.post("/register", (req, res) => {
    let email = escapeHtml(req.body.email);
    let name = escapeHtml(req.body.name);
    let password = escapeHtml(req.body.password);
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
    let email = escapeHtml(req.body.email);
    let password = escapeHtml(req.body.password);
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

app.get("/productHome", (req, res) => {
    retrieveDataHome("products").then((result) => {
        let returnJson = {};
        for (let i = 0; i < result.length; i++) {
            let data = result[i];
            if (!returnJson[data.productCategory]) {
                returnJson[data.productCategory] = [];
            }
            let appendData = {};
            for (let j in data) {
                appendData[j] = data[j];
            }
            returnJson[data.productCategory].push(appendData);
        }
        res.json(returnJson);
    });
});

app.get("/fetch/:category", (req, res) => {
    let category = req.params.category;
    let sql = `SELECT a.*, SUM(b.productSizeStock) AS totalStock FROM products a JOIN stock b on a.productId = b.productId and productCategory ='${category}' GROUP BY productId;`;
    connection.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        }
        res.json(result);
    });
});

app.get("/filter/:category", (req, res) => {
    console.log(1);
    let category = req.params.category;
    let sql = `SELECT a.productId, a.productBrand, a.productColor, b.productSize FROM products a JOIN stock b on a.productId = b.productId and productCategory ='${category}';`;
    connection.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        }
        console.log(result);
        res.json(result);
    });
});

//SELECT a.productId, a.productBrand, a.productColor, b.productSize FROM products a JOIN stock b on a.productId = b.productId and productCategory ='New';

app.listen(8080, function () {
    console.log("Listing port 8080");
    sqlInit.mysqlInit(connection); //this will create table if not yet inserted
});
