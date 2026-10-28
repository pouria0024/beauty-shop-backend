require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Product = require('./product');
const User = require('./user');
const Order = require('./order');
const multer = require('multer');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
// تنظیمات ذخیره‌سازی عکس‌ها
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/'); 
    },
    filename(req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });
// اتصال به دیتابیس
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to MongoDB successfully!"))
    .catch((err) => console.log("Database connection error:", err));

// --- Middlewares ---
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

const admin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        res.status(401).json({ message: "دسترسی فقط برای مدیران مجاز است" });
    }
};

// --- API ها ---

// 1. لیست محصولات
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. ثبت‌نام
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: "این ایمیل قبلاً ثبت شده است" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: "کاربر با موفقیت ثبت‌نام شد" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. ورود
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "ایمیل یا رمز عبور اشتباه است" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "ایمیل یا رمز عبور اشتباه است" });

        const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ message: "ورود موفقیت‌آمیز بود", token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. ثبت سفارش
app.post('/api/orders', protect, async (req, res) => {
    try {
        const { orderItems, shippingAddress, totalPrice } = req.body;
        if (orderItems && orderItems.length === 0) return res.status(400).json({ message: "سبد خرید خالی است" });

        const newOrder = new Order({ user: req.user.id, orderItems, shippingAddress, totalPrice });
        const createdOrder = await newOrder.save();
        res.status(201).json(createdOrder);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. گرفتن سفارشات کاربر
app.get('/api/orders/myorders', protect, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 6. اضافه کردن محصول (فقط ادمین)
app.post('/api/products', protect, admin, async (req, res) => {
    try {
        const { name, price, description, category, image, countInStock } = req.body;
        const product = new Product({ name, price, description, category, image, countInStock });
        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 7. حذف محصول (فقط ادمین)
app.delete('/api/products/:id', protect, admin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            await product.deleteOne();
            res.json({ message: "محصول حذف شد" });
        } else {
            res.status(404).json({ message: "محصول پیدا نشد" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 8. تستی: تبدیل به ادمین
app.get('/api/make-admin', async (req, res) => {
    try {
        const user = await User.findOneAndUpdate({ email: "pourya@test.com" }, { isAdmin: true }, { new: true });
        res.json({ message: "کاربر ادمین شد!", user });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// 9. تستی: ورود برای مرورگر
app.get('/api/test-login', async (req, res) => {
    try {
        const user = await User.findOne({ email: "pourya@test.com" });
        const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// 10. تستی: ساخت محصول
app.get('/api/test-create-product', async (req, res) => {
    res.json({ message: "این API با موفقیت وصل شد!" });
});
// API ویرایش محصول (فقط ادمین)
app.put('/api/products/:id', protect, admin, async (req, res) => {
    try {
        const { name, price, description, category, image, countInStock } = req.body;
        
        const product = await Product.findById(req.params.id);

        if (product) {
            product.name = name || product.name;
            product.price = price || product.price;
            product.description = description || product.description;
            product.category = category || product.category;
            product.image = image || product.image;
            product.countInStock = countInStock || product.countInStock;

            const updatedProduct = await product.save();
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: "محصول پیدا نشد" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// API مشاهده همه سفارش‌ها (فقط ادمین)
app.get('/api/orders', protect, admin, async (req, res) => {
    try {
        // پیدا کردن همه سفارش‌ها و پر کردن اطلاعات کاربر (اسم و ایمیل) به جای آیدی
        const orders = await Order.find({}).populate('user', 'name email');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// API آپلود عکس (فقط ادمین)
app.post('/api/upload', protect, admin, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "هیچ فایلی ارسال نشد" });
    }
  res.json({ message: "عکس با موفقیت آپلود شد", image: "/" + req.file.path });  
});
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});