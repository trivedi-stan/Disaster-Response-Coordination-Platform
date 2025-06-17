import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'react-query'
import { 
  AlertTriangle, 
  Plus, 
  Search, 
  Filter, 
  MapPin, 
  Clock, 
  User,
  Eye,
  Edit,
  Trash2
} from 'lucide-react'
import disasterService from '../services/disasters'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission } from '../services/auth'

const DisasterList = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [page, setPage] = useState(1)
  const { user } = useAuth()

  // Fetch disasters with filters
  const { data, isLoading, error, refetch } = useQuery(
    ['disasters', { search: searchTerm, tag: selectedTag, page }],
    () => disasterService.getDisasters({
      search: searchTerm || undefined,
      tag: selectedTag || undefined,
      page,
      limit: 10
    }),
    {
      keepPreviousData: true,
      refetchInterval: 30000 // Refetch every 30 seconds
    }
  )

  const disasters = data?.data?.disasters || []
  const pagination = data?.data?.pagination || {}

  // Common disaster tags for filtering
  const commonTags = [
    'flood', 'earthquake', 'hurricane', 'tornado', 'wildfire',
    'tsunami', 'volcano', 'landslide', 'drought', 'blizzard',
    'emergency', 'urgent', 'medical', 'shelter', 'evacuation'
  ]

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    refetch()
  }

  const handleTagFilter = (tag) => {
    setSelectedTag(tag === selectedTag ? '' : tag)
    setPage(1)
  }

  const getPriorityColor = (tags) => {
    if (tags?.includes('urgent') || tags?.includes('emergency')) return 'border-l-red-500'
    if (tags?.includes('medical') || tags?.includes('rescue')) return 'border-l-orange-500'
    if (tags?.includes('evacuation')) return 'border-l-yellow-500'
    return 'border-l-blue-500'
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <AlertTriangle className="h-12 w-12 text-disaster-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Disasters</h3>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <button onClick={() => refetch()} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disasters</h1>
          <p className="text-gray-600">Manage and monitor disaster events</p>
        </div>
        {hasPermission('create') && (
          <Link to="/disasters/new" className="btn btn-primary">
            <Plus className="h-5 w-5 mr-2" />
            Create Disaster
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search disasters..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input pl-10"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </form>

          {/* Tag filters */}
          <div className="mt-4">
            <div className="flex items-center mb-2">
              <Filter className="h-4 w-4 text-gray-500 mr-2" />
              <span className="text-sm font-medium text-gray-700">Filter by tag:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {commonTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagFilter(tag)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    selectedTag === tag
                      ? 'bg-blue-100 border-blue-300 text-blue-800'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
              {selectedTag && (
                <button
                  onClick={() => setSelectedTag('')}
                  className="px-3 py-1 text-sm rounded-full bg-red-100 border-red-300 text-red-800 hover:bg-red-200"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Disasters List */}
      <div className="space-y-4">
        {isLoading ? (
          // Loading skeleton
          [...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="card-body">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))
        ) : disasters.length > 0 ? (
          disasters.map((disaster) => (
            <div key={disaster.id} className={`card border-l-4 ${getPriorityColor(disaster.tags)}`}>
              <div className="card-body">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <Link 
                        to={`/disasters/${disaster.id}`}
                        className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {disaster.title}
                      </Link>
                    </div>
                    
                    {disaster.description && (
                      <p className="text-gray-600 mb-3 line-clamp-2">{disaster.description}</p>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      {disaster.location_name && (
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {disaster.location_name}
                        </div>
                      )}
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatDate(disaster.created_at)}
                      </div>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        {disaster.owner_id}
                      </div>
                    </div>
                    
                    {disaster.tags && disaster.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {disaster.tags.map((tag) => (
                          <span key={tag} className="badge badge-primary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Link 
                      to={`/disasters/${disaster.id}`}
                      className="btn btn-secondary text-sm"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Link>
                    {(hasPermission('update') && (user?.id === disaster.owner_id || user?.role === 'admin')) && (
                      <button className="btn btn-warning text-sm">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                    )}
                    {(hasPermission('delete') && (user?.id === disaster.owner_id || user?.role === 'admin')) && (
                      <button className="btn btn-danger text-sm">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="card">
            <div className="card-body text-center py-12">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Disasters Found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedTag 
                  ? 'Try adjusting your search criteria or filters.'
                  : 'No disasters have been reported yet.'
                }
              </p>
              {hasPermission('create') && (
                <Link to="/disasters/new" className="btn btn-primary">
                  <Plus className="h-5 w-5 mr-2" />
                  Create First Disaster
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={!pagination.hasPrev}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-sm text-gray-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!pagination.hasNext}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DisasterList
