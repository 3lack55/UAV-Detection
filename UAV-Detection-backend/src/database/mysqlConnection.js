import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'uav_detection',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection()
    .then(connection => {
        console.log(`Connected to MySQL successfully! (Thread ID: ${connection.threadId})`);
        connection.release();
    })
    .catch(err => {
        console.error('Error connecting to MySQL database:', err.message);
    });

export async function doQuery(sql, params = []) {
    try {
        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        console.error(`[MySQL Query Error] ${error.message} \nSQL: ${sql}`);
        throw error;
    }
}

export default pool;