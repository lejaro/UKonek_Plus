const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2');
const { hashPassword } = require('./utils/auth');

function initializeDatabase() {
    const connection = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    connection.connect((err) => {
        if (err) {
            console.error('✗ Connection failed:', err.message);
            process.exit(1);
        }
        console.log('✓ Connected to MySQL');

        // Helper to recreate table
        function recreateTable(tableName, sql, next) {
            console.log(`Dropping and recreating ${tableName} table...`);
            connection.query(`DROP TABLE IF EXISTS ${tableName}`, (err) => {
                if (err) {
                    console.error(`✗ Error dropping ${tableName} table:`, err.message);
                    connection.end();
                    process.exit(1);
                }
                connection.query(sql, (err) => {
                    if (err) {
                        console.error(`✗ Error creating ${tableName} table:`, err.message);
                        connection.end();
                        process.exit(1);
                    }
                    console.log(`✓ ${tableName} table created`);
                    if (next) next();
                });
            });
        }

        const staffSql = `
            CREATE TABLE staff (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                employee_id VARCHAR(100) UNIQUE NOT NULL,
                role VARCHAR(100) NOT NULL,
                specialization VARCHAR(255) DEFAULT NULL,
                schedule VARCHAR(255) DEFAULT NULL,
                status VARCHAR(50) DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        const pendingSql = `
            CREATE TABLE pending_staff (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                employee_id VARCHAR(100) UNIQUE NOT NULL,
                role VARCHAR(100) NOT NULL,
                specialization VARCHAR(255) DEFAULT NULL,
                schedule VARCHAR(255) DEFAULT NULL,
                status VARCHAR(50) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        const patientsSql = `
            CREATE TABLE patients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                firstname VARCHAR(100) NOT NULL,
                surname VARCHAR(100) NOT NULL,
                middle_initial VARCHAR(10) DEFAULT NULL,
                date_of_birth DATE DEFAULT NULL,
                age INT DEFAULT NULL,
                contact_number VARCHAR(30) DEFAULT NULL,
                sex VARCHAR(10) DEFAULT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                complete_address VARCHAR(255) DEFAULT NULL,
                emergency_contact_complete_name VARCHAR(200) DEFAULT NULL,
                emergency_contact_contact_number VARCHAR(30) DEFAULT NULL,
                relation VARCHAR(100) DEFAULT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'patient',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        recreateTable('staff', staffSql, () => {
            recreateTable('pending_staff', pendingSql, () => {
                recreateTable('patients', patientsSql, () => {
                    seedAdmin(connection);
                });
            });
        });

        async function seedAdmin(connection) {
            console.log('Seeding initial admin account...');
            try {
                const password_hash = await hashPassword('admin123');
                const sql = `
                    INSERT INTO staff (username, password_hash, employee_id, role, status)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE username=username
                `;
                connection.query(sql, ['admin', password_hash, 'ADM-001', 'admin', 'Active'], (err) => {
                    if (err) {
                        console.error('✗ Error seeding admin:', err.message);
                    } else {
                        console.log('✓ Initial admin account created (admin/admin123)');
                    }
                    console.log('\n✓ Database initialization complete!');
                    connection.end();
                });
            } catch (err) {
                console.error('✗ Error hashing password:', err.message);
                connection.end();
            }
        }
    });
}

initializeDatabase();
