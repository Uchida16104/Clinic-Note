// Clinic Note - BASIC Authentication Middleware (JavaScript Pseudo)
// This middleware performs pseudo BASIC authentication on the backend using JavaScript

function basicAuthMiddleware(req, res, next) {
    try {
        // Get BASIC auth token from header
        const basicAuthHeader = req.headers['x-basic-auth'] || req.headers['authorization'];
        
        if (!basicAuthHeader) {
            return res.status(401).json({
                error: 'BASIC authentication required',
                message: 'Please provide BASIC authentication credentials'
            });
        }

        // Extract token
        let token = basicAuthHeader;
        if (basicAuthHeader.startsWith('Basic ')) {
            token = basicAuthHeader.substring(6);
        }

        // Decode token
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [username, password] = decoded.split(':');

        // Verify credentials
        const expectedUsername = process.env.BASIC_USER || 'admin';
        const expectedPassword = process.env.BASIC_PASSWORD || 'secure_password_123';

        if (username !== expectedUsername || password !== expectedPassword) {
            return res.status(401).json({
                error: 'Invalid BASIC authentication',
                message: 'Incorrect username or password'
            });
        }

        // Authentication successful
        req.basicAuth = {
            username: username,
            authenticated: true
        };

        next();
    } catch (err) {
        console.error('BASIC auth error:', err);
        return res.status(401).json({
            error: 'BASIC authentication failed',
            message: 'Invalid authentication format'
        });
    }
}

// Optional: Middleware for routes that don't require BASIC auth
function optionalBasicAuth(req, res, next) {
    try {
        const basicAuthHeader = req.headers['x-basic-auth'] || req.headers['authorization'];
        
        if (basicAuthHeader) {
            let token = basicAuthHeader;
            if (basicAuthHeader.startsWith('Basic ')) {
                token = basicAuthHeader.substring(6);
            }

            const decoded = Buffer.from(token, 'base64').toString('utf-8');
            const [username, password] = decoded.split(':');

            const expectedUsername = process.env.BASIC_USER || 'admin';
            const expectedPassword = process.env.BASIC_PASSWORD || 'secure_password_123';

            if (username === expectedUsername && password === expectedPassword) {
                req.basicAuth = {
                    username: username,
                    authenticated: true
                };
            }
        }

        next();
    } catch (err) {
        console.error('Optional BASIC auth error:', err);
        next();
    }
}

module.exports = basicAuthMiddleware;
module.exports.optionalBasicAuth = optionalBasicAuth;
