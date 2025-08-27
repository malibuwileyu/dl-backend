const axios = require('axios');

async function testSubcategories() {
  try {
    // Test getting subcategory definitions
    console.log('1. Fetching subcategory definitions...');
    const subcatResponse = await axios.get('http://localhost:4051/api/v1/app-categories/subcategories');
    console.log('Subcategories:', subcatResponse.data);
    
    // Test getting category for a specific app
    console.log('\n2. Testing app categorization...');
    const apps = ['Xcode', 'Instagram', 'Zoom', 'Minecraft', 'Khan Academy'];
    
    for (const app of apps) {
      const response = await axios.get(`http://localhost:4051/api/v1/app-categories/app/${encodeURIComponent(app)}`);
      console.log(`${app}: category=${response.data.category}, subcategory=${response.data.subcategory}`);
    }
    
    // Test setting a subcategory
    console.log('\n3. Setting subcategory for an app...');
    const setResponse = await axios.post('http://localhost:4051/api/v1/app-categories', {
      appName: 'TestApp',
      category: 'productive',
      subcategory: 'creativity'
    });
    console.log('Set category result:', setResponse.data);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testSubcategories();