import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
    id: {
        type: String,
        required: false
    },
    name: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: true
    },
    original_price: {
        type: Number,
        required: true
    },
    final_price: {
        type: Number,
        required: false
    },
    image: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    satici: {
        type: String,
        required: true
    },
    discount: {
        type: Number,
        required: false
    },
    last_updated: {
        type: Date,
        required: false
    },
    price_history: [{
        price: { type: Number, required: false },
        date: { type: Date, required: false }
    }],
    is_active: {
        type: Boolean,
        required: false
    },
    platform: {
        type: String,
        required: true
    },
    
},   
{timestamps: true}
);    

const Product = mongoose.model('Product', productSchema ,'products');

 export default Product;
