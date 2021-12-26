function mysqlInit(connection) {
    let createDatabase = `CREATE DATABASE IF NOT EXISTS wear0;`;
    let removeSafeUpdates = "SET SQL_SAFE_UPDATES = 0;";
    let useDB = `USE wear0;`;
    let createGuest = `create table if not exists guest(
            id int primary key auto_increment,
            cookievalue varchar(500) unique not null,
            joineddate date not null
        )`;
    let createOrders = `create table if not exists orders(
        orderId varchar(100) primary key,
        userId varchar(100),
        email varchar(100) not null,
        cardHolder varchar(200) not null,
        cardHolderFirst varchar(100) not null,
        cardHolderLast varchar(100) not null,
        phone varchar(100) not null,
        cardNumber varchar(100) not null,
        shippingName varchar(200) not null,
        shippingFirst varchar(100) not null,
        shippingLast varchar(100) not null,
        shippingAddress1 varchar(100) not null,
        shippingAddress2 varchar(100) ,
        shippingCity varchar(100) not null,
        shippingState varchar(100) not null,
        shippingZip varchar(100) not null,
        billingAddress1 varchar(100) not null,
        billingCity varchar(100) not null,
        billingState varchar(100) not null,
        billingZip varchar(100) not null,
        orderDate date not null not null,
        trackingNumber varchar(100),
        orderStatus varchar(100),
        totalPrice DOUBLE(10,2) not null
    )`;
    let createOrdersDetails = `
        create table if not exists orderDetails(
        orderId varchar(100),
        productid varchar(100) not null,
        productImage varchar(200) not null,
        productName varchar(50) not null,
        productPrice DOUBLE(10,2) not null,
        productSize varchar(50) not null,
        quantity TINYINT not null
    )
    `;
    let createUsersPayment = `
        create table if not exists UsersPayment(
        userId varchar(100) primary key,
        cardNo varchar(100) not null,
        expiry date not null,
        provider varchar(100) not null,
        type varchar(100) not null
    )
    `;
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
          joineddate date not null,
          hashedId varchar(500) not null,
          sessionExpires date
      )`;
    let createGuestCart = `create table if not exists guestcart(
          id int primary key auto_increment,
          ownercookievalue varchar(500) not null,
          productid varchar(100) not null,
          productImage varchar(200) not null,
          productName varchar(50) not null,
          productPrice DOUBLE(10,2) not null,
          productSize varchar(50) not null,
          quantity TINYINT not null
        )`;
    let createCart = `create table if not exists cart(
            id int primary key auto_increment,
            user varchar(500) not null,
            productid varchar(100) not null,
            productImage varchar(200) not null,
            productName varchar(50) not null,
            productPrice DOUBLE(10,2) not null,
            productSize varchar(50) not null,
            quantity TINYINT not null
        )`;
    let createProduct = `create table if not exists products(
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
          productDesc Text not null,
          productPrice DOUBLE(10,2) not null,
          productCheckout SMALLINT not null,
          productCategory varchar(20) not null,
          productBrand varchar(100) not null,
          productType varchar(100) not null,
          Gender varchar(100) not null
        )`;
    let createProductStock = `create table if not exists stock(
          id int primary key auto_increment,
          productId varchar(50) not null,
          productSize varchar(50) not null,
          productSizeStock SMALLINT not null
        )`;
    let query = [
        createDatabase,
        useDB,
        createGuest,
        createUsers,
        createGuestCart,
        createCart,
        createProduct,
        createProductStock,
        removeSafeUpdates,
        createOrders,
        createOrdersDetails,
        createUsersPayment,
    ];
    for (let i = 0; i < query.length; i++) {
        connection.query(query[i], function (err, results, fields) {
            if (err) {
                console.log(err.message);
            }
        });
    }
}

module.exports = { mysqlInit };
