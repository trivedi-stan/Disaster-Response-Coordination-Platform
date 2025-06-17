import { useParams } from 'react-router-dom'
import { useQuery } from 'react-query'
import { AlertTriangle, MapPin, Clock, User, Tag } from 'lucide-react'
import disasterService from '../services/disasters'

const DisasterDetail = () => {
  const { id } = useParams()
  
  const { data, isLoading, error } = useQuery(
    ['disaster', id],
    () => disasterService.getDisaster(id),
    { enabled: !!id }
  )

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <AlertTriangle className="h-12 w-12 text-disaster-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Disaster</h3>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    )
  }

  const disaster = data?.data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="card-body">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{disaster?.title}</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            {disaster?.location_name && (
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                {disaster.location_name}
              </div>
            )}
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              {new Date(disaster?.created_at).toLocaleDateString()}
            </div>
            <div className="flex items-center">
              <User className="h-4 w-4 mr-2" />
              {disaster?.owner_id}
            </div>
          </div>

          {disaster?.description && (
            <div className="mt-4">
              <p className="text-gray-700">{disaster.description}</p>
            </div>
          )}

          {disaster?.tags && disaster.tags.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center mb-2">
                <Tag className="h-4 w-4 mr-2 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Tags:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {disaster.tags.map((tag) => (
                  <span key={tag} className="badge badge-primary">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Placeholder for additional sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Social Media Reports</h2>
          </div>
          <div className="card-body">
            <p className="text-gray-600">Social media monitoring will be displayed here.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Nearby Resources</h2>
          </div>
          <div className="card-body">
            <p className="text-gray-600">Resource mapping will be displayed here.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DisasterDetail
