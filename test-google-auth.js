const fetch = require('node-fetch');

async function testGoogleAuth() {
  try {
    const response = await fetch('http://localhost:4051/api/v1/auth/google/exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'StudentTimeTracker/1 CFNetwork/3826.500.131 Darwin/24.5.0'
      },
      body: JSON.stringify({
        code: 'test-auth-code'
      })
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text);
  } catch (error) {
    console.error('Error:', error);
  }
}

testGoogleAuth();