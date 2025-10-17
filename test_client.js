// test-client.js
// Test client to simulate instructor API calls

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
const SECRET_KEY = 'your_secure_secret_key_here'; // Must match server's SECRET_KEY

// Test Round 1: Create new app
async function testRound1() {
  console.log('🧪 Testing Round 1: Initial App Creation\n');

  const taskId = `task-${Date.now()}`;

  const request = {
    secret: SECRET_KEY,
    task_id: taskId,
    brief: 'Create a beautiful todo list application with the following features: add new tasks, mark tasks as complete with a checkbox, delete tasks with a button, show task count. Use a modern gradient background, smooth animations, and a clean card-based design.',
    attachments: [
      {
        type: 'text',
        filename: 'requirements.txt',
        content: 'Additional requirements:\n- Use purple and blue color scheme\n- Add hover effects on buttons\n- Make it mobile responsive',
        description: 'Design requirements'
      }
    ],
    evaluation_url: 'https://webhook.site/your-unique-url', // Replace with your test webhook
    round: 1
  };

  try {
    console.log(`📤 Sending Round 1 request for task: ${taskId}\n`);
    const response = await axios.post(`${API_BASE_URL}/api-endpoint`, request);
    console.log('✅ Response:', response.data);
    console.log(`\n⏳ Processing started. Check status at: ${API_BASE_URL}/task/${taskId}`);
    console.log('⏳ Check your webhook URL for the callback result\n');

    // Wait and check status
    setTimeout(async () => {
      try {
        console.log('📊 Checking task status...\n');
        const status = await axios.get(`${API_BASE_URL}/task/${taskId}`);
        console.log('Task Status:', JSON.stringify(status.data, null, 2));

        if (status.data.repoName) {
          console.log('\n✅ Round 1 Complete!');
          console.log(`Repository: ${status.data.repoUrl}`);
          console.log(`Deployment: ${status.data.deploymentUrl}`);
          console.log(`\n💡 To test Round 2, run testRound2('${taskId}', '${status.data.repoName}')`);
        }
      } catch (err) {
        console.error('Status check error:', err.response?.data || err.message);
      }
    }, 10000); // Check after 10 seconds

    return { taskId };
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// Test Round 2: Update existing app
async function testRound2(taskId, repoName) {
  console.log('\n🧪 Testing Round 2: App Update\n');

  if (!taskId || !repoName) {
    console.error('❌ Error: taskId and repoName are required for Round 2');
    console.log('Usage: testRound2("task-123456", "app-task-123456")');
    return;
  }

  const request = {
    secret: SECRET_KEY,
    task_id: taskId,
    brief: 'Update the todo app with these new features: Add a dark mode toggle button in the top-right corner, add local storage to persist tasks between page reloads, add a "Clear All" button to remove all tasks at once, add subtle fade-in animations when adding new tasks.',
    attachments: [
      {
        type: 'text',
        filename: 'update-specs.txt',
        content: 'Dark mode requirements:\n- Toggle between light and dark themes\n- Save theme preference in localStorage\n- Smooth transition between themes\n- Update all colors appropriately',
        description: 'Dark mode specifications'
      }
    ],
    evaluation_url: 'https://webhook.site/your-unique-url', // Replace with your test webhook
    round: 2,
    repo_name: repoName
  };

  try {
    console.log(`📤 Sending Round 2 request for task: ${taskId}\n`);
    const response = await axios.post(`${API_BASE_URL}/api-endpoint`, request);
    console.log('✅ Response:', response.data);
    console.log(`\n⏳ Processing started. The app will be updated in the same repository.`);
    console.log('⏳ Check your webhook URL for the callback result\n');

    // Wait and check status
    setTimeout(async () => {
      try {
        console.log('📊 Checking task status...\n');
        const status = await axios.get(`${API_BASE_URL}/task/${taskId}`);
        console.log('Task Status:', JSON.stringify(status.data, null, 2));

        console.log('\n✅ Round 2 Complete!');
        console.log(`Repository: ${status.data.repoUrl}`);
        console.log(`Deployment: ${status.data.deploymentUrl}`);
        console.log(`\n🔄 The app has been updated with new features!`);
      } catch (err) {
        console.error('Status check error:', err.response?.data || err.message);
      }
    }, 15000); // Check after 15 seconds (updates may take longer)

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// Test with attachments
async function testWithImageAttachment() {
  console.log('🧪 Testing with Image Attachment\n');

  const taskId = `task-img-${Date.now()}`;

  const request = {
    secret: SECRET_KEY,
    task_id: taskId,
    brief: 'Create a landing page for a coffee shop website with hero section, menu section, and contact form.',
    attachments: [
      {
        type: 'image',
        filename: 'design-reference.png',
        data: 'https://example.com/coffee-shop-design.png', // Or base64 data
        description: 'Reference design showing warm brown and cream color palette with modern minimalist style'
      },
      {
        type: 'text',
        filename: 'content.txt',
        content: 'Coffee Shop Name: "Bean & Brew"\nTagline: "Artisan Coffee, Crafted Daily"\nMenu Items: Espresso, Cappuccino, Latte, Cold Brew',
        description: 'Website content'
      }
    ],
    evaluation_url: 'https://webhook.site/your-unique-url',
    round: 1
  };

  try {
    console.log(`📤 Sending request with attachments for task: ${taskId}\n`);
    const response = await axios.post(`${API_BASE_URL}/api-endpoint`, request);
    console.log('✅ Response:', response.data);
    console.log('\n⏳ Check your webhook URL for the callback result\n');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Health check
async function checkHealth() {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`);
    console.log('🏥 Health Check:', JSON.stringify(response.data, null, 2), '\n');
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Starting API Tests');
  console.log('='.repeat(60) + '\n');

  // Check health first
  const healthy = await checkHealth();
  if (!healthy) {
    console.error('❌ Server is not healthy. Please check your configuration.');
    return;
  }

  console.log('='.repeat(60) + '\n');

  // Test Round 1
  const { taskId } = await testRound1();

  // Uncomment below to test Round 2 after Round 1 completes
  // You'll need to wait for Round 1 to finish and get the repo name
  /*
  setTimeout(() => {
    testRound2('task-1234567890', 'app-task-1234567890');
  }, 60000); // Wait 60 seconds
  */

  // Uncomment to test with image attachments
  // setTimeout(() => testWithImageAttachment(), 2000);
}

// Export functions for manual testing
module.exports = {
  testRound1,
  testRound2,
  testWithImageAttachment,
  checkHealth
};

// Run tests if called directly
if (require.main === module) {
  runTests();
}