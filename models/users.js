import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    },
    gender: {
        type: String,
        enum: ["erkek", "kadin", "belirtmek_istemiyorum", ""],
        default: "",
    },
    // Faz 3 — Yasal: Kullanıcının kayıt sırasında "Kullanım Koşulları"nı
    // kabul ettiği zaman damgası. Eski kullanıcılarda null kalır.
    acceptedTermsAt: {
        type: Date,
        default: null,
    },
});
// Şifre karşılaştırma metodu
userSchema.methods.matchPassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
