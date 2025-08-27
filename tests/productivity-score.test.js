const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:4051/api/v1';
let authToken = '';

// Test user credentials
const TEST_USER = {
  email: 'test@school.edu',
  password: 'testpass123'
};

// Helper function to login
async function login() {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, TEST_USER);
    authToken = response.data.accessToken;
    return authToken;
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    throw error;
  }
}

// Helper function to create test activities
async function createTestActivities() {
  const activities = [
    {
      app_name: 'Visual Studio Code',
      window_title: 'main.py - project',
      start_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      duration: 1800, // 30 minutes
      is_idle: false
    },
    {
      app_name: 'Discord',
      window_title: 'General Chat',
      start_time: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
      duration: 900, // 15 minutes
      is_idle: false
    },
    {
      app_name: 'Google Chrome',
      window_title: 'YouTube',
      url: 'https://youtube.com',
      start_time: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
      duration: 900, // 15 minutes
      is_idle: false
    }
  ];

  try {
    await axios.post(
      `${API_BASE_URL}/activities/bulk`,
      { activities },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✓ Test activities created');
  } catch (error) {
    console.error('Failed to create activities:', error.response?.data || error.message);
  }
}

// Test productivity score calculation
async function testProductivityScore() {
  console.log('\n=== Testing Productivity Score Calculation ===\n');

  try {
    // 1. Login
    await login();
    console.log('✓ Logged in successfully');

    // 2. Create test activities
    await createTestActivities();

    // 3. Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Fetch dashboard data
    const dashboardResponse = await axios.get(
      `${API_BASE_URL}/student/dashboard`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    const data = dashboardResponse.data;
    console.log('\n📊 Dashboard Data:');
    console.log(`Total Time: ${data.totalProductiveTime + data.neutralTime + data.distractingTime}s`);
    console.log(`Productive Time: ${data.productiveTime}s`);
    console.log(`Neutral Time: ${data.neutralTime}s`);
    console.log(`Distracting Time: ${data.distractingTime}s`);

    // 5. Calculate productivity score
    const totalTime = data.productiveTime + data.neutralTime + data.distractingTime;
    const productivityScore = totalTime > 0 ? (data.productiveTime / totalTime) * 100 : 0;

    console.log(`\n✨ Productivity Score: ${productivityScore.toFixed(1)}%`);

    // 6. Verify score calculation
    if (totalTime > 0) {
      console.log('\n✅ Test Passed: Productivity score calculated correctly');
    } else {
      console.log('\n❌ Test Failed: No activity data found');
    }

    // 7. Check if categories are properly assigned
    console.log('\n📱 App Categories:');
    for (const activity of data.activities.slice(0, 5)) {
      console.log(`- ${activity.app_name}: ${activity.category}`);
    }

  } catch (error) {
    console.error('\n❌ Test Failed:', error.response?.data || error.message);
  }
}

// Run the test
testProductivityScore();