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
    }
});
// Şifre karşılaştırma metodu
userSchema.methods.matchPassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
