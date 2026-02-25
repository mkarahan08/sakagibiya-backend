import Product from '../models/hepsiburada.js';

export const getAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const category = req.query.category; // Kategori filtresi

        // Kategori filtresi varsa ekle
        const query = {};
        if (category && category.trim() !== '') {
            const categoryName = category.trim();
            // Eğer "Moda" kategorisi seçildiyse, hem "Erkek Moda" hem "Kadın Moda" ürünlerini getir
            if (categoryName === 'Moda') {
                query.category = { $in: ['Erkek Moda', 'Kadin Moda'] };
            } else {
                query.category = categoryName;
            }
        }

        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / limit);

        let products;

        if (Object.keys(query).length === 0) {
            // Ana sayfa (kategori seçili değil): tüm kategorilerden rastgele karışık getir
            // $sample her seferinde farklı rastgele ürünler döndürür → infinite scroll'da yeni ürünler gelir
            products = await Product.aggregate([
                { $sample: { size: limit } }
            ]);
        } else {
            // Kategori seçiliyse: klasik sayfalama
            products = await Product.find(query)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 });
        }

        res.status(200).json({
            products,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: total,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}


export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        res.status(200).json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

export const createProduct = async (req, res) => {
    try {
        const product = await Product.create(req.body);
        res.status(200).json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

export const updateProduct = async (req,res) => {
    try {
        const {id} = req.params;
        const product = await Product.findByIdAndUpdate(id, req.body, { new: true });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

export const deleteProduct = async (req,res) => {
    try {
        const {id} = req.params;
        const product = await Product.findByIdAndDelete(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

// 🔍 Ürün arama fonksiyonu (Server-side search)
export const searchProducts = async (req, res) => {
    try {
        const { query } = req.query; // ?query=elbise
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Boş arama kontrolü
        if (!query || query.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: "Arama terimi gerekli" 
            });
        }

        const searchTerm = query.trim();

        // MongoDB'de name, brand, category alanlarında case-insensitive arama
        const searchQuery = {
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { brand: { $regex: searchTerm, $options: 'i' } },
                { category: { $regex: searchTerm, $options: 'i' } },
                { satici: { $regex: searchTerm, $options: 'i' } }
            ]
        };

        const products = await Product.find(searchQuery)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Product.countDocuments(searchQuery);
        const totalPages = Math.ceil(total / limit);

        res.status(200).json({
            success: true,
            products: products,
            query: searchTerm,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: total,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
}
