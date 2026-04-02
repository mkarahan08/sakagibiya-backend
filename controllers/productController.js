import Product from '../models/products.js';

// Kullanici girdisindeki regex ozel karakterlerini kacir (injection koruması)
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Turkce es-anlamlilar haritasi (kucuk harf, genisletilebilir)
const SYNONYMS = {
    'pabuç':        ['ayakkabı', 'pabuç', 'bot', 'sandalet'],
    'ayakkabı':     ['ayakkabı', 'pabuç', 'bot', 'sandalet'],
    'cep telefonu': ['telefon', 'akıllı telefon', 'smartphone', 'cep telefonu'],
    'telefon':      ['telefon', 'akıllı telefon', 'smartphone', 'cep telefonu'],
    'laptop':       ['dizüstü', 'notebook', 'laptop', 'bilgisayar'],
    'dizüstü':      ['dizüstü', 'notebook', 'laptop'],
    'bilgisayar':   ['bilgisayar', 'laptop', 'dizüstü', 'masaüstü', 'pc'],
    'kıyafet':      ['kıyafet', 'giyim', 'elbise', 'gömlek', 'pantolon'],
    'elbise':       ['elbise', 'kıyafet', 'giyim'],
    'çanta':        ['çanta', 'el çantası', 'sırt çantası'],
    'tv':           ['televizyon', 'tv', 'ekran'],
    'televizyon':   ['televizyon', 'tv', 'ekran'],
    'kulaklık':     ['kulaklık', 'kulaklik', 'earphone', 'headphone'],
    'saat':         ['saat', 'kol saati', 'akıllı saat', 'smartwatch'],
};

// Arama terimi icin olasi es-anlamlilari dondur; yoksa terimi oldugu gibi dizi icinde dondur
const expandSynonyms = (term) => {
    const lower = term.toLowerCase();
    return SYNONYMS[lower] || [term];
};

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

        // Platform filtresi — büyük/küçük harf farkı gözetmeksizin eşleştir
        const platform = req.query.platform;
        if (platform && platform.trim() !== '') {
            query.platform = { $regex: new RegExp(`^${escapeRegex(platform.trim())}$`, 'i') };
        }

        // Satıcı filtresi
        const satici = req.query.satici;
        if (satici && satici.trim() !== '') {
            query.satici = { $regex: escapeRegex(satici.trim()), $options: 'i' };
        }

        // Fiyat aralığı filtresi
        const minPrice = parseFloat(req.query.minPrice);
        const maxPrice = parseFloat(req.query.maxPrice);
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            query.final_price = {};
            if (!isNaN(minPrice)) query.final_price.$gte = String(minPrice);
            if (!isNaN(maxPrice)) query.final_price.$lte = String(maxPrice);
        }

        // İndirim oranı filtresi
        const minDiscount = parseFloat(req.query.minDiscount);
        const maxDiscount = parseFloat(req.query.maxDiscount);
        if (!isNaN(minDiscount) || !isNaN(maxDiscount)) {
            query.discount = {};
            if (!isNaN(minDiscount)) query.discount.$gte = minDiscount;
            if (!isNaN(maxDiscount)) query.discount.$lte = maxDiscount;
        }

        // Sıralama
        const sort = req.query.sort;
        let sortOption = { discount: -1, createdAt: -1 };
        if (sort === 'price_asc')       sortOption = { final_price: 1 };
        else if (sort === 'price_desc') sortOption = { final_price: -1 };
        else if (sort === 'discount')   sortOption = { discount: -1 };
        else if (sort === 'newest')     sortOption = { createdAt: -1 };

        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / limit);

        const products = await Product.find(query)
            .skip(skip)
            .limit(limit)
            .sort(sortOption);

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

// 🔍 Ürün arama fonksiyonu — tokenization + synonym + filtreler
export const searchProducts = async (req, res) => {
    try {
        const { query } = req.query;
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip  = (page - 1) * limit;

        // Bos arama kontrolu
        if (!query || query.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Arama terimi gerekli'
            });
        }

        const searchTerm = query.trim();

        // --- Tokenization ---
        // "Kirmizi Apple Telefon" → ["Kirmizi", "Apple", "Telefon"]
        const rawTokens = searchTerm.split(/\s+/).filter(Boolean);

        // Her token icin es-anlamlilari genislet, sonra escape et
        // Ornek: "laptop" → ["dizustu","notebook","laptop","bilgisayar"]
        const tokenGroups = rawTokens.map(tok => expandSynonyms(tok).map(escapeRegex));

        // Her token-grubu icin: "herhangi bir es-anlamli, herhangi bir alanda eslesmeli" ($or)
        // Tum token-gruplari ayni anda eslesmelidir ($and)
        const SEARCH_FIELDS = ['name', 'brand', 'category', 'satici'];

        const tokenConditions = tokenGroups.map(variants => ({
            $or: variants.flatMap(variant =>
                SEARCH_FIELDS.map(field => ({ [field]: { $regex: variant, $options: 'i' } }))
            )
        }));

        const searchQuery = { $and: tokenConditions };

        // --- Kategori filtresi ---
        const categoryParam = req.query.category;
        if (categoryParam && categoryParam.trim() !== '') {
            const categoryName = categoryParam.trim();
            if (categoryName === 'Moda') {
                searchQuery.category = { $in: ['Erkek Moda', 'Kadin Moda'] };
            } else {
                searchQuery.category = categoryName;
            }
        }

        // --- Platform filtresi — büyük/küçük harf farkı gözetmeksizin eşleştir ---
        const platformParam = req.query.platform;
        if (platformParam && platformParam.trim() !== '') {
            searchQuery.platform = { $regex: new RegExp(`^${escapeRegex(platformParam.trim())}$`, 'i') };
        }

        // --- Filtreler (frontend'den gelen parametreler) ---
        const satici      = req.query.satici;
        const minPrice    = parseFloat(req.query.minPrice);
        const maxPrice    = parseFloat(req.query.maxPrice);
        const minDiscount = parseFloat(req.query.minDiscount);
        const maxDiscount = parseFloat(req.query.maxDiscount);

        if (satici && satici.trim() !== '') {
            searchQuery.satici = { $regex: escapeRegex(satici.trim()), $options: 'i' };
        }
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            searchQuery.final_price = {};
            if (!isNaN(minPrice)) searchQuery.final_price.$gte = String(minPrice);
            if (!isNaN(maxPrice)) searchQuery.final_price.$lte = String(maxPrice);
        }
        if (!isNaN(minDiscount) || !isNaN(maxDiscount)) {
            searchQuery.discount = {};
            if (!isNaN(minDiscount)) searchQuery.discount.$gte = minDiscount;
            if (!isNaN(maxDiscount)) searchQuery.discount.$lte = maxDiscount;
        }

        // --- Siralama ---
        const sort = req.query.sort;
        let sortOption = { createdAt: -1 };
        if (sort === 'price_asc')       sortOption = { final_price: 1 };
        else if (sort === 'price_desc') sortOption = { final_price: -1 };
        else if (sort === 'discount')   sortOption = { discount: -1 };
        else if (sort === 'newest')     sortOption = { createdAt: -1 };

        // --- FAZ 2: Atlas Search + Fuzzy (aktive etmek icin asagidaki blogu acin, usteki Product.find blogunu kaldirin) ---
        // Atlas UI'de Search Index olusturulduktan ve "active" durumuna gectikten sonra kullanin.
        // Index JSON'u: { "mappings": { "dynamic": false, "fields": {
        //   "name": [{"type":"string","analyzer":"lucene.turkish"}],
        //   "brand": [{"type":"string","analyzer":"lucene.standard"}],
        //   "category": [{"type":"string","analyzer":"lucene.standard"}],
        //   "satici": [{"type":"string","analyzer":"lucene.standard"}]
        // }}}
        //
        // const atlasPipeline = [
        //   {
        //     $search: {
        //       index: 'default',
        //       compound: {
        //         should: rawTokens.flatMap(tok => expandSynonyms(tok)).map(variant => ({
        //           text: {
        //             query: variant,
        //             path: ['name', 'brand', 'category', 'satici'],
        //             fuzzy: { maxEdits: 1, prefixLength: 3 }
        //           }
        //         })),
        //         minimumShouldMatch: rawTokens.length
        //       }
        //     }
        //   },
        //   { $skip: skip },
        //   { $limit: limit }
        // ];
        // const products = await Product.aggregate(atlasPipeline);
        // const total = products.length; // Atlas Search ile countDocuments ayri sorgu gerektirir
        // -----------------------------------------------------------------------------------------

        const [products, total] = await Promise.all([
            Product.find(searchQuery).skip(skip).limit(limit).sort(sortOption),
            Product.countDocuments(searchQuery)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.status(200).json({
            success: true,
            products,
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
