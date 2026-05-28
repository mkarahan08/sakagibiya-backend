/**
 * Babel yapılandırması (Jest + ESM interop için)
 *
 * Backend ESM ("type": "module") modunda çalışır; Jest 29 ESM desteğini deneysel olarak
 * sunduğundan, testleri stabilize etmek için babel-jest ile transpile ediyoruz.
 * Hedef: Node "current" (CI ve geliştirici makineleri ile uyumlu).
 *
 * Not: Bu config sadece test ortamında kullanılır; uygulama runtime'ı saf ESM çalışmaya devam eder.
 */
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: 'current' },
      },
    ],
  ],
};
