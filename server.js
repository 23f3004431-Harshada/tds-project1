// server.js
const express = require('express');
const axios = require('axios');
const { Octokit } = require('@octokit/rest');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const LLM_PROVIDER = 'anthropic'; // Fixed to Anthropic
const SECRET_KEY = process.env.SECRET_KEY || 'default-secret-key';
const PORT = process.env.PORT || 3000;

// Initialize GitHub client
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Store task states (use database in production)
const taskStates = new Map();

// Helper: Verify secret
function verifySecret(providedSecret) {
  return crypto.timingSafeEqual(
    Buffer.from(providedSecret || ''),
    Buffer.from(SECRET_KEY)
  );
}

// Helper: Parse attachments (base64 images, text files, etc.)
function parseAttachments(attachments) {
  if (!attachments || !Array.isArray(attachments)) return [];

  return attachments.map(att => {
    // Handle different attachment types
    if (att.type === 'image' && att.data) {
      return {
        type: 'image',
        filename: att.filename || 'image.png',
        data: att.data, // base64 or URL
        description: att.description || ''
      };
    } else if (att.type === 'text' && att.content) {
      return {
        type: 'text',
        filename: att.filename || 'document.txt',
        content: att.content,
        description: att.description || ''
      };
    }
    return null;
  }).filter(Boolean);
}

// Helper: Build comprehensive prompt with attachments
function buildPrompt(brief, attachments, round = 1, existingCode = null) {
  let prompt = '';

  if (round === 1) {
    prompt = `Create a complete, fully functional single-page web application based on this brief:\n\n${brief}\n\n`;

    if (attachments && attachments.length > 0) {
      prompt += `Additional Requirements from Attachments:\n`;
      attachments.forEach((att, idx) => {
        if (att.type === 'image') {
          prompt += `\n${idx + 1}. Image Reference: ${att.filename}`;
          if (att.description) prompt += ` - ${att.description}`;
          prompt += `\n   [Design should incorporate elements from this image]`;
        } else if (att.type === 'text') {
          prompt += `\n${idx + 1}. Additional Specifications from ${att.filename}:\n${att.content}\n`;
        }
      });
      prompt += '\n';
    }

    prompt += `Requirements:
- Create a single, complete HTML file with inline CSS and JavaScript
- Make it fully functional and interactive
- Use modern, responsive design
- Ensure it works without any external dependencies
- Include proper error handling
- Make it visually appealing

Provide ONLY the complete HTML code, nothing else.`;
  } else {
    prompt = `You are updating an existing web application.

Current Application Code:
\`\`\`html
${existingCode}
\`\`\`

Update Brief (Round ${round}):
${brief}\n\n`;

    if (attachments && attachments.length > 0) {
      prompt += `Additional Update Requirements:\n`;
      attachments.forEach((att, idx) => {
        if (att.type === 'image') {
          prompt += `\n${idx + 1}. Reference Image: ${att.filename}`;
          if (att.description) prompt += ` - ${att.description}`;
        } else if (att.type === 'text') {
          prompt += `\n${idx + 1}. From ${att.filename}:\n${att.content}\n`;
        }
      });
      prompt += '\n';
    }

    prompt += `Update the application according to these requirements while:
- Preserving existing functionality unless explicitly asked to change
- Maintaining code quality and organization
- Ensuring all features work correctly
- Keeping everything in a single HTML file

Provide ONLY the complete updated HTML code, nothing else.`;
  }

  return prompt;
}

// Helper: Call Anthropic Claude API
async function callLLM(prompt) {
  try {
    console.log('Calling Anthropic Claude API...');
    
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 60000
      }
    );

    if (response.data.content && response.data.content[0]) {
      return response.data.content[0].text;
    } else {
      throw new Error('Unexpected response format from Anthropic API');
    }
  } catch (error) {
    console.error('Anthropic API Error:', error.response?.data || error.message);
    throw new Error(`Anthropic API failed: ${error.message}`);
  }
}

// Helper: Extract clean HTML from LLM response
function extractHTML(llmResponse) {
  // Remove markdown code blocks
  let html = llmResponse.trim();

  // Try to extract from ```html blocks
  const htmlMatch = html.match(/```html\s*\n([\s\S]*?)\n```/);
  if (htmlMatch) {
    html = htmlMatch[1];
  } else if (html.includes('```')) {
    // Try generic code block
    const codeMatch = html.match(/```\s*\n([\s\S]*?)\n```/);
    if (codeMatch) {
      html = codeMatch[1];
    }
  }

  html = html.trim();

  // Ensure it starts with DOCTYPE or html tag
  if (!html.toLowerCase().startsWith('<!doctype') && !html.toLowerCase().startsWith('<html')) {
    html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated App</title>
</head>
<body>
${html}
</body>
</html>`;
  }

  return html;
}

// Helper: Create GitHub repo
async function createGitHubRepo(repoName, htmlContent, brief, round = 1) {
  try {
    let repo;
    let sha = null;

    if (round === 1) {
      // Create new repository
      console.log(`Creating new repository: ${repoName}`);
      repo = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: `Auto-generated app: ${brief.substring(0, 100)}`,
        auto_init: false,
        private: false
      });
      console.log(`✓ Repository created: ${repo.data.html_url}`);
    } else {
      // Get existing repo
      console.log(`Fetching existing repository: ${repoName}`);
      repo = await octokit.repos.get({
        owner: GITHUB_USERNAME,
        repo: repoName
      });
      console.log(`✓ Repository found`);

      // Get SHA of existing index.html for update
      try {
        const { data: file } = await octokit.repos.getContent({
          owner: GITHUB_USERNAME,
          repo: repoName,
          path: 'index.html'
        });
        sha = file.sha;
        console.log(`✓ Found existing index.html`);
      } catch (err) {
        console.log(`  No existing index.html found, will create new`);
      }
    }

    // Create or update index.html
    console.log(`Pushing code to repository...`);
    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_USERNAME,
      repo: repoName,
      path: 'index.html',
      message: round === 1 ? 'Initial commit: Generated app' : `Update: Round ${round}`,
      content: Buffer.from(htmlContent).toString('base64'),
      ...(sha && { sha })
    });
    console.log(`✓ Code pushed successfully`);

    return {
      repoUrl: repo.data.html_url,
      repoName: repoName
    };
  } catch (error) {
    console.error('GitHub error:', error.response?.data || error.message);
    throw new Error(`GitHub operation failed: ${error.message}`);
  }
}

// Helper: Enable GitHub Pages
async function enableGitHubPages(repoName) {
  try {
    console.log(`Enabling GitHub Pages...`);

    // Check if Pages is already enabled
    try {
      await octokit.repos.getPages({
        owner: GITHUB_USERNAME,
        repo: repoName
      });
      console.log(`✓ GitHub Pages already enabled`);
    } catch (error) {
      if (error.status === 404) {
        // Pages not enabled, create it
        await octokit.repos.createPagesSite({
          owner: GITHUB_USERNAME,
          repo: repoName,
          source: {
            branch: 'main',
            path: '/'
          }
        });
        console.log(`✓ GitHub Pages enabled`);
      } else {
        throw error;
      }
    }

    const pagesUrl = `https://${GITHUB_USERNAME}.github.io/${repoName}`;
    return pagesUrl;
  } catch (error) {
    console.error('GitHub Pages error:', error.response?.data || error.message);
    // Don't fail the whole process if Pages has issues
    console.log(`⚠ GitHub Pages may need manual enablement`);
    return `https://${GITHUB_USERNAME}.github.io/${repoName}`;
  }
}

// Helper: Send POST to evaluation URL
async function sendEvaluation(evaluationUrl, payload) {
  try {
    console.log(`Sending results to evaluation API: ${evaluationUrl}`);
    await axios.post(evaluationUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    console.log(`✓ Evaluation API notified successfully`);
    return true;
  } catch (error) {
    console.error('Evaluation API error:', error.response?.data || error.message);
    console.log(`⚠ Failed to notify evaluation API, but task completed`);
    return false;
  }
}

// Main endpoint: /api-endpoint
app.post('/api-endpoint', async (req, res) => {
  const startTime = Date.now();

  try {
    // 1. Verify secret
    const { secret, task_id, brief, attachments, evaluation_url, round = 1, repo_name } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log(`📨 Received request - Task ID: ${task_id}, Round: ${round}`);
    console.log('='.repeat(60));

    if (!secret || !verifySecret(secret)) {
      console.log('✗ Secret verification failed');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or missing secret'
      });
    }
    console.log('✓ Secret verified');

    // Validate required fields
    if (!task_id || !brief || !evaluation_url) {
      console.log('✗ Missing required fields');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: task_id, brief, evaluation_url'
      });
    }
    console.log('✓ Request validated');

    // Send immediate acknowledgment
    res.status(202).json({
      message: 'Task accepted and processing',
      task_id,
      round
    });

    // Process asynchronously
    (async () => {
      try {
        // 2. Parse attachments
        console.log(`\n📎 Parsing attachments...`);
        const parsedAttachments = parseAttachments(attachments);
        console.log(`✓ Parsed ${parsedAttachments.length} attachment(s)`);

        // Get existing state for Round 2+
        const taskState = taskStates.get(task_id) || {};
        const isUpdate = round > 1;
        const repoName = repo_name || taskState.repoName || `app-${task_id.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;

        // 3. Call LLM to generate code
        console.log(`\n🤖 Generating code with ANTHROPIC CLAUDE...`);
        const prompt = buildPrompt(brief, parsedAttachments, round, isUpdate ? taskState.lastCode : null);
        const llmResponse = await callLLM(prompt);
        const htmlContent = extractHTML(llmResponse);
        console.log(`✓ Generated ${htmlContent.length} characters of code`);

        // 4. Create/update GitHub repo and push code
        console.log(`\n📦 ${isUpdate ? 'Updating' : 'Creating'} GitHub repository...`);
        const { repoUrl } = await createGitHubRepo(repoName, htmlContent, brief, round);

        // 5. Enable GitHub Pages
        console.log(`\n🌐 Setting up GitHub Pages...`);
        const deploymentUrl = await enableGitHubPages(repoName);

        // Save state
        taskStates.set(task_id, {
          repoName,
          lastCode: htmlContent,
          repoUrl,
          deploymentUrl,
          round,
          updatedAt: new Date().toISOString()
        });

        // 6. Send POST to evaluation_url
        const evaluationPayload = {
          task_id,
          round,
          status: 'completed',
          repo_url: repoUrl,
          deployment_url: deploymentUrl,
          processing_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };

        console.log(`\n📤 Notifying evaluation API...`);
        await sendEvaluation(evaluation_url, evaluationPayload);

        console.log(`\n✅ Task ${task_id} completed successfully!`);
        console.log(`   Repository: ${repoUrl}`);
        console.log(`   Deployment: ${deploymentUrl}`);
        console.log(`   Time: ${Date.now() - startTime}ms`);
        console.log('='.repeat(60) + '\n');

      } catch (error) {
        console.error(`\n✗ Task ${task_id} failed:`, error.message);
        console.log('='.repeat(60) + '\n');

        // Send error to evaluation API
        const errorPayload = {
          task_id,
          round,
          status: 'failed',
          error: error.message,
          processing_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };

        await sendEvaluation(evaluation_url, errorPayload);
      }
    })();

  } catch (error) {
    console.error('Request handling error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Root route - to confirm the API is live
app.get('/', (req, res) => {
  res.send(`
    <h2>Project 1 TDA</h2>
    <p>Welcome!</p>
    <ul>
      <li><a href="/health">Check Health</a></li>
      <li>Use POST /api-endpoint to submit tasks.</li>
    </ul>
  `);
});

// Status check endpoint
app.get('/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const taskState = taskStates.get(taskId);

  if (!taskState) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({
    task_id: taskId,
    ...taskState
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    llm_provider: LLM_PROVIDER,
    github_username: GITHUB_USERNAME,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Student API Server Started');
  console.log('='.repeat(60));
  console.log(`🔌 Port: ${PORT}`);
  console.log(`🤖 LLM Provider: ${LLM_PROVIDER.toUpperCase()}`);
  console.log(`👤 GitHub User: ${GITHUB_USERNAME}`);
  console.log(`🔧 Endpoints:`);
  console.log(`   POST /api-endpoint - Process task requests`);
  console.log(`   GET /task/:taskId - Check task status`);
  console.log(`   GET /health - Health check`);
  console.log('='.repeat(60) + '\n');
});

module.exports = app;
