// backend/tests/unit/codeHashRoundTrip.spec.js
//
// Property 4: Code hash round-trip
// Validates: Requirements 6.4
//
// Bu test, bcrypt sarmalayıcı olan `hashCode` ve `verifyCodeHash`
// fonksiyonlarının çift yönlü tutarlılığını doğrular:
//   - verifyCodeHash(code1, hashCode(code1))   === true   (round-trip)
//   - verifyCodeHash(code2, hashCode(code1))   === false  (negatif kontrol)
//
// Generator: 6-haneli sayısal string üretmek için `fc.integer({min:0, max:999999})`
// kullanılır ve `padStart(6, "0")` ile sıfır dolgulanır. Bu yöntem,
// `fc.string` üzerinde regex filter'ı (filter rate düşük) kullanmaktan
// çok daha hızlı ve deterministik.
//
// Performans notu: bcrypt cost=10 her hash ~70ms tutar. İterasyon başına
// 2 hash + 2 verify yapıldığı için 50 iter ~14sn civarı sürer; jest
// testTimeout=30000 sınırına uyumlu kalır (Req 6.4).

import fc from "fast-check";
import { hashCode, verifyCodeHash } from "../../services/passwordResetService.js";

// 6-haneli sıfır-dolgulu sayısal string generator (hızlı, filter-free).
const sixDigitCode = () =>
  fc.integer({ min: 0, max: 999_999 }).map((n) => String(n).padStart(6, "0"));

describe("Feature: forgot-password-email", () => {
  describe("Property 4: Code hash round-trip", () => {
    test(
      "verifyCodeHash(code1, hashCode(code1)) === true ve verifyCodeHash(code2, hashCode(code1)) === false",
      async () => {
        await fc.assert(
          fc.asyncProperty(sixDigitCode(), sixDigitCode(), async (code1, code2) => {
            // İki kodun eşit olduğu durumu atlayarak negatif kontrolün
            // anlamlı olmasını garanti ediyoruz. (fc.pre, false durumunda
            // o iterasyonu skip eder.)
            fc.pre(code1 !== code2);

            // Round-trip: aynı kodun kendi hash'iyle eşleşmesi
            const hash1 = await hashCode(code1);
            const positive = await verifyCodeHash(code1, hash1);
            expect(positive).toBe(true);

            // Negatif: farklı kod aynı hash ile eşleşmemeli
            const negative = await verifyCodeHash(code2, hash1);
            expect(negative).toBe(false);
          }),
          // bcrypt yavaş; 50 iter @ ~70ms × 2 hash = ~7sn (timeout güvende).
          { numRuns: 50 }
        );
      },
      30_000
    );
  });
});
