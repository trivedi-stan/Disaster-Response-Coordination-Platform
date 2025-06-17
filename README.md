# Disaster Response Coordination Platform

A backend-heavy MERN stack application for disaster response coordination that aggregates real-time data to aid disaster management.

## 🚀 Features

- **Disaster Data Management**: CRUD operations with ownership and audit trails
- **AI-Powered Location Services**: Google Gemini API for location extraction and geocoding
- **Real-Time Social Media Monitoring**: Twitter/Bluesky integration with mock fallback
- **Geospatial Resource Mapping**: Supabase geospatial queries for location-based lookups
- **Official Updates Aggregation**: Web scraping from government/relief websites
- **Image Verification**: Google Gemini API for disaster image authenticity
- **Advanced Caching**: Supabase-based caching with TTL optimization
- **Real-Time Updates**: WebSocket integration for live data synchronization

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js + Express.js
- **Database**: Supabase (PostgreSQL) with PostGIS for geospatial support
- **Real-time**: Socket.IO for WebSocket connections
- **AI Integration**: Google Gemini API for location extraction and image verification
- **Geocoding**: Google Maps/Mapbox/OpenStreetMap APIs
- **Caching**: Supabase-based caching with TTL
- **Authentication**: Mock authentication system for demo

### Frontend
- **Framework**: React.js with Vite
- **Styling**: Tailwind CSS with custom components
- **State Management**: React Query for server state
- **Real-time**: Socket.IO client
- **Routing**: React Router DOM
- **Forms**: React Hook Form
- **UI Components**: Lucide React icons

## 📁 Project Structure

```
Disaster-Response-Coordination-Platform/
├── backend/                          # Node.js + Express.js API
│   ├── src/
│   │   ├── routes/                   # API route handlers
│   │   │   ├── disasters.js          # Disaster CRUD operations
│   │   │   ├── geocode.js            # Location extraction & geocoding
│   │   │   ├── socialMedia.js        # Social media monitoring
│   │   │   ├── resources.js          # Geospatial resource queries
│   │   │   ├── officialUpdates.js    # Government updates aggregation
│   │   │   └── imageVerification.js  # AI image verification
│   │   ├── services/                 # External service integrations
│   │   │   ├── geminiService.js      # Google Gemini API integration
│   │   │   ├── geocodingService.js   # Mapping services integration
│   │   │   ├── socialMediaService.js # Social media APIs
│   │   │   └── officialUpdatesService.js # Web scraping services
│   │   ├── middleware/               # Express middleware
│   │   │   ├── auth.js               # Mock authentication
│   │   │   ├── rateLimit.js          # Rate limiting
│   │   │   └── errorHandler.js       # Error handling
│   │   ├── utils/                    # Helper functions
│   │   │   ├── logger.js             # Structured logging
│   │   │   └── helpers.js            # Utility functions
│   │   └── config/                   # Configuration
│   │       └── database.js           # Supabase configuration
│   ├── database_setup.sql            # Database schema and sample data
│   ├── package.json
│   └── server.js                     # Main server file
├── frontend/                         # React.js application
│   ├── src/
│   │   ├── components/               # Reusable React components
│   │   │   ├── Layout.jsx            # Main layout component
│   │   │   ├── LoadingSpinner.jsx    # Loading states
│   │   │   └── ErrorBoundary.jsx     # Error handling
│   │   ├── pages/                    # Page components
│   │   │   ├── Dashboard.jsx         # Main dashboard
│   │   │   ├── DisasterList.jsx      # Disaster listing
│   │   │   ├── CreateDisaster.jsx    # Disaster creation form
│   │   │   ├── DisasterDetail.jsx    # Disaster details
│   │   │   ├── SocialMedia.jsx       # Social media monitoring
│   │   │   ├── Resources.jsx         # Resource mapping
│   │   │   ├── OfficialUpdates.jsx   # Government updates
│   │   │   ├── ImageVerification.jsx # Image verification
│   │   │   └── Settings.jsx          # User settings
│   │   ├── services/                 # API client functions
│   │   │   ├── api.js                # Axios configuration
│   │   │   ├── auth.js               # Authentication service
│   │   │   ├── disasters.js          # Disaster API calls
│   │   │   └── geocoding.js          # Geocoding API calls
│   │   ├── contexts/                 # React contexts
│   │   │   ├── AuthContext.jsx       # Authentication context
│   │   │   └── SocketContext.jsx     # WebSocket context
│   │   ├── utils/                    # Helper functions
│   │   │   └── formatters.js         # Data formatting utilities
│   │   ├── App.jsx                   # Main App component
│   │   ├── main.jsx                  # React entry point
│   │   └── index.css                 # Global styles
│   ├── package.json
│   ├── vite.config.js                # Vite configuration
│   ├── tailwind.config.js            # Tailwind CSS configuration
│   └── index.html                    # HTML template
├── PRD_Disaster_Response_Platform.md # Product Requirements Document
└── README.md                         # This file
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Supabase account** (free tier available)
- **Google Gemini API key** (optional - will use mock data without it)
- **Mapping service API key** (optional - Google Maps/Mapbox)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Disaster-Response-Coordination-Platform
```

### 2. Database Setup (Supabase)

1. **Create a Supabase project**:
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and API keys

2. **Run the database setup**:
   - Open the Supabase SQL Editor
   - Copy and paste the contents of `backend/database_setup.sql`
   - Execute the SQL to create tables, indexes, and sample data

### 3. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

**Configure your `.env` file**:
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Supabase Configuration (Required)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Google Gemini API (Optional - uses mock data if not provided)
GEMINI_API_KEY=your_gemini_api_key

# Mapping Service (Optional - choose one)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token

# Social Media APIs (Optional)
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
BLUESKY_IDENTIFIER=your_bluesky_identifier
BLUESKY_PASSWORD=your_bluesky_password
```

**Start the backend server**:
```bash
npm run dev
```

The backend will be available at `http://localhost:5000`

### 4. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
```

**Configure your frontend `.env` file**:
```env
# API Configuration
VITE_API_URL=http://localhost:5000

# Optional configurations
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

**Start the frontend development server**:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 5. Access the Application

1. Open your browser and go to `http://localhost:3000`
2. You'll see a login screen with mock users:
   - **Emergency Coordinator (Admin)**: Full access to all features
   - **Relief Administrator**: Contributor access
   - **Citizen Reporter**: Basic reporting access
3. Select a user to start exploring the platform

## 🔧 Configuration

### Required API Keys

To enable full functionality, obtain these API keys:

1. **Google Gemini API** (for AI features):
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create an API key
   - Add to `GEMINI_API_KEY` in backend `.env`

2. **Google Maps API** (for geocoding):
   - Visit [Google Cloud Console](https://console.cloud.google.com)
   - Enable Geocoding API
   - Create credentials
   - Add to `GOOGLE_MAPS_API_KEY` in backend `.env`

3. **Supabase** (required for database):
   - Create project at [supabase.com](https://supabase.com)
   - Get URL and keys from project settings
   - Add to backend `.env`

### Mock Data Mode

The platform works without external API keys by using mock data:
- **Location extraction**: Uses regex patterns
- **Geocoding**: Returns approximate coordinates
- **Social media**: Shows sample posts
- **Image verification**: Returns random results
- **Official updates**: Shows sample government updates

## 📊 Features Overview

### 1. Disaster Management
- Create, read, update, delete disaster records
- AI-powered location extraction from descriptions
- Automatic geocoding of location names
- Tag-based categorization and filtering
- Ownership tracking and audit trails

### 2. Real-Time Social Media Monitoring
- Integration with Twitter API and Bluesky
- Keyword-based filtering for disaster-related posts
- Priority scoring based on content analysis
- Sentiment analysis and categorization
- Location extraction from social media content

### 3. Geospatial Resource Mapping
- PostGIS-powered geospatial queries
- Find resources within specified radius
- Support for shelters, food distribution, medical facilities
- Real-time resource availability updates

### 4. Official Updates Aggregation
- Web scraping from FEMA, Red Cross, and local authorities
- Automatic content parsing and structuring
- Source attribution and link preservation
- Caching to respect rate limits

### 5. AI Image Verification
- Google Gemini Vision API integration
- Authenticity detection for disaster images
- Manipulation and fake content identification
- Batch processing capabilities
- Confidence scoring and detailed analysis

### 6. Advanced Caching System
- Supabase-based caching with TTL
- Automatic cache invalidation
- Performance optimization for external APIs
- Configurable cache duration per service

## 🔌 API Documentation

### Authentication
All API requests require a user ID header:
```
x-user-id: netrunnerX
```

Available users:
- `netrunnerX` (admin)
- `reliefAdmin` (contributor)
- `citizen1` (reporter)
- `responder1` (responder)

### Core Endpoints

#### Disasters
```
POST   /api/disasters                    # Create disaster
GET    /api/disasters                    # List disasters
GET    /api/disasters/:id                # Get disaster details
PUT    /api/disasters/:id                # Update disaster
DELETE /api/disasters/:id                # Delete disaster
```

#### Location Services
```
POST   /api/geocode                      # Extract and geocode locations
GET    /api/geocode/reverse              # Reverse geocode coordinates
POST   /api/geocode/batch                # Batch geocode locations
```

#### Social Media
```
GET    /api/disasters/:id/social-media   # Get social media reports
GET    /api/social-media/priority        # Get high-priority reports
GET    /api/social-media/stats           # Get statistics
```

#### Resources
```
GET    /api/disasters/:id/resources      # Get disaster resources
GET    /api/resources/nearby             # Find nearby resources
GET    /api/resources/types              # Get resource types
```

#### Official Updates
```
GET    /api/disasters/:id/official-updates # Get official updates
GET    /api/official-updates/recent       # Get recent updates
GET    /api/official-updates/sources      # Get available sources
```

#### Image Verification
```
POST   /api/disasters/:id/verify-image   # Verify single image
POST   /api/verify-image/batch           # Batch verify images
GET    /api/verify-image/stats           # Get verification stats
```

### WebSocket Events

The platform uses Socket.IO for real-time updates:

#### Client Events
```javascript
socket.emit('join_disaster', disasterId)    // Join disaster room
socket.emit('leave_disaster', disasterId)   // Leave disaster room
```

#### Server Events
```javascript
socket.on('disaster_updated', data)        // Disaster CRUD operations
socket.on('social_media_updated', data)    // New social media reports
socket.on('resources_updated', data)       // Resource updates
socket.on('image_verified', data)          // Image verification results
```

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
```

### Frontend Testing
```bash
cd frontend
npm test
```

### Manual Testing
1. Create a disaster with location extraction
2. Test geocoding functionality
3. Verify real-time updates via WebSocket
4. Test image verification (with mock data)
5. Check social media monitoring
6. Validate geospatial resource queries

## 🚀 Deployment

### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Backend (Render)
1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set environment variables
4. Deploy with auto-deploy enabled

### Database (Supabase)
- Already hosted on Supabase Cloud
- No additional deployment needed
- Configure production environment variables

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify Supabase URL and keys
   - Check if database setup SQL was executed
   - Ensure network connectivity

2. **External API Errors**
   - Check API key validity
   - Verify rate limits not exceeded
   - Confirm API endpoints are accessible

3. **WebSocket Connection Issues**
   - Check CORS configuration
   - Verify Socket.IO client/server versions
   - Ensure firewall allows WebSocket connections

4. **Frontend Build Errors**
   - Clear node_modules and reinstall
   - Check for TypeScript errors
   - Verify all dependencies are installed

### Debug Mode
Set `NODE_ENV=development` for detailed error messages and logging.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built using AI coding tools (Cursor/Windsurf) for rapid development
- Powered by Supabase for backend infrastructure
- Uses Google Gemini API for AI capabilities
- Styled with Tailwind CSS
- Icons by Lucide React