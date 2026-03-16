/**
 * Ürün query sistemi (pipeline tabanlı)
 *
 * Davranış:
 * 1. Filtre (kategori, mağaza, fiyat/indirim aralığı) uygulanır → eşleşen tüm ürünler
 * 2. Bu küme üzerinde sıralama yapılır (örn. düşükten yükseğe = en düşük en başta)
 * 3. Sadece istenen sayfa döner (skip/limit): sayfa 1 = ilk 20, sayfa 2 = sonraki 20…
 * Böylece scroll ile altta hep sıralı devamı eklenir.
 */

export function escapeRegex(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseNum(val, def = null) {
  if (val === undefined || val === null || val === "") return def;
  const n = parseFloat(val);
  return isNaN(n) ? def : n;
}

/** final_price string'ini sayıya çeviren aggregation ifadesi */
export function priceSortField() {
  const withNull = { $ifNull: ["$final_price", "0"] };
  const noTl = { $replaceAll: { input: withNull, find: "TL", replacement: "" } };
  const noSpaces = { $replaceAll: { input: noTl, find: " ", replacement: "" } };
  const noThousands = { $replaceAll: { input: noSpaces, find: ".", replacement: "" } };
  const decimalPoint = { $replaceAll: { input: noThousands, find: ",", replacement: "." } };
  return {
    $convert: {
      input: decimalPoint,
      to: "double",
      onError: 0,
      onNull: 0
    }
  };
}

export function parseListParams(reqQuery = {}) {
  const page = Math.max(1, parseNum(reqQuery.page, 1) || 1);
  const limit = Math.min(100, Math.max(1, parseNum(reqQuery.limit, 20) || 20));
  const skip = (page - 1) * limit;
  const sort = (reqQuery.sort || "recommended").toString().toLowerCase();
  const category = reqQuery.category ? String(reqQuery.category).trim() : "";
  const satici = reqQuery.satici ? String(reqQuery.satici).trim() : "";
  const minPrice = parseNum(reqQuery.minPrice);
  const maxPrice = parseNum(reqQuery.maxPrice);
  const minDiscount = parseNum(reqQuery.minDiscount);
  const maxDiscount = parseNum(reqQuery.maxDiscount);
  return {
    page,
    limit,
    skip,
    sort,
    category,
    satici,
    minPrice,
    maxPrice,
    minDiscount,
    maxDiscount
  };
}

export function parseSearchParams(reqQuery = {}) {
  const list = parseListParams(reqQuery);
  const query = reqQuery.query ? String(reqQuery.query).trim() : "";
  return { ...list, searchTerm: query };
}

export function buildListMatch({ category, satici, minDiscount, maxDiscount }) {
  const match = {};
  if (category) {
    if (category === "Moda") {
      match.category = { $in: ["Erkek Moda", "Kadin Moda"] };
    } else {
      match.category = category;
    }
  }
  if (satici) {
    match.satici = { $regex: satici, $options: "i" };
  }
  if (minDiscount != null || maxDiscount != null) {
    match.discount = {};
    if (minDiscount != null) match.discount.$gte = minDiscount;
    if (maxDiscount != null) match.discount.$lte = maxDiscount;
  }
  return match;
}

export function buildSearchMatch(searchTerm, { satici, minDiscount, maxDiscount }) {
  const term = escapeRegex(searchTerm);
  const match = {
    $or: [
      { name: { $regex: term, $options: "i" } },
      { brand: { $regex: term, $options: "i" } },
      { category: { $regex: term, $options: "i" } },
      { satici: { $regex: term, $options: "i" } }
    ]
  };
  if (satici) {
    match.satici = { $regex: satici, $options: "i" };
  }
  if (minDiscount != null || maxDiscount != null) {
    match.discount = {};
    if (minDiscount != null) match.discount.$gte = minDiscount;
    if (maxDiscount != null) match.discount.$lte = maxDiscount;
  }
  return match;
}

export function needAggregation({ minPrice, maxPrice, sort }) {
  const hasPriceFilter = minPrice != null || maxPrice != null;
  const sortByPrice = sort === "priceasc" || sort === "pricedesc";
  return hasPriceFilter || sortByPrice;
}

/**
 * Filtrelenmiş küme üzerinde sıralama yapıp istenen sayfayı döndüren pipeline.
 * Sıra: match → fiyat sayıya çevir → (fiyat aralığı match) → SORT tüm sonuç → skip/limit.
 * Böylece "düşükten yükseğe" = kategorideki tüm ürünlerde en düşükler en başta, sayfa 1 ilk 20, sayfa 2 sonraki 20.
 */
export function buildProductPipeline(matchQuery, params, options = {}) {
  const { includeSkipLimit = true } = options;
  const { sort, minPrice, maxPrice, skip, limit } = params;
  const pipeline = [{ $match: matchQuery }];

  pipeline.push({ $addFields: { final_price_num: priceSortField() } });

  if (minPrice != null || maxPrice != null) {
    const priceMatch = {};
    if (minPrice != null) priceMatch.$gte = minPrice;
    if (maxPrice != null) priceMatch.$lte = maxPrice;
    pipeline.push({ $match: { final_price_num: priceMatch } });
  }

  if (sort === "priceasc" || sort === "pricedesc") {
    pipeline.push({ $sort: { final_price_num: sort === "priceasc" ? 1 : -1 } });
  } else if (sort === "discountdesc") {
    pipeline.push({ $sort: { discount: -1 } });
  } else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  if (includeSkipLimit) {
    pipeline.push({ $skip: skip }, { $limit: limit }, { $project: { final_price_num: 0 } });
  }
  return pipeline;
}

export function buildCountPipeline(matchQuery, params) {
  return buildProductPipeline(matchQuery, params, { includeSkipLimit: false }).concat([
    { $count: "n" }
  ]);
}

export function getSortOption(sort) {
  if (sort === "discountdesc") return { discount: -1 };
  return { createdAt: -1 };
}

export function buildPagination(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  return {
    currentPage: page,
    totalPages,
    totalItems: total,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
}
