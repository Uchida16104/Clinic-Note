const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: '認証トークンが必要です' });
        }
        
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        req.user = {
            userId: decoded.userId,
            username: decoded.username
        };
        
        next();
    } catch (err) {
        console.error('Token verification error:', err);
        return res.status(401).json({ error: '認証に失敗しました' });
    }
}

function verifyToken(req, res, next) {
    return authenticateToken(req, res, next);
}

module.exports = {
    authenticateToken,
    verifyToken
};
