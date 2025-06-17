import { Camera, Shield, CheckCircle } from 'lucide-react'

const ImageVerification = () => {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h1 className="text-2xl font-bold text-gray-900">Image Verification</h1>
          <p className="text-gray-600">AI-powered disaster image authenticity verification</p>
        </div>
        <div className="card-body text-center py-12">
          <Camera className="h-16 w-16 text-purple-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Image Verification</h3>
          <p className="text-gray-600 mb-4">
            This page will provide tools to verify the authenticity of disaster-related images using Google Gemini AI.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-purple-50 p-4 rounded-lg">
              <Shield className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <h4 className="font-semibold text-purple-900">Authenticity Check</h4>
              <p className="text-sm text-purple-700">Detect manipulated or fake images</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h4 className="font-semibold text-green-900">Context Analysis</h4>
              <p className="text-sm text-green-700">Verify disaster context and relevance</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <Camera className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <h4 className="font-semibold text-blue-900">Batch Processing</h4>
              <p className="text-sm text-blue-700">Verify multiple images simultaneously</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageVerification
