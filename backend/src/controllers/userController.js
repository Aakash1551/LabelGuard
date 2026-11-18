const User = require('../models/User');

// @desc    List all system users (Admin only)
// @route   GET /api/v1/users
const listUsers = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 100;

    const users = await User.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return res.status(200).json(
      users.map((u) => ({
        id: u._id.toString(),
        email: u.email,
        full_name: u.fullName,
        role: u.role,
        is_active: u.isActive,
        created_at: u.createdAt,
        updated_at: u.updatedAt,
      }))
    );
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Update user account (Admin only)
// @route   PUT /api/v1/users/:id
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    const { full_name, fullName, role, is_active, isActive, password } = req.body;

    if (full_name !== undefined || fullName !== undefined) {
      user.fullName = (full_name || fullName).trim();
    }
    if (role !== undefined) {
      user.role = role;
    }
    if (is_active !== undefined || isActive !== undefined) {
      user.isActive = is_active !== undefined ? is_active : isActive;
    }
    if (password) {
      user.password = password;
    }

    await user.save();

    return res.status(200).json({
      id: user._id.toString(),
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      is_active: user.isActive,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

module.exports = { listUsers, updateUser };
