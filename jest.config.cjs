/**
 * Jest yapılandırması
 *
 * - testEnvironment: 'node' → backend (Express + Mongoose) testleri için
 * - testMatch: backend/tests/**\/*.spec.js dosyalarını çalıştırır
 *   (unit + integration testleri ileride bu dizine eklenecek)
 * - transform: babel-jest ile ESM kodunu Jest'in anlayabileceği biçime çevirir
 *   (backend/babel.config.cjs içindeki @babel/preset-env hedefi node "current")
 * - testTimeout: mongodb-memory-server ilk indirme/başlatmada yavaş olabildiği için 30sn
 * - clearMocks: her testten önce jest mock'ları otomatik temizlensin
 *
 * setupFiles / setupFilesAfterEach Task 2 ve sonrasında MongoMemoryServer ve test
 * yardımcıları eklendiğinde bu dosyaya eklenecektir; şu an saf konfig kurulumu yapıyoruz.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.spec.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testTimeout: 30000,
  clearMocks: true,
  // node_modules içindeki ESM-only paketler ileride sorun çıkarırsa
  // transformIgnorePatterns burada gevşetilebilir.
};
