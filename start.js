#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Disaster Response Coordination Platform...\n');

// Check if node_modules exist
const backendNodeModules = path.join(__dirname, 'backend', 'node_modules');
const frontendNodeModules = path.join(__dirname, 'frontend', 'node_modules');

if (!fs.existsSync(backendNodeModules)) {
  console.log('❌ Backend dependencies not found. Please run:');
  console.log('   cd backend && npm install\n');
  process.exit(1);
}

if (!fs.existsSync(frontendNodeModules)) {
  console.log('❌ Frontend dependencies not found. Please run:');
  console.log('   cd frontend && npm install\n');
  process.exit(1);
}

// Check if .env files exist
const backendEnv = path.join(__dirname, 'backend', '.env');
const frontendEnv = path.join(__dirname, 'frontend', '.env');

if (!fs.existsSync(backendEnv)) {
  console.log('⚠️  Backend .env file not found. Copying from .env.example...');
  const envExample = path.join(__dirname, 'backend', '.env.example');
  if (fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, backendEnv);
    console.log('✅ Backend .env file created. Please configure your environment variables.\n');
  }
}

if (!fs.existsSync(frontendEnv)) {
  console.log('⚠️  Frontend .env file not found. Copying from .env.example...');
  const envExample = path.join(__dirname, 'frontend', '.env.example');
  if (fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, frontendEnv);
    console.log('✅ Frontend .env file created.\n');
  }
}

// Start backend
console.log('🔧 Starting backend server...');
const backend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

backend.stdout.on('data', (data) => {
  console.log(`[Backend] ${data.toString().trim()}`);
});

backend.stderr.on('data', (data) => {
  console.error(`[Backend Error] ${data.toString().trim()}`);
});

// Wait a bit for backend to start, then start frontend
setTimeout(() => {
  console.log('⚛️  Starting frontend development server...');
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'frontend'),
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });

  frontend.stdout.on('data', (data) => {
    console.log(`[Frontend] ${data.toString().trim()}`);
  });

  frontend.stderr.on('data', (data) => {
    console.error(`[Frontend Error] ${data.toString().trim()}`);
  });

  frontend.on('close', (code) => {
    console.log(`\n❌ Frontend process exited with code ${code}`);
    backend.kill();
    process.exit(code);
  });
}, 3000);

backend.on('close', (code) => {
  console.log(`\n❌ Backend process exited with code ${code}`);
  process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down servers...');
  backend.kill();
  process.exit(0);
});

console.log('\n📋 Setup Instructions:');
console.log('1. Configure your Supabase credentials in backend/.env');
console.log('2. Run the database setup SQL in your Supabase dashboard');
console.log('3. Optionally add API keys for full functionality');
console.log('4. Access the application at http://localhost:3000');
console.log('\n💡 Press Ctrl+C to stop both servers\n');
