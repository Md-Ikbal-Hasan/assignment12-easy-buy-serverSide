const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { query } = require('express');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.b4ceuhb.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// verify jwt token....................
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "forbidden access" })
        }
        req.decoded = decoded;
        next();
    })
}



async function run() {

    try {
        // collections................
        const usersCollection = client.db('easyBuy').collection('users');
        const categoriesCollection = client.db('easyBuy').collection('categories');
        const productsCollection = client.db('easyBuy').collection('products');
        const bookingProductsCollection = client.db('easyBuy').collection('bookingProducts');
        const paymentsCollection = client.db('easyBuy').collection('payments');


        // verify admin. make sure use verifyAdmin after verifyJWT
        const verifyAdmin = async (req, res, next) => {
            const decodedemail = req.decoded.email;
            const query = { email: decodedemail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // verify seller. make sure use verifySeller after verifyJWT
        const verifySeller = async (req, res, next) => {
            const decodedemail = req.decoded.email;
            const query = { email: decodedemail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'seller') {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }


        // send jwt        
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '7d' });
                return res.send({ accessToken: token })
            }
            console.log("user in jwt api: ", user);
            console.log("jwt called for token...............");
            res.status(403).send({ accessToken: '' })
        })



        // create user and save to the database............
        app.post('/users', async (req, res) => {
            const user = req.body;

            const email = user.email;
            const query = { email: email };
            const registerdUser = await usersCollection.findOne(query);
            console.log("reg", registerdUser);

            if (!registerdUser) {
                const result = await usersCollection.insertOne(user);
                res.send(result);
            }

        })

        // delete a user from database............
        app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        // get a specific user(single user) by id from user collection
        app.get('/users/:email', async (req, res) => {
            const userEmail = req.params.email;
            const query = { email: userEmail };
            const result = await usersCollection.findOne(query);
            res.send(result);
        })



        // get seller. Find out someone is seller or not .....................
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' })
        })

        // get admin. find out someone is admin or not ..............
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' })
        })

        //get all sellers
        app.get('/allseller', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { role: 'seller' };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })


        //get all sellers
        app.get('/allbuyer', verifyJWT, verifyAdmin, async (req, res) => {
            const query = { role: 'buyer' };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        // verify seller. akjon seller k verify korte parbe admin. ...........
        app.put('/verifyseller/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    verified: true
                }
            }
            const result = await usersCollection.updateOne(query, updatedDoc, options);
            res.send(result);

        })

        // get category..............
        app.get('/categories', async (req, res) => {
            const query = {};
            const result = await categoriesCollection.find(query).toArray();
            res.send(result);
        })

        // get specific categories product............
        app.get('/categories/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category: id, paid: false, booked: false };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        })



        // post/add a  products...................
        app.post('/addproduct', verifyJWT, verifySeller, async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        })


        // delete a product
        app.delete('/products/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        })




        // get all the products of a specific user.............
        app.get('/products/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { sellerEmail: email };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        })


        // get all the unsold advertised product...............
        app.get('/advertisedProduct', async (req, res) => {
            const query = { advertise: true, paid: false, booked: false };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        })


        // advertise a product...............
        app.put('/products/advertise/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    advertise: true
                }
            }

            const result = await productsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })


        // booking products
        app.post('/bookingProduct', verifyJWT, async (req, res) => {
            const bookingInfo = req.body;
            const id = bookingInfo.productId;

            // added booking info  to the database
            const result = await bookingProductsCollection.insertOne(bookingInfo);

            // updated the booked status to true at productsCollection
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    booked: true
                }
            }
            const updatedResult = await productsCollection.updateOne(filter, updatedDoc);

            res.send(result);
        })


        // ##########################################################################
        // delete a bookingProduct which are not paid yet and set booked : false in product collection
        app.delete('/bookingProduct/:id/:productId', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await bookingProductsCollection.deleteOne(query);

            const productId = req.params.productId;
            const filter = { _id: ObjectId(productId) }
            const updatedDoc = {
                $set: {
                    booked: false
                }
            }
            const updatedResult = await productsCollection.updateOne(filter, updatedDoc)

            res.send(result);

        })


        // get all the booking product of a specifi user/buyer.............
        app.get('/bookingProduct/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { buyerEmail: email };
            const result = await bookingProductsCollection.find(query).toArray();
            res.send(result);
        })



        app.get('/singleBookingProduct/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await bookingProductsCollection.findOne(query);
            res.send(result);
        })

        // payment intent..............
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const booking = req.body;
            const productPrice = booking.productPrice;
            const amount = parseInt(productPrice) * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            })

            res.send({
                clientSecret: paymentIntent.client_secret,
            });

        })

        // store payment information..............
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);

            // updated bookingProduct-collection object which is paid
            const bookingProductId = payment.bookingProductId;
            const filterForBookingProduct = { _id: ObjectId(bookingProductId) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResultOfBookingProduct = await bookingProductsCollection.updateOne(filterForBookingProduct, updatedDoc);


            // updated productcollection object which is paid
            const productId = payment.productId;
            const filterForProductsCollection = { _id: ObjectId(productId) };
            const updatedDoc2 = {
                $set: {
                    paid: true,
                }
            }
            const updatedResultOfProductCollection = await productsCollection.updateOne(filterForProductsCollection, updatedDoc2);




            res.send(result);
        })















    }





    finally {

    }
}

run().catch(error => console.log(error));



app.get('/', (req, res) => {
    const postedDate = new Date();
    console.log(postedDate);
    res.send("Api working......")
})

app.listen(port, () => {
    console.log(`Easy Buy server is running on port ${port}`);
})