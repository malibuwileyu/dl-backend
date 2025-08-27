import 'dotenv/config';
import { getPool } from '../src/config/database';
import { connectDatabase } from '../src/config/database';
import { logger } from '../src/config/logger';

async function deleteTestData() {
  try {
    await connectDatabase();
    const pool = getPool();
    
    logger.info('Starting test data deletion...');
    
    // Get all test student IDs
    const testStudentsResult = await pool.query(`
      SELECT id, email FROM users 
      WHERE role = 'student' 
      AND (email LIKE '%@demo.school' OR email LIKE '%@superbuilders.school')
    `);
    
    const studentIds = testStudentsResult.rows.map(r => r.id);
    const studentCount = studentIds.length;
    
    logger.info(`Found ${studentCount} test students to delete`);
    
    if (studentCount === 0) {
      logger.info('No test students found');
      process.exit(0);
    }
    
    // Delete in correct order to avoid foreign key constraints
    
    // 1. Delete activities
    const activitiesResult = await pool.query(`
      DELETE FROM activities 
      WHERE user_id = ANY($1)
      RETURNING id
    `, [studentIds]);
    logger.info(`Deleted ${activitiesResult.rowCount} activities`);
    
    // 2. Delete alerts
    const alertsResult = await pool.query(`
      DELETE FROM alerts 
      WHERE user_id = ANY($1)
      RETURNING id
    `, [studentIds]);
    logger.info(`Deleted ${alertsResult.rowCount} alerts`);
    
    // 3. Delete refresh tokens
    const tokensResult = await pool.query(`
      DELETE FROM refresh_tokens 
      WHERE user_id = ANY($1)
      RETURNING id
    `, [studentIds]);
    logger.info(`Deleted ${tokensResult.rowCount} refresh tokens`);
    
    // 4. Delete any other user-related data
    // Add more tables here if needed
    
    // 5. Finally delete users
    const usersResult = await pool.query(`
      DELETE FROM users 
      WHERE id = ANY($1)
      RETURNING id, email
    `, [studentIds]);
    logger.info(`Deleted ${usersResult.rowCount} test students`);
    
    // Optionally clean up demo organization
    const demoOrgResult = await pool.query(`
      DELETE FROM organizations 
      WHERE name = 'Demo High School'
      RETURNING id
    `);
    if (demoOrgResult.rowCount > 0) {
      logger.info('Deleted Demo High School organization');
    }
    
    logger.info('Test data deletion complete!');
    
    // Show remaining students
    const remainingResult = await pool.query(`
      SELECT COUNT(*) as count FROM users WHERE role = 'student'
    `);
    logger.info(`Remaining students in database: ${remainingResult.rows[0].count}`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Error deleting test data:', error);
    process.exit(1);
  }
}

// Run the script
deleteTestData();