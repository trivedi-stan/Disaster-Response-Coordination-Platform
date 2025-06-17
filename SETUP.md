# Setup Guide - Disaster Response Coordination Platform

This guide will walk you through setting up the complete Disaster Response Coordination Platform.

## 🚀 Quick Setup (Recommended)

### 1. Install Dependencies
```bash
# Install all dependencies for both backend and frontend
npm run setup
```

### 2. Database Setup (Supabase)

1. **Create Supabase Account**:
   - Go to [supabase.com](https://supabase.com)
   - Sign up for a free account
   - Create a new project

2. **Configure Database**:
   - Open your Supabase project dashboard
   - Go to SQL Editor
   - Copy the entire contents of `backend/database_setup.sql`
   - Paste and execute the SQL

3. **Get Supabase Credentials**:
   - Go to Project Settings → API
   - Copy your Project URL and API keys

### 3. Configure Environment Variables

1. **Backend Configuration**:
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   Edit `backend/.env` with your Supabase credentials:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key
   ```

2. **Frontend Configuration**:
   ```bash
   cd frontend
   cp .env.example .env
   ```
   
   The frontend .env is optional and uses defaults.

### 4. Start the Application
```bash
# From the root directory
npm start
```

This will start both backend (port 5000) and frontend (port 3000) servers.

### 5. Access the Application
- Open your browser to `http://localhost:3000`
- Select a user from the login screen:
  - **Emergency Coordinator (Admin)**: Full access
  - **Relief Administrator**: Contributor access
  - **Citizen Reporter**: Basic access

## 🔧 Manual Setup

If you prefer to set up each component manually:

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure .env file
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
# Configure .env file (optional)
npm run dev
```

## 🔑 API Keys (Optional)

The platform works with mock data, but for full functionality, configure these APIs:

### Google Gemini API (AI Features)
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create an API key
3. Add to backend `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   ```

### Google Maps API (Geocoding)
1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Enable Geocoding API
3. Create credentials
4. Add to backend `.env`:
   ```env
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

### Twitter API (Social Media)
1. Apply for Twitter Developer account
2. Create an app and get Bearer Token
3. Add to backend `.env`:
   ```env
   TWITTER_BEARER_TOKEN=your_twitter_bearer_token
   ```

## 📊 Database Schema

The platform uses these main tables:

- **disasters**: Main disaster records with geospatial location
- **reports**: User-submitted reports linked to disasters
- **resources**: Emergency resources with geospatial data
- **social_media_reports**: Aggregated social media posts
- **official_updates**: Government and relief organization updates
- **cache**: Caching table for external API responses

## 🧪 Testing the Setup

### 1. Create a Disaster
- Go to Disasters → Create New Disaster
- Enter a description with location names
- Test the "Extract Locations" feature
- Test geocoding functionality

### 2. Test Real-Time Features
- Open multiple browser tabs
- Create/update disasters in one tab
- Observe real-time updates in other tabs

### 3. Test API Endpoints
```bash
# Health check
curl http://localhost:5000/health

# List disasters (requires user header)
curl -H "x-user-id: netrunnerX" http://localhost:5000/api/disasters
```

## 🔍 Troubleshooting

### Common Issues

1. **"Database connection failed"**
   - Check Supabase URL and keys in `.env`
   - Verify database setup SQL was executed
   - Check network connectivity

2. **"Module not found" errors**
   - Run `npm install` in both backend and frontend directories
   - Clear node_modules and reinstall if needed

3. **Port already in use**
   - Change PORT in backend `.env`
   - Update VITE_API_URL in frontend `.env`

4. **WebSocket connection failed**
   - Check if backend is running on correct port
   - Verify CORS configuration
   - Check firewall settings

### Debug Mode
Set `NODE_ENV=development` in backend `.env` for detailed logging.

### Logs
- Backend logs: Console output with structured logging
- Frontend logs: Browser console
- Database logs: Supabase dashboard

## 🚀 Production Deployment

### Frontend (Vercel)
1. Connect GitHub repository to Vercel
2. Set build command: `cd frontend && npm run build`
3. Set output directory: `frontend/dist`
4. Configure environment variables

### Backend (Render)
1. Connect GitHub repository to Render
2. Set build command: `cd backend && npm install`
3. Set start command: `cd backend && npm start`
4. Configure environment variables

### Environment Variables for Production
```env
# Backend
NODE_ENV=production
SUPABASE_URL=your_production_supabase_url
SUPABASE_SERVICE_KEY=your_production_service_key
FRONTEND_URL=https://your-frontend-domain.vercel.app

# Frontend
VITE_API_URL=https://your-backend-domain.render.com
```

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Google Gemini API Docs](https://ai.google.dev/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🆘 Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs for error messages
3. Verify all environment variables are set correctly
4. Ensure all dependencies are installed
5. Check that the database setup was completed successfully

## 🎯 Next Steps

After setup:

1. Explore the dashboard and create test disasters
2. Test location extraction and geocoding
3. Monitor real-time updates via WebSocket
4. Configure additional API keys for full functionality
5. Customize the platform for your specific needs

The platform is designed to be extensible and can be adapted for various disaster response scenarios.
