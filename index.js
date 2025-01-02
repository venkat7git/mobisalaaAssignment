require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const axios = require('axios');
const jwt = require('jsonwebtoken')

const app = express();
app.use(bodyParser.json());

mongoose.connect('mongodb://127.0.0.1:27017/ecommerce', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Importing models
const User = require('./models/User');
const Product = require('./models/Product');
const Cart = require('./models/Cart');
const Order = require('./models/Order');

// Configuration for Cashfree
const cashfreeAuth = {
    appId: process.env.APP_ID,
    secretKey: process.env.SECRET_KEY,
    isProd: false // Set to true in production
};

// Adding a user with password hashing
app.post('/user', async (req, res) => {
    try {
        const { name, email, password,phone } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            id: uuidv4(),
            name,
            email,
            password: hashedPassword,
            phone
        });

        await user.save();
        res.status(201).send(user);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// User login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).send({ error: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).send({ error: 'Invalid password' });
        }
        const token = jwt.sign({email,password},"demo key",{expiresIn:'1h'})
        res.send({ message: 'Login successful' ,token});
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Get all users
app.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.send(users);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.delete('/users', async (req, res) => {
    try {
        await User.deleteMany({});
        res.send({ message: 'All users have been deleted' });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});


// Add an order
app.post('/order', async (req, res) => {
    try {
        const { userId, cartId, status, totalAmount, paymentReference } = req.body;

        const order = new Order({
            id: uuidv4(),
            userId,
            cartId,
            status,
            totalAmount,
            paymentReference
        });

        await order.save();
        res.status(201).send(order);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Get all orders
app.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find();
        res.send(orders);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Adding items to the cart
app.post('/cart', async (req, res) => {
    try {
        const { userId, productId, quantity,amount } = req.body;

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = new Cart({ id: uuidv4(), userId, products: [] });
        }

        const productIndex = cart.products.findIndex(p => p.productId === productId);
        if (productIndex > -1) {
            cart.products[productIndex].quantity += quantity;
        } else {
            cart.products.push({ productId, quantity ,amount});
        }

        await cart.save();
        res.send(cart);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Get all cart items
app.get('/carts', async (req, res) => {
    try {
        const carts = await Cart.find().populate('products.productId');
        res.send(carts);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Get a specific user's cart
app.get('/cart/:userId', async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.params.userId }).populate('products.productId');
        if (cart) {
            res.send(cart);
        } else {
            res.status(404).send({ error: 'Cart not found for the given userId' });
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Remove an item from the cart
app.delete('/cart/:userId/:productId', async (req, res) => {
    try {
        const { userId, productId } = req.params;

        let cart = await Cart.findOne({ userId });

        cart.products = cart.products.filter(p => p.productId !== productId);
        await cart.save();
        res.send(cart);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});


app.delete('/carts', async (req, res) => {
    try {
        await Cart.deleteMany({});
        res.send({ message: 'All carts have been deleted' });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});


// Initiate a payment
app.post('/initiate-payment', async (req, res) => {
    try {
        const { userId, orderId } = req.body;

        // Fetch user details using userId
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).send({ error: 'User not found for the given userId' });
        }

        // Fetch cart details using userId
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).send({ error: 'Cart not found for the given userId' });
        }
        let total_amount = 0
        cart.products.forEach(element => {
            total_amount += element.amount * element.quantity
        })

        

        const cart_details = {
            shipping_charge: 0, // Add logic to calculate shipping charge if applicable
            cart_name: 'User Cart',
            cart_items: cart.products.map(product => ({
                item_id: product.productId,
                item_name: product.productId, // Replace with actual product name
                item_description: product.productId, // Replace with actual product description
                item_tags: [], // Add logic to fetch item tags if applicable
                item_original_unit_price: product.amount,
                item_quantity: product.quantity
            }))
        };
    

        const options = {
            method: 'POST',
            url: cashfreeAuth.isProd
                ? 'https://api.cashfree.com/api/v2/order/create'
                : 'https://sandbox.cashfree.com/pg/orders',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'x-api-version': '2023-08-01',
                'x-client-id': cashfreeAuth.appId,
                'x-client-secret': cashfreeAuth.secretKey
            },
            data: {
             
                customer_details: {
                customer_id: userId,
                customer_email: user.email,
                customer_phone: user.phone,
                customer_name: user.name
                },
                order_id: orderId,
                order_amount: total_amount,
                order_currency: "INR"
            }
            //   {
            //     cart_details: cart_details,
            //     customer_details: {
            //         customer_id: userId,
            //         customer_email: user.email, // Updated with fetched user email
            //         customer_phone: user.phone, // Updated with fetched user phone
            //         customer_name: user.name, // Updated with fetched user name
            //         customer_uid: userId
            //     },
            //     order_id: orderId,
            //     order_amount: total_amount,
            //     order_currency: "INR"
            // }
        };

        const response = await axios.request(options);
        res.send(response.data);
        if(response){
            await Order.updateOne({userId},{$set:{status:"completed"}})
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});


// Handle payment webhooks
app.post('/payment-webhook', async (req, res) => {
    try {
        const { orderId, txStatus, txMsg } = req.body;

        if (txStatus === 'SUCCESS') {
            // Payment successful
            await Order.updateOne({ id: orderId }, { status: 'PAID' });
        } else {
            // Payment failed
            await Order.updateOne({ id: orderId }, { status: 'FAILED' });
        }

        res.send({ message: 'Webhook received' });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Check payment status
app.get('/payment-status', async (req, res) => {
    const { orderId } = req.body;

    const order = await Order.findOne({ id: orderId });
    if (!order) {
        return res.status(404).send({ error: 'Order not found' });
    }

    res.send({ status: order.status });
});

// Starting the server
const port = process.env.APP_PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
