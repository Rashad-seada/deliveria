
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('./src/models/Admin');
require('dotenv').config();

// --- قم بتعديل هذه البيانات ---
const ADMIN_PHONE = '01000000000'; //  ضع رقم هاتف المدير هنا
const ADMIN_PASSWORD = 'admin_password_123'; // ضع كلمة مرور قوية هنا
// --------------------------

const createAdmin = async () => {
  try {
    // 1. الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGO_URL);
    console.log('MongoDB connected successfully.');

    // 2. التحقق من وجود المدير مسبقاً
    const existingAdmin = await Admin.findOne({ phone: ADMIN_PHONE });
    if (existingAdmin) {
      console.log('Admin with this phone number already exists.');
      mongoose.connection.close();
      return;
    }

    // 3. تشفير كلمة المرور
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

    // 4. إنشاء حساب المدير الجديد
    const newAdmin = new Admin({
      phone: ADMIN_PHONE,
      password: hashedPassword,
      user_name: "admin" // يمكنك تغييره إذا أردت
    });

    // 5. حفظ المدير في قاعدة البيانات
    await newAdmin.save();
    console.log('Admin account created successfully!');
    console.log(`Phone: ${ADMIN_PHONE}`);
    console.log('Password: (the one you set in the script)');

  } catch (error) {
    console.error('Error creating admin account:', error);
  } finally {
    // 6. إغلاق الاتصال
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
};

createAdmin();
