const io = require('socket.io-client');

// Connect with auth params in query like StudentTimeTracker does
const socket = io('http://localhost:4051', {
  query: {
    userId: '1',
    organizationId: '1'
  },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected!');
  console.log('Socket ID:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('auth:success', (data) => {
  console.log('Auth success:', data);
});

socket.on('error', (error) => {
  console.log('Error:', error);
});

// Keep the script running
setTimeout(() => {
  console.log('Test complete');
  process.exit(0);
}, 5000);