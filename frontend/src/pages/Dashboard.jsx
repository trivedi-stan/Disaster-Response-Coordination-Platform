import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'react-query'
import {
  AlertTriangle,
  MessageSquare,
  MapPin,
  FileText,
  TrendingUp,
  Clock,
  Users,
  Activity
} from 'lucide-react'
import disasterService from '../services/disasters'
import { useSocket } from '../contexts/SocketContext'

const Dashboard = () => {
  const [realtimeStats, setRealtimeStats] = useState({
    activeDisasters: 0,
    recentReports: 0,
    verifiedImages: 0,
    onlineUsers: 1
  })
  const { socket } = useSocket()

  // Fetch recent disasters
  const { data: disastersData, isLoading: disastersLoading } = useQuery(
    'recent-disasters',
    () => disasterService.getDisasters({ limit: 5 }),
    { refetchInterval: 30000 } // Refetch every 30 seconds
  )

  // Listen for real-time updates
  useEffect(() => {
    if (socket) {
      socket.on('disaster_updated', (data) => {
        setRealtimeStats(prev => ({
          ...prev,
          activeDisasters: prev.activeDisasters + (data.action === 'create' ? 1 : data.action === 'delete' ? -1 : 0)
        }))
      })

      socket.on('social_media_updated', (data) => {
        setRealtimeStats(prev => ({
          ...prev,
          recentReports: prev.recentReports + (data.reports?.length || 0)
        }))
      })

      socket.on('image_verified', (data) => {
        if (data.verificationStatus === 'verified') {
          setRealtimeStats(prev => ({
            ...prev,
            verifiedImages: prev.verifiedImages + 1
          }))
        }
      })

      return () => {
        socket.off('disaster_updated')
        socket.off('social_media_updated')
        socket.off('image_verified')
      }
    }
  }, [socket])

  const stats = [
    {
      name: 'Active Disasters',
      value: disastersData?.data?.pagination?.total || realtimeStats.activeDisasters,
      icon: AlertTriangle,
      color: 'text-disaster-600',
      bgColor: 'bg-disaster-50',
      change: '+2 from yesterday',
      changeType: 'increase'
    },
    {
      name: 'Recent Reports',
      value: realtimeStats.recentReports,
      icon: MessageSquare,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      change: '+12 in last hour',
      changeType: 'increase'
    },
    {
      name: 'Verified Images',
      value: realtimeStats.verifiedImages,
      icon: FileText,
      color: 'text-relief-600',
      bgColor: 'bg-relief-50',
      change: '85% accuracy rate',
      changeType: 'neutral'
    },
    {
      name: 'Online Users',
      value: realtimeStats.onlineUsers,
      icon: Users,
      color: 'text-emergency-600',
      bgColor: 'bg-emergency-50',
      change: 'Real-time',
      changeType: 'neutral'
    }
  ]

  const quickActions = [
    {
      name: 'Create New Disaster',
      description: 'Report a new disaster event',
      href: '/disasters/new',
      icon: AlertTriangle,
      color: 'bg-disaster-600 hover:bg-disaster-700'
    },
    {
      name: 'View Social Media',
      description: 'Monitor social media reports',
      href: '/social-media',
      icon: MessageSquare,
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      name: 'Find Resources',
      description: 'Locate nearby resources',
      href: '/resources',
      icon: MapPin,
      color: 'bg-relief-600 hover:bg-relief-700'
    },
    {
      name: 'Official Updates',
      description: 'Check government updates',
      href: '/official-updates',
      icon: FileText,
      color: 'bg-emergency-600 hover:bg-emergency-700'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Real-time disaster response coordination platform
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="pulse-dot">
              <span className="pulse-ring"></span>
            </div>
            <span className="text-sm text-gray-600">Live Updates</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="card">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
                <div className="mt-4 flex items-center">
                  <TrendingUp className={`h-4 w-4 mr-1 ${stat.changeType === 'increase' ? 'text-relief-600' : 'text-gray-400'
                    }`} />
                  <span className="text-sm text-gray-600">{stat.change}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.name}
                  to={action.href}
                  className={`p-4 rounded-lg text-white transition-colors ${action.color} group`}
                >
                  <Icon className="h-8 w-8 mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold mb-1">{action.name}</h3>
                  <p className="text-sm opacity-90">{action.description}</p>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Disasters */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Disasters</h2>
            <Link to="/disasters" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              View all
            </Link>
          </div>
          <div className="card-body">
            {disastersLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : disastersData?.data?.disasters?.length > 0 ? (
              <div className="space-y-4">
                {disastersData.data.disasters.slice(0, 5).map((disaster) => (
                  <div key={disaster.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-disaster-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/disasters/${disaster.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600 block truncate"
                      >
                        {disaster.title}
                      </Link>
                      <p className="text-sm text-gray-600 truncate">{disaster.location_name}</p>
                      <div className="flex items-center mt-1 space-x-2">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {new Date(disaster.created_at).toLocaleDateString()}
                        </span>
                        {disaster.tags?.map((tag) => (
                          <span key={tag} className="badge badge-primary text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No recent disasters</p>
              </div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Activity className="h-5 w-5 text-relief-600 mr-2" />
                  <span className="text-sm font-medium">API Services</span>
                </div>
                <span className="badge badge-success">Operational</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MessageSquare className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-sm font-medium">Social Media Monitoring</span>
                </div>
                <span className="badge badge-success">Active</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-emergency-600 mr-2" />
                  <span className="text-sm font-medium">Geospatial Services</span>
                </div>
                <span className="badge badge-success">Online</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-gray-600 mr-2" />
                  <span className="text-sm font-medium">Official Updates</span>
                </div>
                <span className="badge badge-warning">Limited</span>
              </div>
            </div>

            <div className="mt-6 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This is a demonstration platform. Some services use mock data for testing purposes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
