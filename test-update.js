const axios = require('axios');

// Test the update user endpoint
async function testUpdateUser() {
  try {
    // First, login to get a token
    const loginResponse = await axios.post('http://localhost:3000/api/users/login', {
      email: 'snoopy.12@gmail.com',
      password: 'password123' // Replace with actual password
    });
    
    const token = loginResponse.data.token;
    console.log('Login successful, token:', token.substring(0, 20) + '...');
    
    // Test update without file
    const updateData = {
      userFirstName: 'Snoop',
      userLastName: 'Dogg',
      phoneNumber: '2457447802',
      address: '123 Main St, Anytown, USA',
      gender: 'male',
      income: 5000000,
      creditID: 'ABC09870'
    };
    
    const updateResponse = await axios.put('http://localhost:3000/api/users/update', updateData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Update response:', updateResponse.data);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testUpdateUser(); 