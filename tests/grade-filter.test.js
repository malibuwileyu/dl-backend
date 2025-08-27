const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:4051/api/v1';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';

// Test users with different grades
const TEST_USERS = [
  { email: 'freshman1@school.edu', password: 'pass123', grade: 9 },
  { email: 'sophomore1@school.edu', password: 'pass123', grade: 10 },
  { email: 'junior1@school.edu', password: 'pass123', grade: 11 },
  { email: 'senior1@school.edu', password: 'pass123', grade: 12 }
];

// Register test users with grades
async function registerUsers() {
  console.log('📝 Registering test users with grades...\n');
  
  for (const user of TEST_USERS) {
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, {
        ...user,
        organizationId: '1',
        role: 'student'
      });
      console.log(`✓ Registered ${user.email} (Grade ${user.grade})`);
    } catch (error) {
      if (error.response?.status === 409) {
        console.log(`⚠️  User ${user.email} already exists`);
      } else {
        console.error(`❌ Failed to register ${user.email}:`, error.response?.data || error.message);
      }
    }
  }
}

// Test grade filtering
async function testGradeFiltering() {
  console.log('\n=== Testing Grade-based Filtering ===\n');

  try {
    // 1. Register users
    await registerUsers();

    // 2. Test filtering for each grade
    for (let grade = 9; grade <= 12; grade++) {
      console.log(`\n📊 Testing Grade ${grade} filter...`);
      
      const response = await axios.get(
        `${API_BASE_URL}/admin/productivity-analysis?group=grade-${grade}`,
        { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
      );

      const data = response.data;
      console.log(`Students in Grade ${grade}: ${data.students.length}`);
      
      // Show student details
      data.students.forEach(student => {
        console.log(`  - ${student.email} (Grade ${student.grade || 'N/A'})`);
      });
    }

    // 3. Test 'all' filter
    console.log(`\n📊 Testing 'all' filter...`);
    const allResponse = await axios.get(
      `${API_BASE_URL}/admin/productivity-analysis?group=all`,
      { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
    );

    console.log(`Total students: ${allResponse.data.students.length}`);

    // 4. Show grade distribution
    const gradeCount = {};
    allResponse.data.students.forEach(student => {
      const grade = student.grade || 'No Grade';
      gradeCount[grade] = (gradeCount[grade] || 0) + 1;
    });

    console.log('\n📈 Grade Distribution:');
    Object.entries(gradeCount).forEach(([grade, count]) => {
      console.log(`  Grade ${grade}: ${count} students`);
    });

    console.log('\n✅ Grade filtering test completed!');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.response?.data || error.message);
  }
}

// Manual testing instructions
console.log(`
📋 Manual Testing Steps:

1. Run the migration to add grade field:
   docker exec -it student-time-tracker-postgres psql -U postgres -d student_tracker -f /migrations/020_add_grade_to_users.sql

2. Run this test:
   node tests/grade-filter.test.js

3. Check the productivity analysis page:
   - Open http://localhost:4051/productivity-analysis.html
   - Try the grade filters (Grade 9, 10, 11, 12)
   - Verify students are filtered correctly

4. Test in StudentTimeTracker app:
   - Register a new user with grade selection
   - Check if grade appears in user profile
`);

// Run the test
testGradeFiltering();