const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (user) => {
  const secret = process.env.SECRET_KEY || 'labelguard_super_secret_dev_key_32bytes_min_for_hs256!';
  const expiresIn = process.env.ACCESS_TOKEN_EXPIRE_MINUTES
    ? `${parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES, 10)}m`
    : '1440m';

  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      type: 'access_token',
    },
    secret,
    { expiresIn }
  );
};

// @desc    Authenticate user & get token
// @route   POST /api/v1/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ detail: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ detail: 'Incorrect email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ detail: 'Account is inactive. Contact an administrator.' });
    }

    const accessToken = generateToken(user);

    return res.status(200).json({
      access_token: accessToken,
      token_type: 'bearer',
      role: user.role,
      user_id: user._id.toString(),
      email: user.email,
      full_name: user.fullName,
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Register a new user (Inspector)
// @route   POST /api/v1/auth/register
const register = async (req, res) => {
  try {
    const { email, password, full_name, fullName } = req.body;
    const name = full_name || fullName;

    if (!email || !password || !name) {
      return res.status(422).json({ detail: 'Email, password, and full name are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ detail: 'A user with this email address already exists.' });
    }

    const newUser = await User.create({
      email: email.toLowerCase().trim(),
      password,
      fullName: name.trim(),
      role: 'INSPECTOR',
      isActive: true,
    });

    return res.status(201).json({
      id: newUser._id.toString(),
      email: newUser.email,
      full_name: newUser.fullName,
      role: newUser.role,
      is_active: newUser.isActive,
      created_at: newUser.createdAt,
      updated_at: newUser.updatedAt,
    });
  } catch (err) {
    return res.status(400).json({ detail: err.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/v1/auth/me
const getMe = async (req, res) => {
  return res.status(200).json({
    id: req.user._id.toString(),
    email: req.user.email,
    full_name: req.user.fullName,
    role: req.user.role,
    is_active: req.user.isActive,
    created_at: req.user.createdAt,
    updated_at: req.user.updatedAt,
  });
};

module.exports = { login, register, getMe };
