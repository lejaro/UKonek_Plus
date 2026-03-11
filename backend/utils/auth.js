const bcrypt = require('bcryptjs');

/**
 * Hashes a password using bcryptjs.
 * @param {string} password 
 * @returns {Promise<string>}
 */
exports.hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

/**
 * Compares a plain text password with a hashed password.
 * @param {string} password 
 * @param {string} hashedPassword 
 * @returns {Promise<boolean>}
 */
exports.comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};
