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

function getDate(dayExtend) {
    let today = new Date();
    let date =
        today.getFullYear() +
        "-" +
        (today.getMonth() + 1) +
        "-" +
        (today.getDate() + dayExtend);
    return date;
}

function getCartNumber(table, cookie) {
    let sql = `SELECT * FROM ${table} where ${
        table === "cart" ? "user" : "ownercookievalue"
    } = '${cookie}'`;
    return new Promise((resolve, reject) => {
        connection.query(sql, (err, result) => {
            if (err) {
                console.log(err);
            }
            let sum = 0;
            for (let i in result) {
                sum += result[i].quantity;
            }
            resolve(sum);
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
    let today = getDate(0);
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
                    let sql = `INSERT INTO users (fullname, email, password,joineddate, hashedId) VALUES ('${name}', '${email}', '${hashedPassword}', '${today}', '${hashedId}')`;
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
            let today = getDate(3);
            let sql = `UPDATE USERS SET sessionExpires = '${today}' WHERE hashedId = '${id}'`;
            connection.query(sql, (err, res) => {
                if (err) {
                    console.log(err);
                }
            });

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
    let category = req.params.category;
    let sql = `SELECT a.productId, a.productBrand, a.productColor, a.productType, a.Gender, b.productSize, b.productSizeStock FROM products a JOIN stock b on a.productId = b.productId and productCategory ='${category}';`;
    connection.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        }
        res.json(result);
    });
});

app.get("/productDetails/:productId", (req, res) => {
    let productId = req.params.productId;
    let sql = `SELECT a.*, SUM(b.productSizeStock) AS totalStock FROM products a JOIN stock b on a.productId = b.productId and b.productId ='${productId}';`;
    connection.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        }
        res.json(result);
    });
});

app.get("/productSizes/:productId", (req, res) => {
    let productId = req.params.productId;
    let sql = `select productSize, productSizeStock from stock where productId = '${productId}';`;
    connection.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        }
        res.json(result);
    });
});

app.post("/add-guest", (req, res) => {
    let today = new Date();
    let date =
        today.getFullYear() +
        "-" +
        (today.getMonth() + 1) +
        "-" +
        today.getDate();
    let cookie = req.body.cookie;
    let sql = `INSERT INTO guest(cookievalue,joineddate) values('${cookie}','${date}');`;
    connection.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        }
    });
});

app.post("/add-to-gust-cart", (req, res) => {
    let { cookie, productDetails, size } = req.body;
    if (productDetails["stock"][size] <= 0) {
        res.json("Out of Stock");
    } else {
        //check if this product already exist
        connection.query(
            `SELECT * FROM guestcart where productId = "${productDetails.productId}" and ownercookievalue = "${cookie}" and productSize = '${size}';`,
            (err, result) => {
                if (err) {
                    console.log(err);
                }
                if (result.length) {
                    //if this product is already exists
                    let currentQuantity = result[0].quantity;
                    let updateSql = `update guestcart set quantity = ${
                        currentQuantity + 1
                    } where productId = "${
                        productDetails.productId
                    }" and ownercookievalue = "${cookie}" and productSize = '${size}';`;
                    connection.query(updateSql, (err, result) => {
                        if (err) {
                            console.log(err);
                        }
                        res.json("true");
                    });
                } else {
                    //insert
                    let sql = `INSERT INTO guestcart(ownercookievalue, productId, productImage, productName, productPrice, productSize, quantity) values('${cookie}', '${productDetails.productId}', '${productDetails.productImg1}', '${productDetails.productName}', ${productDetails.productPrice}, '${size}', 1 )`;
                    connection.query(sql, (err, result) => {
                        if (err) {
                            console.log(err);
                        }
                        res.json("true");
                    });
                }
            }
        );
    }
});

app.post("/add-to-user-cart", (req, res) => {
    let { id, productDetails, size } = req.body;
    if (productDetails["stock"][size] <= 0) {
        res.json("Out of Stock");
    } else {
        //check if this product already exist
        connection.query(
            `SELECT * FROM cart where productId = "${productDetails.productId}" and user = "${id}" and productSize = '${size}';`,
            (err, result) => {
                if (err) {
                    console.log(err);
                }
                if (result.length) {
                    //if this product is already exists
                    let currentQuantity = result[0].quantity;
                    let updateSql = `update cart set quantity = ${
                        currentQuantity + 1
                    } where productId = "${
                        productDetails.productId
                    }" and user = "${id}" and productSize = '${size}';`;
                    connection.query(updateSql, (err, result) => {
                        if (err) {
                            console.log(err);
                        }
                        res.json("true");
                    });
                } else {
                    //insert
                    let sql = `INSERT INTO cart(user, productId, productImage, productName, productPrice, productSize, quantity) values('${id}', '${productDetails.productId}', '${productDetails.productImg1}', '${productDetails.productName}', ${productDetails.productPrice}, '${size}', 1 )`;
                    connection.query(sql, (err, result) => {
                        if (err) {
                            console.log(err);
                        }
                        res.json("true");
                    });
                }
            }
        );
    }
});

app.post("/transfer-cart", (req, res) => {
    let { guestCookie, userId } = req.body;
    console.log(req.body);
    let success = true;
    connection.query(
        `SELECT * FROM GUESTCART WHERE OWNERCOOKIEVALUE='${guestCookie}'`,
        (err, res) => {
            if (err) {
                console.log(err);
            }
            for (let i in res) {
                let {
                    productid,
                    productSize,
                    quantity,
                    productImage,
                    productName,
                    productPrice,
                } = res[i];
                console.log(productid, userId);
                let checkQuery = `SELECT * FROM cart WHERE user = '${userId}' and productid = '${productid}' and productSize = '${productSize}';`;
                connection.query(checkQuery, (err, res) => {
                    if (err) {
                        console.log(err);
                        success = false;
                    }
                    let exeQuery = ``;
                    if (res.length > 0) {
                        exeQuery = `UPDATE CART SET quantity = ${
                            quantity + res[0]["quantity"]
                        } WHERE user = '${userId}' and productid = '${productid}' and productSize = '${productSize}';`;
                    } else {
                        exeQuery = `INSERT INTO CART(user, productId, productImage, productName, productPrice, productSize, quantity) VALUES('${userId}', '${productid}', '${productImage}', '${productName}', '${productPrice}', '${productSize}', '${quantity}')`;
                    }

                    connection.query(exeQuery, (err, res) => {
                        if (err) {
                            console.log(err);
                            success = false;
                        }
                    });
                });
            }
        }
    );
    let deleteGuestCart = `DELETE FROM GUESTCART WHERE ownercookievalue = '${guestCookie}';`;
    let deleteGuest = `DELETE FROM GUEST WHERE cookievalue = '${guestCookie}';`;

    let querys = [deleteGuest, deleteGuestCart];

    for (let i = 0; i < querys.length; i++) {
        connection.query(querys[i], (err, res) => {
            if (err) {
                console.log(err);
                success = false;
            }
        });
    }

    if (success) {
        res.json("true");
    }
});

app.post("/get-guest-cart-number", (req, res) => {
    getCartNumber("guestcart", req.body.cookie).then((result) => {
        res.json(result);
    });
});

app.post("/get-user-cart-number", (req, res) => {
    getCartNumber("cart", req.body.cookie).then((result) => {
        res.json(result);
    });
});

app.post("/get-user-cart-information", (req, res) => {
    const { userId, guest } = req.body;
    const table = `${guest === "true" ? "guestcart" : "cart"}`;
    const cookieColumn = `${guest === "true" ? "ownercookievalue" : "user"}`;
    let sql = `SELECT productid, productImage, productName, productPrice, quantity, productSize FROM ${table} WHERE ${cookieColumn} = '${userId}'`;
    connection.query(sql, (err, result) => {
        if (err) {
            console.log(err);
        }
        res.json(result);
    });
});

app.post("/update-cart", (req, res) => {
    const { userId, guest, updateOn, productId, productSize, quantity } =
        req.body;
    console.log(req.body);
    const table = `${guest === "true" ? "guestcart" : "cart"}`;
    const cookieColumn = `${guest === "true" ? "ownercookievalue" : "user"}`;
    if (updateOn === "remove") {
        let removeSql = `DELETE FROM ${table} WHERE ${cookieColumn} = '${userId}' and productId = '${productId}' and productSize = '${productSize}';`;
        connection.query(removeSql, (err, result) => {
            if (err) {
                console.log(err);
            }
            res.json(true);
        });
    } else if (updateOn === "increase") {
        let updateSql = `UPDATE ${table} SET quantity = ${quantity+1} WHERE ${cookieColumn} = '${userId}' and productId = '${productId}' and productSize = '${productSize}';`;
        connection.query(updateSql, (err, result) => {
            if (err) {
                console.log(err);
            }
            res.json(true);
        });
    }else {
        let updateSql = `UPDATE ${table} SET quantity = ${quantity-1} WHERE ${cookieColumn} = '${userId}' and productId = '${productId}' and productSize = '${productSize}';`;
        connection.query(updateSql, (err, result) => {
            if (err) {
                console.log(err);
            }
            res.json(true);
        });
    }

    // // updateOn will be increase decrease or remove.
});

//SELECT a.productId, a.productBrand, a.productColor, b.productSize FROM products a JOIN stock b on a.productId = b.productId and productCategory ='New';

app.listen(8080, function () {
    console.log("Listing port 8080");
    sqlInit.mysqlInit(connection); //this will create table if not yet inserted
});
