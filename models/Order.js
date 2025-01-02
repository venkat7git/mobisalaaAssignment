const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const OrderSchema = new mongoose.Schema({
    id: { type: String, default: uuidv4 },
    userId: String,
    cartId: String,
    status: String,
    totalAmount: Number,
    paymentReference: String,
});

module.exports = mongoose.model('Order', OrderSchema);
