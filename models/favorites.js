import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productData: {
    // Ürün verilerini burada saklayalım (ürün silinse bile favorilerde kalsın)
    _id: String,
    id: String,
    name: String,
    brand: String,
    category: String,
    satici: String,
    image: String,
    url: String,
    final_price: String,
    original_price: String,
    createdAt: Date,
  }
}, {
  timestamps: true,
});

// Kullanıcı ve ürün kombinasyonu benzersiz olsun
favoriteSchema.index({ user: 1, product: 1 }, { unique: true });

const Favorite = mongoose.model("Favorite", favoriteSchema);

export default Favorite;

