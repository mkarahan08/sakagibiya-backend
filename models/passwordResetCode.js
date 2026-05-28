import mongoose from "mongoose";

/**
 * PasswordResetCode modeli
 * ------------------------------------------------------------------
 * Kullanıcıların şifre sıfırlama akışında ürettiğimiz 6 haneli
 * doğrulama kodunun meta verilerini saklar. Ham kod ASLA DB'ye
 * yazılmaz; sadece bcrypt ile hash'lenmiş hali (`codeHash`) tutulur.
 *
 * Yaşam döngüsü:
 *   1. forgot-password çağrısında: yeni kayıt oluşur
 *      (expiresAt = now + 10dk, attemptsLeft = 3, consumedAt = null).
 *   2. verify-reset-code başarılı olursa: consumedAt set edilir ve
 *      o anda üretilen JWT'nin jti değeri resetTokenJti'ye yazılır.
 *   3. reset-password başarılı olursa: tokenUsedAt set edilir,
 *      böylece aynı reset token tekrar kullanılamaz.
 *   4. expiresAt geçtiğinde MongoDB TTL index kaydı otomatik siler;
 *      ayrı bir cron veya temizlik job'una ihtiyaç yoktur.
 */
const passwordResetCodeSchema = new mongoose.Schema(
  {
    // Kodun sahibi olan User dokümanına referans. İndekslenir, çünkü
    // "bu kullanıcının aktif kodu var mı" sorgusu sık çalışır.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // E-postanın küçük harfe normalize edilmiş hali. Kullanıcı
    // büyük/küçük harf karışık girse bile aynı kayda denk gelsin
    // diye `lowercase: true` ile saklıyoruz. Sorgular için indexli.
    emailLower: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },

    // 6 haneli ham kodun bcrypt hash'i. Ham kod sadece e-postada
    // görünür; DB'de tutulması yan-kanal sızıntısına ve DB
    // ele geçirilirse direkt brute-force riskine yol açardı.
    // bcrypt sabit-zaman karşılaştırma sağladığı için timing attack
    // saldırılarına da dirençlidir.
    codeHash: {
      type: String,
      required: true,
    },

    // TTL index'in hedef alanı. MongoDB bu alanı şu an ile
    // karşılaştırır ve geçmişse kaydı otomatik siler. Süresi
    // dolmuş kodları zaten geçersiz sayıyoruz; DB şişmesin diye
    // fiziksel olarak da temizleniyorlar.
    expiresAt: {
      type: Date,
      required: true,
    },

    // Kalan yanlış deneme hakkı. Brute-force koruması: 0'a
    // ulaştığında kayıt invalidate edilir (consumedAt set) ve
    // sonraki tüm verify istekleri sabit "geçersiz/süresi dolmuş"
    // yanıtı alır.
    attemptsLeft: {
      type: Number,
      required: true,
      default: 3,
      min: 0,
    },

    // Kod tüketildiği veya invalidate edildiği zamanı tutar.
    // null  → kayıt aktif (ve expiresAt > now ve attemptsLeft > 0).
    // !null → kayıt artık verify için kullanılamaz.
    consumedAt: {
      type: Date,
      default: null,
    },

    // verify-reset-code başarılı olduktan sonra üretilen JWT'nin
    // jti claim değeri burada saklanır. reset-password çağrısında
    // gelen token'ın jti'sı bu kayıttaki değerle eşleşmeli ve
    // tokenUsedAt boş olmalı; aksi halde token reddedilir.
    // Bu sayede stateless JWT'ye tek-kullanımlık (one-shot)
    // davranışı kazandırılmış olur.
    resetTokenJti: {
      type: String,
      default: null,
      index: true,
    },

    // Reset token kullanılarak şifre başarıyla değiştirildiği an.
    // Set edildikten sonra aynı token bir daha kabul edilmez
    // (replay koruması).
    tokenUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    // createdAt / updatedAt alanları otomatik üretilsin: log ve
    // istatistik amaçlı kullanışlı, ek maliyeti yok.
    timestamps: true,
  }
);

// MongoDB TTL index: expiresAt anındaki belge silinir.
// expireAfterSeconds: 0 → "expiresAt değeri geçen kayıtları sil".
// Sayesinde süresi dolmuş kodlar koleksiyonda birikmez.
passwordResetCodeSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// "Bu kullanıcının aktif (tüketilmemiş ve süresi geçmemiş) kodu
// var mı?" sorgusunu hızlandıran bileşik index. Yeni kod üretirken
// önceki aktif kayıtları invalidate ederken de aynı index kullanılır.
passwordResetCodeSchema.index({
  userId: 1,
  consumedAt: 1,
  expiresAt: 1,
});

const PasswordResetCode = mongoose.model(
  "PasswordResetCode",
  passwordResetCodeSchema
);

export default PasswordResetCode;
