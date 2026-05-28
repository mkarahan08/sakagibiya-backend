// backend/tests/unit/passwordValidation.spec.js
//
// Property 10: Şifre kalite kontrolü (saf fonksiyon kısmı)
// Validates: Requirements 3.5
//
// Bu test, `validateNewPassword(pwd)` saf fonksiyonunun şu invariantları
// koruduğunu doğrular:
//   - len < 8       → ok === false
//   - len >= 8 ve trim().length > 0 → ok === true
//   - whitespace-only (uzunluk >=8 olsa bile) → ok === false
//
// Not: "yeni şifre eski şifre ile aynı" kontrolü saf değil (DB I/O içerir),
// bu yüzden 7.3 task'ında HTTP integration testinde doğrulanır.

import fc from "fast-check";
import { validateNewPassword } from "../../services/passwordResetService.js";

describe("Feature: forgot-password-email", () => {
  describe("Property 10: Şifre kalite kontrolü (saf fonksiyon)", () => {
    test("len < 8 → ok === false", () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 7 }), (pwd) => {
          // fc.string varsayılan olarak 0..7 karakter üretir; tüm bu
          // string'ler için fonksiyon false dönmeli (Req 3.5).
          const result = validateNewPassword(pwd);
          expect(result.ok).toBe(false);
          expect(typeof result.message).toBe("string");
        }),
        { numRuns: 100 }
      );
    });

    test("len >= 8 ve whitespace-only değilse → ok === true", () => {
      fc.assert(
        fc.property(
          // minLength: 8 garantisi + whitespace-only filtresi.
          // Filter, trim sonrası en az 1 anlamlı karakter kalmasını sağlar.
          fc.string({ minLength: 8, maxLength: 64 }).filter((s) => s.trim().length > 0),
          (pwd) => {
            const result = validateNewPassword(pwd);
            expect(result.ok).toBe(true);
            expect(result.message).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test("len >= 8 olsa bile whitespace-only → ok === false (edge case)", () => {
      fc.assert(
        fc.property(
          // 8..16 karakter uzunluğunda, sadece whitespace karakterlerden
          // oluşan string üreteci. Bu durum uzunluk kuralını geçer ama
          // anlamsız parolaları yakalamak için ek kontrolün doğru çalıştığını
          // gösterir.
          fc
            .array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 8, maxLength: 16 })
            .map((arr) => arr.join("")),
          (pwd) => {
            // Sanity: oluşturulan string gerçekten whitespace-only ve >=8.
            expect(pwd.length).toBeGreaterThanOrEqual(8);
            expect(pwd.trim().length).toBe(0);

            const result = validateNewPassword(pwd);
            expect(result.ok).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
