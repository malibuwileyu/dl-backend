const axios = require('axios');

// Configure axios with admin headers
const api = axios.create({
  baseURL: 'http://localhost:4051/api/v1',
  headers: {
    'x-user-id': '1',
    'x-user-role': 'admin'
  }
});

async function testAISubcategories() {
  try {
    console.log('Testing AI categorization with subcategories...\n');
    
    // 1. First trigger AI analysis
    console.log('1. Running AI analysis...');
    const analysisResponse = await api.post('/admin/ai-categorization/analyze');
    console.log(`Analysis completed. Found ${analysisResponse.data.length} suggestions.\n`);
    
    // 2. Get the AI suggestions
    console.log('2. Fetching AI suggestions...');
    const suggestionsResponse = await api.get('/admin/ai-categorization/suggestions');
    const suggestions = suggestionsResponse.data;
    
    console.log(`Found ${suggestions.length} pending suggestions:\n`);
    suggestions.forEach((s, i) => {
      console.log(`${i + 1}. ${s.domain}`);
      console.log(`   Category: ${s.category}, Subcategory: ${s.subcategory || 'none'}`);
      console.log(`   Confidence: ${s.confidence}`);
      console.log(`   Reason: ${s.reason}\n`);
    });
    
    // 3. Test approving a suggestion
    if (suggestions.length > 0) {
      const firstSuggestion = suggestions[0];
      console.log(`3. Approving suggestion for ${firstSuggestion.domain}...`);
      
      const approveResponse = await api.post(
        `/admin/ai-categorization/suggestions/${firstSuggestion.id}/approve`,
        {}
      );
      console.log('Suggestion approved successfully');
      
      // 4. Check if it was saved with subcategory
      console.log('\n4. Checking website categories...');
      const categoriesResponse = await api.get('/website-categories');
      const matchingCategory = categoriesResponse.data.find(c => c.pattern === firstSuggestion.domain);
      
      if (matchingCategory) {
        console.log(`Found category for ${matchingCategory.pattern}:`);
        console.log(`  Category: ${matchingCategory.category}`);
        console.log(`  Subcategory: ${matchingCategory.subcategory || 'none'}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAISubcategories();