const db = require('../config/db');
const { hashPassword } = require('./auth');

/**
 * Maps database errors to user-friendly messages.
 * @param {Error} error - The database error object.
 * @returns {object} - An object containing message and status.
 */
const handleDbError = (error) => {
    if (error.code === 'ER_DUP_ENTRY') {
        const fieldMatch = error.sqlMessage.match(/for key '(.+)\.(.+)'/) || error.sqlMessage.match(/for key '(.+)'/);
        const fieldName = fieldMatch ? fieldMatch[fieldMatch.length - 1] : 'field';
        return {
            message: `${fieldName.replace(/_/g, ' ')} already exists`,
            status: 409
        };
    }
    return {
        message: "Database error occurred",
        status: 500
    };
};

/**
 * Generic function to check if a unique field exists and insert a new user record.
 * @param {string} tableName - The name of the table to insert into.
 * @param {object} userData - An object containing user data fields.
 * @param {string} uniqueField - The field to check for uniqueness (default: 'email').
 * @returns {object} - An object indicating success or failure.
 */
exports.registerUser = async (tableName, userData, uniqueField = 'email') => {
    try {
        const uniqueValue = userData[uniqueField];

        // Check if unique value already exists
        const [existingUser] = await db.query(
            `SELECT id FROM ?? WHERE ?? = ?`,
            [tableName, uniqueField, uniqueValue]
        );

        if (existingUser.length > 0) {
            return {
                success: false,
                message: `${uniqueField.replace('_', ' ')} already registered`,
                status: 400
            };
        }

        // Hash password if present and remove non-DB fields
        const dataToInsert = { ...userData };
        delete dataToInsert.confirmPassword;
        if (dataToInsert.password) {
            dataToInsert.password_hash = await hashPassword(dataToInsert.password);
            delete dataToInsert.password;
        }

        // Prepare columns and values dynamically
        const columns = Object.keys(dataToInsert);
        const values = Object.values(dataToInsert);
        const placeholders = columns.map(() => '?').join(', ');

        const sql = `INSERT INTO ?? (??) VALUES (${placeholders})`;
        await db.query(sql, [tableName, columns, ...values]);

        return { success: true, message: `${tableName.replace('_', ' ')} registered successfully`, status: 201 };
    } catch (error) {
        console.error(`Error in registerUser (${tableName}):`, error);
        const dbError = handleDbError(error);
        return { success: false, ...dbError };
    }
};

exports.handleDbError = handleDbError;

/**
 * Checks if a value exists in a specific table for a specific field.
 */
exports.checkFieldExists = async (tableName, field, value) => {
    const [existing] = await db.query(
        `SELECT id FROM ?? WHERE ?? = ?`,
        [tableName, field, value]
    );
    return existing.length > 0;
};
