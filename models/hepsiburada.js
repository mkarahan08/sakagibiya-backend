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
        type: String,
        required: true
    },
    final_price: {
        type: String,
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
},   
{timestamps: true}
);    

const Product = mongoose.model('Product', productSchema ,'hepsiburada');

 export default Product;
