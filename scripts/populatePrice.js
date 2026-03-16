/**
 * Mevcut ürünlerde final_price string'inden price (Number) alanını doldurur.
 * Sadece bir kez çalıştırın: node backend/scripts/populatePrice.js
 *
 * Önce .env ve MongoDB bağlantısı gerekir (örn. backend dizininden: node scripts/populatePrice.js)
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

function parsePriceString(str) {
  if (str == null || typeof str !== 'string') return null;
  const cleaned = str.replace(/\s*TL\s*/gi, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const col = db.collection('hepsiburada');
  const cursor = col.find({ final_price: { $exists: true, $ne: null } });
  let updated = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const price = parsePriceString(doc.final_price);
    if (price != null) {
      await col.updateOne({ _id: doc._id }, { $set: { price } });
      updated++;
    }
  }
  console.log(`${updated} ürün güncellendi (price alanı set edildi).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
