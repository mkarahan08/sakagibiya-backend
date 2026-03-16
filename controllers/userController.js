import User from "../models/users.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";


const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7h" });
};

// REGISTER
export const registerUser = async (req, res, next) => {
    try {
        const { name, email, password, gender } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: "Bu email zaten kayıtlı" });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userData = { name, email, password: hashedPassword };
        if (gender && ["erkek", "kadin", "belirtmek_istemiyorum"].includes(gender)) {
            userData.gender = gender;
        }
        const user = await User.create(userData);

        if (user) {
            res.status(201).json({
                success: true,
                message: 'Kayıt başarılı',
                data: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    gender: user.gender,
                    token: generateToken(user._id)
                }
            });
        }
    } catch (error) {
        next(error);
    }
};

// LOGIN
export const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Email ve şifre giriniz' 
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ 
                success: false,
                message: "Kullanıcı bulunamadı" 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ 
                success: false,
                message: "Şifre hatalı" 
            });
        }

        res.status(200).json({
            success: true,
            message: 'Giriş başarılı',
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                gender: user.gender,
                token: generateToken(user._id),
            }
        });

    } catch (error) {
        next(error);
    }
};

export const getUserProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Kullanıcı bulunamadı'
            });
        }

        return res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

