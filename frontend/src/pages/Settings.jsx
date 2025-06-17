import { Settings as SettingsIcon, User, Bell, Database } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getAvailableUsers, setCurrentUser } from '../services/auth'

const Settings = () => {
  const { user, setUser } = useAuth()
  const availableUsers = getAvailableUsers()

  const handleUserChange = (userId) => {
    const newUser = setCurrentUser(userId)
    if (newUser) {
      setUser(newUser)
      window.location.reload() // Refresh to update all components
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure your platform preferences</p>
        </div>
      </div>

      {/* User Settings */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <User className="h-5 w-5 mr-2" />
            User Settings
          </h2>
        </div>
        <div className="card-body space-y-4">
          <div>
            <label className="form-label">Current User</label>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <User className="h-8 w-8 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">{user?.name}</p>
                <p className="text-sm text-gray-600">Role: {user?.role}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">Switch User (Demo)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableUsers.map((availableUser) => (
                <button
                  key={availableUser.id}
                  onClick={() => handleUserChange(availableUser.id)}
                  disabled={availableUser.id === user?.id}
                  className={`p-3 text-left rounded-lg border transition-colors ${
                    availableUser.id === user?.id
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <p className="font-medium">{availableUser.name}</p>
                  <p className="text-sm text-gray-600">{availableUser.role}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Database className="h-5 w-5 mr-2" />
            System Information
          </h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Platform Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Version:</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Environment:</span>
                  <span className="font-medium">Development</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">API Status:</span>
                  <span className="text-green-600 font-medium">Connected</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">External Services</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Google Gemini:</span>
                  <span className="text-yellow-600 font-medium">Mock Mode</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Geocoding:</span>
                  <span className="text-yellow-600 font-medium">Mock Mode</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Social Media:</span>
                  <span className="text-yellow-600 font-medium">Mock Mode</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <Bell className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
              <div>
                <h4 className="font-medium text-yellow-900">Demo Mode</h4>
                <p className="text-sm text-yellow-800 mt-1">
                  This platform is running in demonstration mode. External services are using mock data for testing purposes. 
                  To enable full functionality, configure the appropriate API keys in the environment variables.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <SettingsIcon className="h-5 w-5 mr-2" />
            API Configuration
          </h2>
        </div>
        <div className="card-body">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Required Environment Variables</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p><code className="bg-blue-100 px-1 rounded">GEMINI_API_KEY</code> - Google Gemini API key for location extraction and image verification</p>
                <p><code className="bg-blue-100 px-1 rounded">GOOGLE_MAPS_API_KEY</code> - Google Maps API key for geocoding</p>
                <p><code className="bg-blue-100 px-1 rounded">TWITTER_BEARER_TOKEN</code> - Twitter API bearer token for social media monitoring</p>
                <p><code className="bg-blue-100 px-1 rounded">SUPABASE_URL</code> - Supabase project URL</p>
                <p><code className="bg-blue-100 px-1 rounded">SUPABASE_SERVICE_KEY</code> - Supabase service role key</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
