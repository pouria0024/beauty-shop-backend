require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Product = require('./product');
const User = require('./user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
app.use(cors());
app.use(express.json());

// اتصال به دیتابیس
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB successfully!"))
    .catch((err) => console.log("❌ Database connection error:", err));

// API تستی برای ذخیره محصول
app.get('/api/add-test-product', async (req, res) => {
    try {
        const newProduct = new Product({
            name: "کرم مرطوب‌کننده",
            price: 150000,
            description: "کرم عالی برای پوست خشک",
            category: "مراقبت پوست",
            image: "cream.jpg",
            countInStock: 50
        });
        await newProduct.save();
        res.json({ message: "محصول با موفقیت ذخیره شد!", product: newProduct });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API برای گرفتن لیست محصولات
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Error fetching products", error });
    }
});
// API ثبت‌نام
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "این ایمیل قبلاً ثبت شده است" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ 
            message: "کاربر با موفقیت ثبت‌نام شد", 
            user: { name: newUser.name, email: newUser.email } 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// فقط برای تست ثبت‌نام از طریق مرورگر
app.get('/api/test-register', async (req, res) => {
    try {
        const bcrypt = require('bcryptjs');
        const User = require('./user');
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("123456", salt);

        const newUser = new User({ 
            name: "پوریا", 
            email: "pourya@test.com", 
            password: hashedPassword 
        });
        await newUser.save();

        res.json({ message: "کاربر تستی با موفقیت ثبت شد!", email: newUser.email });
    } catch (error) {
        res.json({ error: error.message });
    }
});
// API اصلی ورود (Login)
// Middleware برای محافظت از مسیرها
const protect = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ message: "دسترسی غیرمجاز" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: "توکن نامعتبر است" });
    }
};
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "ایمیل یا رمز عبور اشتباه است" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "ایمیل یا رمز عبور اشتباه است" });

        const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ message: "ورود موفقیت‌آمیز بود", token, user: { name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API تستی ورود (برای تست از مرورگر)
app.get('/api/test-login', async (req, res) => {
    try {
        const user = await User.findOne({ email: "pourya@test.com" });
        if (!user) return res.json({ message: "کاربر پیدا نشد. اول ثبت‌نام کن!" });

        const isMatch = await bcrypt.compare("123456", user.password);
        if (!isMatch) return res.json({ message: "پسورد اشتباهه!" });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ message: "ورود موفق!", token });
    } catch (error) {
        res.json({ error: error.message });
    }
});
// API محافظت‌شده برای پروفایل
app.get('/api/profile', protect, (req, res) => {
    res.json({ message: "این یک مسیر محافظت‌شده است", user: req.user });
});
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});