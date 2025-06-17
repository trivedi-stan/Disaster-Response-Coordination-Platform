import { MapPin, Home, Utensils, Heart } from 'lucide-react'

const Resources = () => {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h1 className="text-2xl font-bold text-gray-900">Resource Mapping</h1>
          <p className="text-gray-600">Geospatial resource location and management</p>
        </div>
        <div className="card-body text-center py-12">
          <MapPin className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Geospatial Resource Mapping</h3>
          <p className="text-gray-600 mb-4">
            This page will display an interactive map showing available resources and their locations.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-blue-50 p-4 rounded-lg">
              <Home className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <h4 className="font-semibold text-blue-900">Shelters</h4>
              <p className="text-sm text-blue-700">Emergency housing and accommodation</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <Utensils className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <h4 className="font-semibold text-orange-900">Food & Water</h4>
              <p className="text-sm text-orange-700">Distribution centers and supplies</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <Heart className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <h4 className="font-semibold text-red-900">Medical</h4>
              <p className="text-sm text-red-700">Hospitals and medical facilities</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Resources
