import { MessageSquare, TrendingUp, AlertCircle } from 'lucide-react'

const SocialMedia = () => {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h1 className="text-2xl font-bold text-gray-900">Social Media Monitoring</h1>
          <p className="text-gray-600">Real-time social media reports and analysis</p>
        </div>
        <div className="card-body text-center py-12">
          <MessageSquare className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Social Media Integration</h3>
          <p className="text-gray-600 mb-4">
            This page will display real-time social media reports from Twitter, Bluesky, and other platforms.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-blue-50 p-4 rounded-lg">
              <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <h4 className="font-semibold text-blue-900">Real-time Monitoring</h4>
              <p className="text-sm text-blue-700">Track disaster-related posts and mentions</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <AlertCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h4 className="font-semibold text-green-900">Priority Detection</h4>
              <p className="text-sm text-green-700">Identify urgent reports and SOS calls</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <MessageSquare className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <h4 className="font-semibold text-purple-900">Sentiment Analysis</h4>
              <p className="text-sm text-purple-700">Analyze public sentiment and needs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SocialMedia
