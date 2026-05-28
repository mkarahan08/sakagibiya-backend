import Product from '../models/products.js';

// Kullanici girdisindeki regex ozel karakterlerini kacir (injection koruması)
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * UI’da seçilen platform → MongoDB’deki yazım farkları (Amazon / Amazon.com.tr, Hepsi Burada vb.)
 */
function platformMongoRegex(platformInput) {
    const raw = String(platformInput || '').trim();
    if (!raw) return /^$/; // bos eslesmesin
    const norm = raw.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
    if (norm === 'trendyol') return /^\s*trendyol\s*$/i;
    if (norm === 'hepsiburada' || norm === 'hepsi burada') {
        return /^\s*(hepsiburada|hepsi\s*burada)\s*$/i;
    }
    if (norm === 'amazon') {
        return /^\s*amazon(\.com(\.tr)?)?\s*$/i;
    }
    if (norm === 'n11') {
        return /^\s*n11(\.com)?\s*$/i;
    }
    return new RegExp(`^\\s*${escapeRegex(raw)}\\s*$`, 'i');
}

/** Satıcı tam eşleşme + baş/son boşluk toleransı */
function saticiExactMongoRegex(saticiInput) {
    const t = String(saticiInput || '').trim();
    if (!t) return /^$/;
    return new RegExp(`^\\s*${escapeRegex(t)}\\s*$`, 'i');
}

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

/** Sadece kategori filtresi (filterMeta / aralık hesabı için; platform-satıcı-fiyat-indirim yok) */
const categoryOnlyMatch = (category) => {
    const q = { is_active: true };
    if (category && category.trim() !== '') {
        const categoryName = category.trim();
        if (categoryName === 'Moda') {
            q.category = { $in: ['Erkek Moda', 'Kadin Moda'] };
        } else {
            q.category = categoryName;
        }
    }
    return q;
};

/**
 * Filtre paneli: platform seçilince satıcı listesi.
 * MongoDB’de SQL’deki "SELECT DISTINCT satici FROM products WHERE platform = ?" karşılığı: distinct('satici', filter).
 */
export const getPlatformSellers = async (req, res) => {
    try {
        const platform = req.query.platform;
        if (!platform || String(platform).trim() === '') {
            return res.status(400).json({ message: 'platform parametresi gerekli', sites: [] });
        }

        const p = String(platform).trim();
        let match = {
            is_active: true,
            platform: { $regex: platformMongoRegex(p) },
        };

        const categoryParam = req.query.category;
        if (categoryParam && String(categoryParam).trim() !== '') {
            const categoryName = String(categoryParam).trim();
            if (categoryName === 'Moda') {
                match.category = { $in: ['Erkek Moda', 'Kadin Moda'] };
            } else {
                match.category = categoryName;
            }
        }

        let raw = await Product.distinct('satici', match);

        if (raw.filter(Boolean).length === 0) {
            match = {
                is_active: true,
                platform: { $regex: escapeRegex(p), $options: 'i' },
            };
            if (categoryParam && String(categoryParam).trim() !== '') {
                const categoryName = String(categoryParam).trim();
                if (categoryName === 'Moda') {
                    match.category = { $in: ['Erkek Moda', 'Kadin Moda'] };
                } else {
                    match.category = categoryName;
                }
            }
            raw = await Product.distinct('satici', match);
        }

        const sites = raw.filter(Boolean).sort((a, b) =>
            String(a).localeCompare(String(b), 'tr')
        );

        res.status(200).json({ sites });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const category = req.query.category; // Kategori filtresi

        // Kategori filtresi varsa ekle. Sadece aktif urunler gosterilsin.
        const query = { is_active: true };
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
            query.platform = { $regex: platformMongoRegex(platform.trim()) };
        }

        // Satıcı filtresi — tam isim (b/h yok); baş/son boşluk DB kaynaklı farklara izin ver
        const satici = req.query.satici;
        if (satici && satici.trim() !== '') {
            query.satici = { $regex: saticiExactMongoRegex(satici.trim()) };
        }

        // Fiyat aralığı filtresi
        const minPrice = parseFloat(req.query.minPrice);
        const maxPrice = parseFloat(req.query.maxPrice);
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            query.final_price = {};
            if (!isNaN(minPrice)) query.final_price.$gte = minPrice;
            if (!isNaN(maxPrice)) query.final_price.$lte = maxPrice;
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

        const categoryForMeta = req.query.category;
        const metaMatch = categoryOnlyMatch(categoryForMeta);

        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / limit);

        const products = await Product.find(query)
            .skip(skip)
            .limit(limit)
            .sort(sortOption);

        const pagination = {
            currentPage: page,
            totalPages,
            totalItems: total,
            itemsPerPage: limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        };

        const body = { products, pagination };

        if (page === 1) {
            const metaAgg = await Product.aggregate([
                { $match: metaMatch },
                {
                    $group: {
                        _id: null,
                        minPrice: { $min: '$final_price' },
                        maxPrice: { $max: '$final_price' },
                        minDiscount: { $min: { $ifNull: ['$discount', 0] } },
                        maxDiscount: { $max: { $ifNull: ['$discount', 0] } },
                        sites: { $addToSet: '$satici' }
                    }
                }
            ]);
            const row = metaAgg[0];
            const filterMeta = {
                minPrice: 0,
                maxPrice: 1000,
                minDiscount: 0,
                maxDiscount: 100,
                sites: []
            };
            if (row) {
                const minP = Number(row.minPrice);
                const maxP = Number(row.maxPrice);
                filterMeta.minPrice = Number.isFinite(minP) ? minP : 0;
                filterMeta.maxPrice = Number.isFinite(maxP) ? maxP : filterMeta.minPrice;
                if (filterMeta.maxPrice < filterMeta.minPrice) filterMeta.maxPrice = filterMeta.minPrice;

                const minD = Number(row.minDiscount);
                const maxD = Number(row.maxDiscount);
                filterMeta.minDiscount = Number.isFinite(minD) ? minD : 0;
                filterMeta.maxDiscount = Number.isFinite(maxD) ? maxD : 100;
                if (filterMeta.maxDiscount < filterMeta.minDiscount) filterMeta.maxDiscount = filterMeta.minDiscount;
                if (filterMeta.maxDiscount === filterMeta.minDiscount && filterMeta.minDiscount === 0) {
                    filterMeta.maxDiscount = 100;
                }

                filterMeta.sites = [...new Set((row.sites || []).filter(Boolean))].sort((a, b) =>
                    String(a).localeCompare(String(b), 'tr')
                );
            }
            body.filterMeta = filterMeta;
        }

        res.status(200).json(body);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}


export const getProductById = async (req, res) => {
    try {
        // Pasif urunler tek tek erisimde de gosterilmesin (URL ile direkt gelinse bile).
        const product = await Product.findOne({ _id: req.params.id, is_active: true });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
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

        // Sadece aktif urunler aramada gozuksun.
        const searchQuery = { is_active: true, $and: tokenConditions };

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
            searchQuery.platform = { $regex: platformMongoRegex(platformParam.trim()) };
        }

        // --- Filtreler (frontend'den gelen parametreler) ---
        const satici      = req.query.satici;
        const minPrice    = parseFloat(req.query.minPrice);
        const maxPrice    = parseFloat(req.query.maxPrice);
        const minDiscount = parseFloat(req.query.minDiscount);
        const maxDiscount = parseFloat(req.query.maxDiscount);

        if (satici && satici.trim() !== '') {
            searchQuery.satici = { $regex: saticiExactMongoRegex(satici.trim()) };
        }
        if (!isNaN(minPrice) || !isNaN(maxPrice)) {
            searchQuery.final_price = {};
            if (!isNaN(minPrice)) searchQuery.final_price.$gte = minPrice;
            if (!isNaN(maxPrice)) searchQuery.final_price.$lte = maxPrice;
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

/**
 * GET /api/products/:id/similar?limit=12
 * Content-based "benzer urunler" oneri.
 *
 * Strateji:
 *   1. Source urunu bul (aktif, _id ile).
 *   2. Aday havuzu: ayni kategori, aktif, source disinda.
 *   3. Skorla: marka eslesmesi +30, ayni platform DEGIL +10,
 *      fiyat yakinligi 0..40 (mutlak fark / source price).
 *   4. Top-N dondur. Esit skorlar arasinda yeni guncellenen onde.
 *
 * Notlar:
 *   - aggregation pipeline kullaniyoruz cunku final_price string olabiliyor;
 *     priceSortField yardimcisi yok bu controller'da, manual parsePrice yapacagiz.
 *   - source urun bulunamazsa 404.
 */
export const getSimilarProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));

    const source = await Product.findOne({ _id: id, is_active: true });
    if (!source) {
      return res.status(404).json({ success: false, message: 'Urun bulunamadi' });
    }

    // final_price'i sayisal cikar (parsePrice mantigi)
    const parsePrice = (val) => {
      if (val == null) return null;
      if (typeof val === 'number') return val;
      const cleaned = String(val).replace(' TL', '').replace(/\./g, '').replace(',', '.');
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    };

    const sourcePrice = parsePrice(source.final_price);

    // Aday havuzu: ayni kategori, aktif, source disinda
    const candidates = await Product.find({
      category: source.category,
      is_active: true,
      _id: { $ne: source._id },
    })
      .limit(200) // skor icin yeterli havuz, ama DB'yi yormasin
      .lean();

    // Skorla
    const sourceBrand = (source.brand || '').toLowerCase().trim();
    const sourcePlatform = (source.platform || '').toLowerCase().trim();

    const scored = candidates.map((p) => {
      let score = 0;

      // Marka eslesmesi: +30
      const pBrand = (p.brand || '').toLowerCase().trim();
      if (sourceBrand && pBrand && sourceBrand === pBrand) score += 30;

      // Farkli platform bonusu (cesitlilik): +10
      const pPlatform = (p.platform || '').toLowerCase().trim();
      if (sourcePlatform && pPlatform && sourcePlatform !== pPlatform) score += 10;

      // Fiyat yakinligi: maks 40 puan
      // Yakin fiyat = sourcePrice +/- %30 araliginda; cok uzaksa puan azalir
      if (sourcePrice && sourcePrice > 0) {
        const candidatePrice = parsePrice(p.final_price);
        if (candidatePrice && candidatePrice > 0) {
          const diff = Math.abs(candidatePrice - sourcePrice);
          const ratio = diff / sourcePrice;
          // ratio 0 -> 40 puan, ratio 1+ -> 0 puan, lineer azalma
          const priceScore = Math.max(0, 40 * (1 - ratio));
          score += priceScore;
        }
      }

      // Discount bonusu: indirimli urunler hafif onde olsun
      if (typeof p.discount === 'number' && p.discount > 0) {
        score += Math.min(10, p.discount / 10); // %100 indirim = +10
      }

      return { ...p, _score: score };
    });

    // Sirala: skor desc, esit ise last_updated desc
    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      const da = new Date(a.last_updated || a.updatedAt || 0).getTime();
      const db = new Date(b.last_updated || b.updatedAt || 0).getTime();
      return db - da;
    });

    // Cesitlilik: ayni platform pespese gelmesin (basit round-robin)
    const top = scored.slice(0, limit * 3);
    const result = [];
    let lastPlatform = null;
    for (const p of top) {
      if (result.length >= limit) break;
      if (p.platform === lastPlatform && top.some((q) => !result.includes(q) && q.platform !== lastPlatform)) {
        // Skip simdilik, sonraki turda dene
        continue;
      }
      result.push(p);
      lastPlatform = p.platform;
    }
    // Yetersiz kaldiysa kalan slotlari skor sirasiyla doldur
    if (result.length < limit) {
      for (const p of top) {
        if (result.length >= limit) break;
        if (!result.includes(p)) result.push(p);
      }
    }

    // Yanit: _score'u temizle
    const products = result.slice(0, limit).map(({ _score, ...rest }) => rest);

    res.status(200).json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
