import Product from '../models/hepsiburada.js';
import { getAllowedProductFields } from '../validators/productValidator.js';
import {
    parseListParams,
    parseSearchParams,
    buildListMatch,
    buildSearchMatch,
    needAggregation,
    buildProductPipeline,
    buildCountPipeline,
    getSortOption,
    buildPagination
} from '../services/productQuery.js';

export const getAllProducts = async (req, res, next) => {
    try {
        const params = parseListParams(req.query);
        const { page, limit, skip } = params;
        const matchQuery = buildListMatch(params);
        const useAggregation = needAggregation(params);
        const hasFilters = Object.keys(matchQuery).length > 0 || useAggregation;

        if (!hasFilters) {
            const [products, total] = await Promise.all([
                Product.aggregate([{ $sample: { size: limit } }]),
                Product.countDocuments({})
            ]);
            return res.status(200).json({
                products,
                pagination: buildPagination(page, limit, total)
            });
        }

        let products;
        let total;

        if (useAggregation) {
            try {
                const countPipeline = buildCountPipeline(matchQuery, params);
                const countResult = await Product.aggregate(countPipeline);
                total = countResult.length > 0 ? countResult[0].n : 0;
                const dataPipeline = buildProductPipeline(matchQuery, params, { includeSkipLimit: true });
                products = await Product.aggregate(dataPipeline);
            } catch (aggErr) {
                const fallbackSort = (params.sort === 'priceasc' || params.sort === 'pricedesc')
                    ? { createdAt: -1 }
                    : getSortOption(params.sort);
                products = await Product.find(matchQuery)
                    .sort(fallbackSort)
                    .skip(skip)
                    .limit(limit);
                total = await Product.countDocuments(matchQuery);
            }
        } else {
            total = await Product.countDocuments(matchQuery);
            products = await Product.find(matchQuery)
                .sort(getSortOption(params.sort))
                .skip(skip)
                .limit(limit);
        }

        res.status(200).json({
            products,
            pagination: buildPagination(page, limit, total)
        });
    } catch (err) {
        next(err);
    }
};


export const getProductById = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
        res.status(200).json(product);
    } catch (err) {
        next(err);
    }
}

export const createProduct = async (req, res, next) => {
    try {
        const allowed = getAllowedProductFields();
        const body = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) body[key] = req.body[key];
        }
        const product = await Product.create(body);
        res.status(201).json(product);
    } catch (err) {
        next(err);
    }
}

export const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const allowed = getAllowedProductFields();
        const body = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) body[key] = req.body[key];
        }
        const product = await Product.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!product) {
            return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
        }
        res.status(200).json(product);
    } catch (err) {
        next(err);
    }
}

export const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndDelete(id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Ürün bulunamadı' });
        }
        res.status(200).json({ success: true, message: 'Ürün silindi' });
    } catch (err) {
        next(err);
    }
}

export const searchProducts = async (req, res, next) => {
    try {
        const params = parseSearchParams(req.query);
        const { page, limit, skip, searchTerm } = params;

        if (!searchTerm) {
            return res.status(400).json({ success: false, message: 'Arama terimi gerekli' });
        }

        const matchQuery = buildSearchMatch(searchTerm, params);
        const useAggregation = needAggregation(params);
        let products;
        let total;

        if (useAggregation) {
            try {
                const countPipeline = buildCountPipeline(matchQuery, params);
                const countResult = await Product.aggregate(countPipeline);
                total = countResult.length > 0 ? countResult[0].n : 0;
                const dataPipeline = buildProductPipeline(matchQuery, params, { includeSkipLimit: true });
                products = await Product.aggregate(dataPipeline);
            } catch (aggErr) {
                const fallbackSort = (params.sort === 'priceasc' || params.sort === 'pricedesc')
                    ? { createdAt: -1 }
                    : getSortOption(params.sort);
                products = await Product.find(matchQuery)
                    .sort(fallbackSort)
                    .skip(skip)
                    .limit(limit);
                total = await Product.countDocuments(matchQuery);
            }
        } else {
            total = await Product.countDocuments(matchQuery);
            products = await Product.find(matchQuery)
                .sort(getSortOption(params.sort))
                .skip(skip)
                .limit(limit);
        }

        res.status(200).json({
            success: true,
            products,
            query: searchTerm,
            pagination: buildPagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};
