import Favorite from "../models/favorites.js";
import Product from "../models/products.js";

// Favorilere ekle
export const addToFavorites = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Ürün ID'si gerekli"
      });
    }

    // Ürünü bul
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Ürün bulunamadı"
      });
    }

    // Zaten favorilerde mi kontrol et
    const existingFavorite = await Favorite.findOne({
      user: userId,
      product: productId
    });

    if (existingFavorite) {
      return res.status(400).json({
        success: false,
        message: "Ürün zaten favorilerde"
      });
    }

    // Ürün verilerini sakla
    const productData = {
      _id: product._id.toString(),
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      satici: product.satici,
      image: product.image,
      url: product.url,
      final_price: product.final_price,
      original_price: product.original_price,
      createdAt: product.createdAt,
    };

    const favorite = await Favorite.create({
      user: userId,
      product: productId,
      productData: productData
    });

    res.status(201).json({
      success: true,
      message: "Ürün favorilere eklendi",
      data: favorite
    });

  } catch (error) {
    console.error("Favori ekleme hatası:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Favorilerden çıkar
export const removeFromFavorites = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const favorite = await Favorite.findOneAndDelete({
      user: userId,
      product: productId
    });

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: "Favori bulunamadı"
      });
    }

    res.status(200).json({
      success: true,
      message: "Ürün favorilerden çıkarıldı"
    });

  } catch (error) {
    console.error("Favori çıkarma hatası:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Kullanıcının tüm favorilerini getir
export const getUserFavorites = async (req, res) => {
  try {
    const userId = req.user._id;

    const favorites = await Favorite.find({ user: userId })
      .populate('product')
      .sort({ createdAt: -1 });

    // productData'yı kullanarak ürün bilgilerini döndür
    const favoritesData = favorites.map(fav => ({
      _id: fav.productData._id || fav.product?._id,
      id: fav.productData.id || fav.product?.id,
      name: fav.productData.name || fav.product?.name,
      brand: fav.productData.brand || fav.product?.brand,
      category: fav.productData.category || fav.product?.category,
      satici: fav.productData.satici || fav.product?.satici,
      image: fav.productData.image || fav.product?.image,
      url: fav.productData.url || fav.product?.url,
      final_price: fav.productData.final_price || fav.product?.final_price,
      original_price: fav.productData.original_price || fav.product?.original_price,
      createdAt: fav.productData.createdAt || fav.product?.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: favoritesData
    });

  } catch (error) {
    console.error("Favoriler getirme hatası:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Favori durumunu kontrol et (toggle)
export const toggleFavorite = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Ürün ID'si gerekli"
      });
    }

    // Ürünü bul
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Ürün bulunamadı"
      });
    }

    // Favori var mı kontrol et
    const existingFavorite = await Favorite.findOne({
      user: userId,
      product: productId
    });

    if (existingFavorite) {
      // Varsa sil
      await Favorite.findOneAndDelete({
        user: userId,
        product: productId
      });

      return res.status(200).json({
        success: true,
        message: "Ürün favorilerden çıkarıldı",
        isFavorite: false
      });
    } else {
      // Yoksa ekle
      const productData = {
        _id: product._id.toString(),
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        satici: product.satici,
        image: product.image,
        url: product.url,
        final_price: product.final_price,
        original_price: product.original_price,
        createdAt: product.createdAt,
      };

      await Favorite.create({
        user: userId,
        product: productId,
        productData: productData
      });

      return res.status(201).json({
        success: true,
        message: "Ürün favorilere eklendi",
        isFavorite: true
      });
    }

  } catch (error) {
    console.error("Favori toggle hatası:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Ürünün favori durumunu kontrol et
export const checkFavoriteStatus = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const favorite = await Favorite.findOne({
      user: userId,
      product: productId
    });

    res.status(200).json({
      success: true,
      isFavorite: !!favorite
    });

  } catch (error) {
    console.error("Favori durum kontrolü hatası:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

