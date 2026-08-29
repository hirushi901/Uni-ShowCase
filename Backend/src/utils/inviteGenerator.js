const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

const generateInviteToken = (role, email = '') => {
  return jwt.sign({ role, email, type: 'INVITE' }, JWT_SECRET, { expiresIn: '7d' });
};

const verifyInviteToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'INVITE') throw new Error('Invalid token type');
    return decoded;
  } catch (error) {
    return null;
  }
};

const generateUserToken = (user) => {
  return jwt.sign({ id: user._id || user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
};

module.exports = {
  generateInviteToken,
  verifyInviteToken,
  generateUserToken
};
