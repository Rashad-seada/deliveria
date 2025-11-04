const jwt = require("jsonwebtoken");

module.exports = {
  checkToken: (req, res, next) => {
    let token = req.get("authorization") || req.headers["authorization"];
    
    if (!token) {
      return res.status(401).json({
        success: 0,
        message: "Access Denied! No token provided"
      });
    }

    // إزالة "Bearer " إذا موجود
    if (token.startsWith("Bearer ")) {
      token = token.slice(7);
    }

    // التحقق من صحة التوكن
    jwt.verify(token, process.env.JWT_KEY, (err, decoded) => {
      if (err) {
        console.log("Token verification error:", err);
        return res.status(401).json({
          success: 0,
          message: "Invalid Token"
        });
      } else {
        // تخزين البيانات المفكوكة في req بدلاً من req.body
        req.decoded = decoded;
        next();
      }
    });
  }
};