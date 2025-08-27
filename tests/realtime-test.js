const io = require('socket.io-client');
const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:4051';
const SOCKET_URL = 'http://localhost:4051';

// Test user credentials
const TEST_USER = {
  email: 'test@school.edu',
  password: 'testpass123'
};

// Connect to WebSocket
async function connectWebSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('✓ WebSocket connected');
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      reject(error);
    });
  });
}

// Simulate real-time activity
async function sendRealtimeActivity(socket, activity) {
  return new Promise((resolve) => {
    socket.emit('activity:realtime', activity);
    
    // Listen for the broadcast
    socket.once('activity:update', (data) => {
      console.log('✓ Received activity update:', {
        userId: data.userId,
        app: data.activity.app_name,
        category: data.activity.category
      });
      resolve(data);
    });
  });
}

// Main test
async function testRealtimeUpdates() {
  console.log('\n=== Testing Real-time WebSocket Updates ===\n');

  try {
    // 1. Login to get auth token
    const loginResponse = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, TEST_USER);
    const token = loginResponse.data.accessToken;
    console.log('✓ Logged in successfully');

    // 2. Connect to WebSocket
    const socket = await connectWebSocket(token);

    // 3. Send test activities
    const testActivities = [
      {
        app_name: 'Visual Studio Code',
        window_title: 'index.js - project',
        start_time: new Date().toISOString(),
        duration: 60,
        is_idle: false
      },
      {
        app_name: 'Discord',
        window_title: 'General Chat',
        start_time: new Date().toISOString(),
        duration: 30,
        is_idle: false
      },
      {
        app_name: 'Google Chrome',
        window_title: 'Khan Academy',
        url: 'https://khanacademy.org',
        start_time: new Date().toISOString(),
        duration: 120,
        is_idle: false
      }
    ];

    console.log('\n📡 Sending real-time activities...\n');

    for (const activity of testActivities) {
      await sendRealtimeActivity(socket, activity);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between activities
    }

    console.log('\n✅ Real-time test completed successfully!');
    console.log('\n📊 Check the admin dashboard at http://localhost:4051/admin-dashboard.html');
    console.log('You should see:');
    console.log('- Live Activity Feed showing the 3 activities');
    console.log('- Active Now count increased');
    console.log('- Green pulsing indicator next to "Live Activity Feed"');

    // Keep connection open for a bit to see updates
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testRealtimeUpdates();