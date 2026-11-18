const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      detail: 'Authentication credentials were not provided',
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.SECRET_KEY || 'labelguard_super_secret_dev_key_32bytes_min_for_hs256!'
    );

    const user = await User.findById(decoded.sub);
    if (!user) {
      return res.status(404).json({
        detail: 'User associated with token no longer exists',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        detail: 'User account has been deactivated',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        detail: 'Token has expired. Please log in again.',
      });
    }
    return res.status(401).json({
      detail: 'Invalid authentication token signature',
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({
      detail: 'Administrative privileges required for this action',
    });
  }
  next();
};

module.exports = { protect, requireAdmin };
