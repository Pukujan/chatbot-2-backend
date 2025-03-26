const admin = require('firebase-admin'); // Adjust path as needed

module.exports = async (req, res, next) => {
  try {
    console.log("Middleware executed");
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("No valid Authorization header found");
      return res.status(401).json({ error: "Unauthorized - No token provided" });
    }

    const token = authHeader.split(" ")[1];
    console.log("Backend Token:", token);

    if (!token) {
      console.log("Token is empty");
      return res.status(401).json({ error: "Unauthorized - Token is empty" });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);

    if (!decodedToken || !decodedToken.uid) {
      console.log("Invalid token or missing UID");
      return res.status(401).json({ error: "Unauthorized - Invalid token" });
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ error: "Unauthorized - Invalid token" });
  }
};