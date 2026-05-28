// backend/tests/unit/codeGenerator.spec.js
//
// Property 3: Reset code üreteci formatı
// Validates: Requirements 6.5
//
// Bu test, `generateSixDigitCode()` fonksiyonunun her çağrıda
// `/^\d{6}$/` regex'iyle eşleşen 6 karakterlik bir string döndürdüğünü
// fast-check ile 1000 iterasyon boyunca doğrular.
//
// Ayrıca, `padStart` davranışını sabitlemek için rng mock'lu bir
// example test bulunur: rng=()=>42 verildiğinde çıktı "000042" olmalı.

import fc from "fast-check";
import { generateSixDigitCode } from "../../lib/crypto.js";

describe("Feature: forgot-password-email", () => {
  describe("Property 3: Reset code üreteci formatı", () => {
    test("generateSixDigitCode() çıktısı her zaman /^\\d{6}$/ ile eşleşir (1000 iter)", () => {
      // Generator: fonksiyon stateless ve parametresiz çağrılıyor; bu yüzden
      // yalnızca iterasyonu sürdürmek için fc.constant(null) yeterli.
      fc.assert(
        fc.property(fc.constant(null), () => {
          const code = generateSixDigitCode();

          // Tip ve uzunluk invariantları
          expect(typeof code).toBe("string");
          expect(code.length).toBe(6);

          // Regex invariantı (Req 6.5)
          expect(code).toMatch(/^\d{6}$/);
        }),
        { numRuns: 1000 }
      );
    });

    test("rng=()=>42 → padStart 6 haneye sıfır dolgu yapar (example)", () => {
      // crypto.randomInt arayüzü (min, max) → [min, max) döndürür.
      // Burada deterministik mock vererek `padStart` davranışını sabitliyoruz.
      const mockRng = () => 42;
      const code = generateSixDigitCode(mockRng);
      expect(code).toBe("000042");
    });

    test("rng=()=>0 → '000000' (alt sınır)", () => {
      const code = generateSixDigitCode(() => 0);
      expect(code).toBe("000000");
    });

    test("rng=()=>999999 → '999999' (üst sınır)", () => {
      const code = generateSixDigitCode(() => 999999);
      expect(code).toBe("999999");
    });
  });
});
