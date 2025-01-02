const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const CartSchema = new mongoose.Schema({
    id: { type: String, default: uuidv4 },
    userId: String,
    products: [{
        productId: String,
        quantity: Number,
        amount: Number // Added amount field
    }],
});

module.exports = mongoose.model('Cart', CartSchema);
