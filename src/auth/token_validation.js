const jwt = require("jsonwebtoken");

const checkToken = (req, res, next) => {
  let token = req.get("authorization") || req.headers["authorization"];

  if (!token) {
    return res.status(401).json({
      success: 0,
      message: "Access Denied! No token provided"
    });
  }

  // Remove "Bearer " if present
  if (token.startsWith("Bearer ")) {
    token = token.slice(7);
  }

  // Verify token
  jwt.verify(token, process.env.JWT_KEY, (err, decoded) => {
    if (err) {
      console.log("Token verification error:", err);
      return res.status(401).json({
        success: 0,
        message: "Invalid Token"
      });
    } else {
      // Store decoded data in req
      req.decoded = decoded;
      next();
    }
  });
};

const isAdmin = (req, res, next) => {
  if (req.decoded && req.decoded.user_type === 'Admin') {
    next();
  } else {
    return res.status(403).json({
      success: 0,
      message: "Access Denied! Admins only"
    });
  }
};

const isUser = (req, res, next) => {
  // Allow if user_type is 'User' OR if it's an Admin (admins can view user routes often, but strictly speaking 'isUser' implies customer)
  // For loyalty, only customers (Users) have points.
  if (req.decoded && req.decoded.user_type === 'User') {
    next();
  } else {
    return res.status(403).json({
      success: 0,
      message: "Access Denied! Users only"
    });
  }
};

module.exports = {
  checkToken,
  verifyToken: checkToken, // Alias for consistency
  isAdmin,
  isUser,

  // Optional token check (for Guest Mode)
  // If token exists and is valid -> req.decoded = user
  // If token missing or invalid -> req.decoded = null (continue as guest)
  optionalCheckToken: (req, res, next) => {
    let token = req.get("authorization") || req.headers["authorization"];

    if (!token) {
      req.decoded = null;
      return next();
    }

    // Remove "Bearer " if present
    if (token.startsWith("Bearer ")) {
      token = token.slice(7);
    }

    // Verify token
    jwt.verify(token, process.env.JWT_KEY, (err, decoded) => {
      if (err) {
        // Invalid token? Just treat as guest
        req.decoded = null;
      } else {
        req.decoded = decoded;
      }
      next();
    });
  }
};