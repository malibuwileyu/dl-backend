import 'dotenv/config';
import { faker } from '@faker-js/faker';
import { getPool } from '../src/config/database';
import { connectDatabase } from '../src/config/database';
import { logger } from '../src/config/logger';
import bcrypt from 'bcrypt';

// Common academic and non-academic apps
const PRODUCTIVE_APPS = [
  'Google Docs', 'Microsoft Word', 'VS Code', 'Xcode', 'Terminal',
  'Khan Academy', 'Coursera', 'EdX', 'Notion', 'Obsidian',
  'Anki', 'Quizlet', 'Wolfram Alpha', 'MATLAB', 'RStudio'
];

const NEUTRAL_APPS = [
  'Safari', 'Chrome', 'Firefox', 'Slack', 'Zoom',
  'Microsoft Teams', 'Mail', 'Calendar', 'Finder', 'Preview'
];

const DISTRACTING_APPS = [
  'Discord', 'Twitter', 'Instagram', 'TikTok', 'YouTube',
  'Netflix', 'Spotify', 'Steam', 'Minecraft', 'Among Us',
  'Reddit', 'Facebook', 'Snapchat', 'Twitch', 'Pinterest'
];

interface StudentProfile {
  type: 'excellent' | 'good' | 'average' | 'struggling';
  productivityRange: [number, number];
  dailyHoursRange: [number, number];
  grade: number;
}

const STUDENT_PROFILES: Record<string, StudentProfile> = {
  excellent: {
    type: 'excellent',
    productivityRange: [85, 95],
    dailyHoursRange: [4, 6],
    grade: 11
  },
  good: {
    type: 'good',
    productivityRange: [70, 84],
    dailyHoursRange: [3, 5],
    grade: 10
  },
  average: {
    type: 'average',
    productivityRange: [50, 69],
    dailyHoursRange: [2, 4],
    grade: 10
  },
  struggling: {
    type: 'struggling',
    productivityRange: [20, 49],
    dailyHoursRange: [1, 3],
    grade: 9
  }
};

async function generateTestData() {
  try {
    await connectDatabase();
    const pool = getPool();
    
    logger.info('Starting test data generation...');
    
    // Create or get organization
    let organizationId;
    const existingOrg = await pool.query(`
      SELECT id FROM organizations WHERE name = 'Demo High School'
    `);
    
    if (existingOrg.rows.length > 0) {
      organizationId = existingOrg.rows[0].id;
    } else {
      const orgResult = await pool.query(`
        INSERT INTO organizations (name)
        VALUES ('Demo High School')
        RETURNING id
      `);
      organizationId = orgResult.rows[0].id;
    }
    
    logger.info(`Using organization ID: ${organizationId}`);
    
    // Generate 100 students
    const students = [];
    const hashedPassword = await bcrypt.hash('demo123', 10);
    
    for (let i = 1; i <= 100; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@demo.school`;
      
      // Distribute students across profiles
      let profile: StudentProfile;
      if (i <= 10) profile = STUDENT_PROFILES.excellent; // 10% excellent
      else if (i <= 30) profile = STUDENT_PROFILES.good; // 20% good  
      else if (i <= 70) profile = STUDENT_PROFILES.average; // 40% average
      else profile = STUDENT_PROFILES.struggling; // 30% struggling
      
      // Assign grades with some variation
      const gradeVariation = Math.floor(Math.random() * 4); // 0-3
      const grade = Math.min(12, Math.max(9, profile.grade + gradeVariation - 1));
      
      const userResult = await pool.query(`
        INSERT INTO users (email, name, password, role, organization_id, grade, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (email) DO UPDATE SET grade = $6
        RETURNING id, email, name, grade
      `, [email, `${firstName} ${lastName}`, hashedPassword, 'student', organizationId, grade]);
      
      students.push({
        ...userResult.rows[0],
        profile: profile.type
      });
      
      if (i % 10 === 0) {
        logger.info(`Created ${i} students...`);
      }
    }
    
    logger.info(`Created ${students.length} test students`);
    
    // Insert app categories if not exists
    const appCategories = [
      ...PRODUCTIVE_APPS.map(app => ({ app, category: 'productive' })),
      ...NEUTRAL_APPS.map(app => ({ app, category: 'neutral' })),
      ...DISTRACTING_APPS.map(app => ({ app, category: 'distracting' }))
    ];
    
    for (const { app, category } of appCategories) {
      await pool.query(`
        INSERT INTO app_categories (app_name, category, organization_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (app_name, organization_id) DO NOTHING
      `, [app, category, organizationId]);
    }
    
    logger.info('App categories inserted');
    
    // Generate activities for the past 7 days
    const now = new Date();
    const activities = [];
    
    for (const student of students) {
      const profile = STUDENT_PROFILES[student.profile];
      
      // Generate activities for past 7 days
      for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);
        date.setHours(8, 0, 0, 0); // Start at 8 AM
        
        // Random daily hours within profile range
        const dailyHours = faker.number.float({
          min: profile.dailyHoursRange[0],
          max: profile.dailyHoursRange[1],
          fractionDigits: 1
        });
        
        // Random productivity within profile range
        const targetProductivity = faker.number.int({
          min: profile.productivityRange[0],
          max: profile.productivityRange[1]
        });
        
        let hoursLogged = 0;
        const dayActivities = [];
        
        while (hoursLogged < dailyHours) {
          // Pick app based on target productivity
          const rand = Math.random() * 100;
          let app: string;
          
          if (rand < targetProductivity) {
            app = faker.helpers.arrayElement(PRODUCTIVE_APPS);
          } else if (rand < targetProductivity + 20) {
            app = faker.helpers.arrayElement(NEUTRAL_APPS);
          } else {
            app = faker.helpers.arrayElement(DISTRACTING_APPS);
          }
          
          // Session duration (5 minutes to 2 hours)
          const duration = faker.number.float({ min: 0.083, max: 2, fractionDigits: 2 });
          const actualDuration = Math.min(duration, dailyHours - hoursLogged);
          
          const startTime = new Date(date);
          startTime.setHours(
            startTime.getHours() + Math.floor(hoursLogged),
            Math.floor((hoursLogged % 1) * 60)
          );
          
          const endTime = new Date(startTime);
          endTime.setHours(
            endTime.getHours() + Math.floor(actualDuration),
            endTime.getMinutes() + Math.floor((actualDuration % 1) * 60)
          );
          
          dayActivities.push({
            userId: student.id,
            appName: app,
            startTime: startTime,
            endTime: endTime,
            isIdle: false
          });
          
          hoursLogged += actualDuration;
        }
        
        activities.push(...dayActivities);
      }
      
      if (student.id % 10 === 0) {
        logger.info(`Generated activities for ${student.id} students...`);
      }
    }
    
    logger.info(`Generated ${activities.length} activities, inserting...`);
    
    // Batch insert activities
    const batchSize = 1000;
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      
      const values = batch.map((a, idx) => {
        const offset = idx * 5;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
      }).join(', ');
      
      const params = batch.flatMap(a => [
        a.userId,
        a.appName,
        a.startTime.toISOString(),
        a.endTime.toISOString(),
        a.isIdle
      ]);
      
      await pool.query(`
        INSERT INTO activities (user_id, app_name, start_time, end_time, is_idle)
        VALUES ${values}
      `, params);
      
      logger.info(`Inserted activities batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activities.length / batchSize)}`);
    }
    
    // Summary
    const summaryResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT u.id) as student_count,
        COUNT(DISTINCT a.id) as activity_count,
        MIN(a.start_time) as earliest_activity,
        MAX(a.end_time) as latest_activity,
        AVG(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 3600) as avg_session_hours
      FROM users u
      LEFT JOIN activities a ON u.id = a.user_id
      WHERE u.role = 'student' AND u.organization_id = $1
    `, [organizationId]);
    
    const summary = summaryResult.rows[0];
    
    logger.info('Test data generation complete!');
    logger.info(`Summary:
      - Students: ${summary.student_count}
      - Activities: ${summary.activity_count}
      - Date range: ${summary.earliest_activity} to ${summary.latest_activity}
      - Avg session: ${parseFloat(summary.avg_session_hours).toFixed(2)} hours
    `);
    
    // Show grade distribution
    const gradeResult = await pool.query(`
      SELECT grade, COUNT(*) as count
      FROM users
      WHERE role = 'student' AND organization_id = $1
      GROUP BY grade
      ORDER BY grade
    `, [organizationId]);
    
    logger.info('Grade distribution:');
    gradeResult.rows.forEach(row => {
      logger.info(`  Grade ${row.grade}: ${row.count} students`);
    });
    
    process.exit(0);
  } catch (error) {
    logger.error('Error generating test data:', error);
    process.exit(1);
  }
}

// Run the script
generateTestData();