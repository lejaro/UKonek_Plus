const crypto = require('crypto');

const SESSION_COOKIE_NAME = 'ukonek_sid';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const sessions = new Map();
const isProduction = process.env.NODE_ENV === 'production';
const cookieSameSite = process.env.SESSION_COOKIE_SAMESITE || 'lax';

function shouldUseSecureCookie(req) {
    if (process.env.SESSION_COOKIE_SECURE === 'true') return true;
    if (process.env.SESSION_COOKIE_SECURE === 'false') return false;
    return isProduction && (req?.secure || req?.headers?.['x-forwarded-proto'] === 'https');
}

function parseCookies(cookieHeader = '') {
    return cookieHeader
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
            const [key, ...rest] = part.split('=');
            acc[key] = decodeURIComponent(rest.join('='));
            return acc;
        }, {});
}

function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sid, session] of sessions.entries()) {
        if (session.expiresAt <= now) {
            sessions.delete(sid);
        }
    }
}

function createSessionForUser(user) {
    cleanupExpiredSessions();
    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionId, {
        user,
        expiresAt: Date.now() + SESSION_TTL_MS
    });
    return sessionId;
}

function getSession(sessionId) {
    if (!sessionId) return null;
    const session = sessions.get(sessionId);
    if (!session) return null;

    if (session.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return null;
    }

    // Sliding expiration while user stays active.
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    return session;
}

function destroySession(sessionId) {
    if (!sessionId) return;
    sessions.delete(sessionId);
}

function clearSessionCookie(req, res) {
    res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        sameSite: cookieSameSite,
        secure: shouldUseSecureCookie(req),
        path: '/'
    });
}

function setSessionCookie(req, res, sessionId) {
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: cookieSameSite,
        secure: shouldUseSecureCookie(req),
        path: '/',
        maxAge: SESSION_TTL_MS
    });
}

function setNoCacheHeaders(res) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
}

function requireAuth(req, res, next) {
    setNoCacheHeaders(res);
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionId = cookies[SESSION_COOKIE_NAME];
    const session = getSession(sessionId);

    if (!session) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    req.sessionId = sessionId;
    req.sessionUser = session.user;
    return next();
}

function requirePageAuth(req, res, next) {
    setNoCacheHeaders(res);
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionId = cookies[SESSION_COOKIE_NAME];
    const session = getSession(sessionId);

    if (!session) {
        return res.redirect('/html/index.html');
    }

    req.sessionId = sessionId;
    req.sessionUser = session.user;
    return next();
}

function requireRole(...allowedRoles) {
    const normalizedAllowedRoles = allowedRoles
        .flat()
        .map((role) => String(role || '').trim().toLowerCase())
        .filter(Boolean);

    return (req, res, next) => {
        const currentRole = String(req.sessionUser?.role || '').trim().toLowerCase();
        if (!currentRole || !normalizedAllowedRoles.includes(currentRole)) {
            return res.status(403).json({ message: 'Forbidden: insufficient role privileges' });
        }

        return next();
    };
}

function requirePageRole(...allowedRoles) {
    const normalizedAllowedRoles = allowedRoles
        .flat()
        .map((role) => String(role || '').trim().toLowerCase())
        .filter(Boolean);

    return (req, res, next) => {
        const currentRole = String(req.sessionUser?.role || '').trim().toLowerCase();
        if (!currentRole || !normalizedAllowedRoles.includes(currentRole)) {
            return res.redirect('/html/index.html');
        }

        return next();
    };
}

module.exports = {
    SESSION_COOKIE_NAME,
    createSessionForUser,
    destroySession,
    setSessionCookie,
    clearSessionCookie,
    requireAuth,
    requirePageAuth,
    requireRole,
    requirePageRole,
    parseCookies
};
