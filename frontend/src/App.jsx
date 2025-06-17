import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'

// Components
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import DisasterList from './pages/DisasterList'
import DisasterDetail from './pages/DisasterDetail'
import CreateDisaster from './pages/CreateDisaster'
import SocialMedia from './pages/SocialMedia'
import Resources from './pages/Resources'
import OfficialUpdates from './pages/OfficialUpdates'
import ImageVerification from './pages/ImageVerification'
import Settings from './pages/Settings'

// Context
import { SocketContext } from './contexts/SocketContext'
import { AuthContext } from './contexts/AuthContext'

// Services
import { getCurrentUser } from './services/auth'

function App() {
  const [socket, setSocket] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initialize user (mock authentication)
    const initUser = async () => {
      try {
        const currentUser = getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        console.error('Failed to get current user:', error)
        toast.error('Authentication failed')
      } finally {
        setIsLoading(false)
      }
    }

    initUser()
  }, [])

  useEffect(() => {
    if (user) {
      // Initialize socket connection
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
        transports: ['websocket'],
        upgrade: true
      })

      newSocket.on('connect', () => {
        console.log('Connected to server')
        toast.success('Connected to real-time updates')
      })

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server')
        toast.error('Disconnected from real-time updates')
      })

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error)
        toast.error('Failed to connect to real-time updates')
      })

      // Listen for disaster updates
      newSocket.on('disaster_updated', (data) => {
        console.log('Disaster updated:', data)
        toast.success(`Disaster ${data.action}: ${data.disaster?.title || 'Unknown'}`)
      })

      // Listen for social media updates
      newSocket.on('social_media_updated', (data) => {
        console.log('Social media updated:', data)
        if (data.reports && data.reports.length > 0) {
          toast.success(`${data.reports.length} new social media reports`)
        }
      })

      // Listen for resource updates
      newSocket.on('resources_updated', (data) => {
        console.log('Resources updated:', data)
        if (data.resources && data.resources.length > 0) {
          toast.success(`${data.resources.length} resources updated`)
        }
      })

      // Listen for image verification updates
      newSocket.on('image_verified', (data) => {
        console.log('Image verified:', data)
        const status = data.verificationStatus
        const message = status === 'verified' 
          ? 'Image verified as authentic' 
          : status === 'rejected' 
          ? 'Image verification failed' 
          : 'Image verification pending'
        
        if (status === 'verified') {
          toast.success(message)
        } else if (status === 'rejected') {
          toast.error(message)
        } else {
          toast(message)
        }
      })

      setSocket(newSocket)

      return () => {
        newSocket.close()
      }
    }
  }, [user])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="loading-spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Disaster Response Platform...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6">Authentication Required</h1>
          <p className="text-gray-600 text-center mb-4">
            Please select a user to continue:
          </p>
          <div className="space-y-2">
            <button
              onClick={() => setUser({ id: 'netrunnerX', name: 'Emergency Coordinator', role: 'admin' })}
              className="w-full btn btn-primary"
            >
              Login as Emergency Coordinator (Admin)
            </button>
            <button
              onClick={() => setUser({ id: 'reliefAdmin', name: 'Relief Administrator', role: 'contributor' })}
              className="w-full btn btn-secondary"
            >
              Login as Relief Administrator
            </button>
            <button
              onClick={() => setUser({ id: 'citizen1', name: 'Citizen Reporter', role: 'reporter' })}
              className="w-full btn btn-warning"
            >
              Login as Citizen Reporter
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <SocketContext.Provider value={{ socket }}>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/disasters" element={<DisasterList />} />
            <Route path="/disasters/new" element={<CreateDisaster />} />
            <Route path="/disasters/:id" element={<DisasterDetail />} />
            <Route path="/social-media" element={<SocialMedia />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/official-updates" element={<OfficialUpdates />} />
            <Route path="/image-verification" element={<ImageVerification />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </SocketContext.Provider>
    </AuthContext.Provider>
  )
}

export default App
