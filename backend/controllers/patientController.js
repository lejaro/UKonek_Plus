const { registerUser } = require('../utils/dbHelpers');

// Register a new patient account
exports.registerPatient = async (req, res) => {
    try {
        const result = await registerUser('patients', req.body);
        if (!result.success) {
            return res.status(result.status).json({ message: result.message });
        }
        res.status(result.status).json({ message: result.message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An unexpected error occurred" });
    }
};
