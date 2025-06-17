import axios from 'axios'
import toast from 'react-hot-toast'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth headers
api.interceptors.request.use(
  (config) => {
    // Get current user from localStorage or context
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
    if (user.id) {
      config.headers['x-user-id'] = user.id
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    const message = error.response?.data?.message || error.message || 'An error occurred'
    
    // Don't show toast for certain status codes
    if (error.response?.status !== 404) {
      toast.error(message)
    }
    
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default api
