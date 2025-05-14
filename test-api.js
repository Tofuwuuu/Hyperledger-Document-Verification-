// Simple test script for the alumni API endpoint
const axios = require('axios');

const API_URL = 'http://localhost:8000/api/v1';
const token = 'YOUR_TOKEN_HERE'; // Replace with an actual token

async function testApiEndpoint() {
  try {
    console.log('Testing API endpoint...');
    
    // Test payload
    const payload = {
      user_id: '68236de4d8d6f1393876b83f', // Use the same user ID from the logs
      full_name: 'Test User',
      student_id: '12345678',
      email: 'test@example.com',
      graduation_year: 2023
    };
    
    const response = await axios({
      method: 'post',
      url: `${API_URL}/alumni`,
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Success!', response.status, response.data);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testApiEndpoint(); 