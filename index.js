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


        // send jwt        
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '7d' });
                return res.send({ accessToken: token })
            }
            console.log(user);
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

        // get seller .....................
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' })
        })

        // get admin..............
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' })
        })

        // get category..............
        app.get('/categories', async (req, res) => {
            const query = {};
            const result = await categoriesCollection.find(query).toArray();
            res.send(result);
        })

        // get specific categories product
        app.get('/categories/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category: id };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        })


        // post/add a  products...................
        app.post('/addproduct', async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        })




        // get all the products of a specific user.............
        app.get('/products/:email', async (req, res) => {
            const email = req.params.email;
            const query = { sellerEmail: email };
            const result = await productsCollection.find(query).toArray();
            res.send(result);
        })


        // get all the unsold advertised product...............
        app.get('/advertisedProduct', async (req, res) => {
            const query = { advertise: true, paid: false };
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