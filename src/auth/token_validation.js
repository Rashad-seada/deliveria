const jwt = require("jsonwebtoken");
module.exports = {
  checkToken: (req, res, next) => {
    let token = req.get("authorization");
    if (token) {
      token = token.slice(7);

      jwt.verify(token, process.env.JWT_KEY, (err, decoded) => {
        if (err) {
          console.log(err);
          return res.json({
            success: 0,
            message: "Invalid Token..."
          });
        } else {
          req.body.decoded = decoded;
          next();
        }
      });
    } else {
      return res.json({
        success: 0,
        message: "Access Denied! Unauthorized User"
      });
    }
  }
};