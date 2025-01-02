const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ProductSchema = new mongoose.Schema({
    id: { type: String, default: uuidv4 },
    name: String,
    price: Number,
    stock: Number,
});

module.exports = mongoose.model('Product', ProductSchema);
