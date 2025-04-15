// Middleware для проверки авторизации пользователя

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { 
            id: decoded.userId
        };
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};