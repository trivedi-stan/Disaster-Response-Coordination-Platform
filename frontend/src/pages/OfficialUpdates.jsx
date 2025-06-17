import { FileText, Globe, AlertTriangle } from 'lucide-react'

const OfficialUpdates = () => {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h1 className="text-2xl font-bold text-gray-900">Official Updates</h1>
          <p className="text-gray-600">Government and relief organization updates</p>
        </div>
        <div className="card-body text-center py-12">
          <FileText className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Official Update Aggregation</h3>
          <p className="text-gray-600 mb-4">
            This page will display official updates from FEMA, Red Cross, and other government agencies.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-blue-50 p-4 rounded-lg">
              <Globe className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <h4 className="font-semibold text-blue-900">FEMA Updates</h4>
              <p className="text-sm text-blue-700">Federal emergency management announcements</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <h4 className="font-semibold text-red-900">Red Cross</h4>
              <p className="text-sm text-red-700">Relief organization updates and resources</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <FileText className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h4 className="font-semibold text-green-900">Local Authorities</h4>
              <p className="text-sm text-green-700">Local government and emergency services</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OfficialUpdates
