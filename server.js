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

function checkProductStock(productsDetail) {
    return new Promise((resolve, reject) => {
        let resArray = [];
        let allItemAvailable = true;
        let productNotAvailable = "";
        let productNotAvailableSize;
        for (let i in productsDetail) {
            let product = productsDetail[i];
            const {
                productid,
                productImage,
                productName,
                productPrice,
                quantity,
                productSize,
            } = product;

            connection.query(
                `SELECT productId, productSizeStock, productSize from stock where productId = '${productid}' and productSize = '${productSize}'`,
                (err, result) => {
                    if (err) console.log(err);
                    const stock = result[0].productSizeStock;
                    const newStock = stock - quantity;
                    if (newStock < 0) {
                        productNotAvailable = result[0].productId;
                        productNotAvailableSize = result[0].productSize;
                        allItemAvailable = false;
                    }
                    resArray.push({
                        productId: result[0].productId,
                        productSizeStock: result[0].productSizeStock,
                    });
                }
            );
        }
        const checkComplete = setInterval(() => {
            if (resArray.length === productsDetail.length) {
                clearInterval(checkComplete);
                if (allItemAvailable) {
                    resolve(allItemAvailable);
                } else {
                    resolve([productNotAvailable, productNotAvailableSize]);
                }
            }
        }, 100);
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

app.put("/update-cart", (req, res) => {
    const { userId, guest, updateOn, productId, productSize, quantity } =
        req.body;
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
        let updateSql = `UPDATE ${table} SET quantity = ${
            quantity + 1
        } WHERE ${cookieColumn} = '${userId}' and productId = '${productId}' and productSize = '${productSize}';`;
        connection.query(updateSql, (err, result) => {
            if (err) {
                console.log(err);
            }
            res.json(true);
        });
    } else {
        let updateSql = `UPDATE ${table} SET quantity = ${
            quantity - 1
        } WHERE ${cookieColumn} = '${userId}' and productId = '${productId}' and productSize = '${productSize}';`;
        connection.query(updateSql, (err, result) => {
            if (err) {
                console.log(err);
            }
            res.json(true);
        });
    }
});

app.post("/checkout", (req, res) => {
    let checkStock = true;
    const {
        shippingAddress,
        billingAddress,
        productsDetail,
        totalPrice,
        userId,
        paymentInfo,
        remember,
        guestId,
    } = req.body;
    const orderId = Math.random().toString(16).slice(2).toUpperCase();
    const email = shippingAddress.email;
    const cardHolder = `${billingAddress.firstnameBilling} ${billingAddress.lastnameBilling}`;
    const cardHolderFirst = billingAddress.firstnameBilling;
    const cardHolderlast = billingAddress.lastnameBilling;
    const phone = shippingAddress.phone;
    const cardNumber = paymentInfo.cn;
    const expiry = paymentInfo.ed;
    const shippingName = `${shippingAddress.firstname} ${shippingAddress.lastname}`;
    const shippingFirst = shippingAddress.firstname;
    const shippingLast = shippingAddress.lastname;
    const shippingAddress1 = shippingAddress.address;
    const shippingAddress2 = shippingAddress.apartment;
    const shippingCity = shippingAddress.city;
    const shippingState = shippingAddress.state;
    const shippingZip = shippingAddress.zip;
    const billingAddress1 = billingAddress.addressBilling;
    const billingCity = billingAddress.cityBilling;
    const billingState = billingAddress.stateBilling;
    const billingZip = billingAddress.zipBilling;
    const today = getDate(0);

    checkProductStock(productsDetail).then((stocks) => {
        if (stocks === true) {
            const orderSql = `INSERT INTO ORDERS VALUES('${orderId}','${userId}','${email}','${cardHolder}','${cardHolderFirst}','${cardHolderlast}','${phone}','${cardNumber}','${shippingName}','${shippingFirst}','${shippingLast}','${shippingAddress1}','${shippingAddress2}','${shippingCity}','${shippingState}','${shippingZip}','${billingAddress1}','${billingCity}','${billingState}','${billingZip}','${today}',
            NULL, 'Pending', ${totalPrice})`;
            connection.query(orderSql, (err, result) => {
                if (err) {
                    console.log(err);
                }
            });

            for (let i in productsDetail) {
                let product = productsDetail[i];
                const {
                    productid,
                    productImage,
                    productName,
                    productPrice,
                    quantity,
                    productSize,
                } = product;
                const detailSql = `INSERT INTO orderdetails VALUES('${orderId}','${productid}','${productImage}','${productName}','${productPrice}','${productSize}','${quantity}')`;
                connection.query(detailSql, (err, result) => {
                    if (err) {
                        console.log(err);
                    }
                });

                //minus stock

                connection.query(
                    `SELECT productSizeStock from stock where productId = '${productid}' and productSize = '${productSize}'`,
                    (err, result) => {
                        if (err) console.log(err);
                        const stock = result[0].productSizeStock;
                        const newStock = stock - quantity;
                        const updateQuery = `update stock set productSizeStock = ${newStock} where productId = '${productid}' and productSize = '${productSize}'`;
                        connection.query(updateQuery, (err, result) => {
                            if (err) console.log(err);
                        });
                    }
                );
            }

            if (remember) {
                const updateSql = `UPDATE USERS SET first = '${shippingAddress.firstname}', last = '${shippingAddress.lastname}', address1 = '${shippingAddress1}',
        address2 = '${shippingAddress2}', city = '${shippingCity}', state = '${shippingState}', zip = '${shippingZip}', phone = ${phone}`;
                connection.query(updateSql, (err, result) => {
                    if (err) {
                        console.log(err);
                    }
                });
            }
            //clear usercart
            if (guestId === "None" && userId !== "None") {
                //clear userCart
                let sql = `DELETE FROM CART WHERE user = '${userId}'`;
                connection.query(sql, (err, result) => {
                    if (err) {
                        console.log(err);
                    }
                });
            }

            if (guestId !== "None" && userId === "None") {
                //clear guestCart
                let sql = `DELETE FROM guestcart WHERE ownercookievalue = '${guestId}'`;
                connection.query(sql, (err, result) => {
                    if (err) {
                        console.log(err);
                    }
                });
            }
            res.json([orderId, "true"]);
        } else {
            // remove
            let productId = stocks[0];
            let productSize = stocks[1];
            //clear usercart
            if (guestId === "None" && userId !== "None") {
                //clear userCart
                let sql = `DELETE FROM CART WHERE user = '${userId}' and productid = '${productId}' and productSize = '${productSize}'`;
                connection.query(sql, (err, result) => {
                    if (err) {
                        console.log(err);
                    }
                });
            }

            if (guestId !== "None" && userId === "None") {
                //clear guestCart
                let sql = `DELETE FROM guestcart WHERE ownercookievalue = '${guestId}' and productid = '${productId}' and productSize = '${productSize}'`;
                connection.query(sql, (err, result) => {
                    if (err) {
                        console.log(err);
                    }
                });
            }
            res.json([productId, "false"]);
        }
    });
});

app.post("/get-user-order", (req, res) => {
    const userId = req.body.userId;
    if (userId !== "") {
        let sql = `SELECT email from users where hashedId = '${userId}'`;
        connection.query(sql, (err, result) => {
            if (err) {
                console.log(err);
            }
            const email = result[0].email;
            let sql = `SELECT orderId, DATE_FORMAT(orderDate, '%m/%d/%Y') as orderDate, orderStatus, totalPrice from orders where userId = '${userId}' or email = '${email}' order by orderDate DESC`;
            connection.query(sql, (err, result) => {
                if (err) console.log(err);
                res.json(result);
            });
        });
    }
});

app.post("/get-user-detail", (req, res) => {
    const userId = req.body.userId;
    if (userId !== "") {
        let sql = `SELECT first, last, phone, address1, address2, city, state, zip from users where hashedId = '${userId}'`;
        connection.query(sql, (err, result) => {
            if (err) console.log(err);
            res.json(result);
        });
    }
});

app.post("/autofill-checkout", (req, res) => {
    const userId = req.body.userId;
    if (userId !== "") {
        let sql = `SELECT email, first as firstname, last as lastname, phone, address1 as address, address2 as apartment, city, state, zip from users where hashedId = '${userId}'`;
        connection.query(sql, (err, result) => {
            if (err) console.log(err);
            res.json(result);
        });
    }
});

app.post("/update-user-detail", (req, res) => {
    const { userId, inputData } = req.body;
    if (userId !== "") {
        let sql = `UPDATE users set first = '${inputData.first}', last = '${inputData.last}', phone = '${inputData.phone}', address1 = '${inputData.address1}', address2 = '${inputData.address2}', city = '${inputData.city}', state = '${inputData.state}', zip = '${inputData.zip}' where hashedId = '${userId}'`;
        connection.query(sql, (err, result) => {
            if (err) console.log(err);
            res.json(true);
        });
    }
});

app.post("/check-order-exist", (req, res) => {
    const { email, orderId } = req.body;
    const sql = `SELECT * FROM ORDERS WHERE orderId = '${orderId}' and email = '${email}'`;
    connection.query(sql, (err, result) => {
        if (err) console.log(err);
        if (result.length > 0) {
            res.json("success");
        } else {
            res.json(
                "We Can't Find Your Order, Please Double Check Your Order Number or Email"
            );
        }
    });
});

app.get("/orders/:orderNumber", (req, res) => {
    const orderNumber = req.params.orderNumber;
    const sql = `select email, cardHolder, shippingName, phone, shippingAddress1, shippingAddress2, shippingCity, shippingState, shippingZip, billingAddress1, billingCity, billingState, billingZip, trackingNumber, orderStatus, totalPrice from orders where orderId = '${orderNumber}';`;
    connection.query(sql, (err, result) => {
        if (err) console.log(err);
        res.json(result);
    });
});

app.get("/get-last-four/:orderNumber", (req, res) => {
    const orderNumber = req.params.orderNumber;
    let sql = `select cardNumber from orders where orderId = '${orderNumber}'`;
    connection.query(sql, (err, result) => {
        if (err) console.log(err);
        res.json(result[0].cardNumber.substr(16 - 4));
    });
});

app.get("/order-details/:orderNumber", (req, res) => {
    const orderNumber = req.params.orderNumber;
    let sql = `select productid, productImage, productName, productPrice, productSize, quantity from orderdetails where orderId = '${orderNumber}';`;
    connection.query(sql, (err, result) => {
        if (err) console.log(err);
        res.json(result);
    });
});

app.listen(8080, function () {
    console.log("Listing port 8080");
    sqlInit.mysqlInit(connection); //this will create table if not yet inserted
});
