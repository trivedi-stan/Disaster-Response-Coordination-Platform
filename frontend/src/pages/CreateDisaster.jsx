import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation } from 'react-query'
import toast from 'react-hot-toast'
import { 
  AlertTriangle, 
  MapPin, 
  Save, 
  ArrowLeft,
  Loader2,
  Search
} from 'lucide-react'
import disasterService from '../services/disasters'
import geocodingService from '../services/geocoding'

const CreateDisaster = () => {
  const navigate = useNavigate()
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [extractedLocations, setExtractedLocations] = useState([])
  
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    defaultValues: {
      title: '',
      description: '',
      location_name: '',
      tags: [],
      lat: '',
      lng: ''
    }
  })

  const description = watch('description')
  const locationName = watch('location_name')

  // Create disaster mutation
  const createMutation = useMutation(disasterService.createDisaster, {
    onSuccess: (data) => {
      toast.success('Disaster created successfully!')
      navigate(`/disasters/${data.data.id}`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create disaster')
    }
  })

  // Extract locations from description
  const extractLocations = async () => {
    if (!description.trim()) {
      toast.error('Please enter a description first')
      return
    }

    setIsGeocoding(true)
    try {
      const response = await geocodingService.geocode({ description })
      
      if (response.data.locations && response.data.locations.length > 0) {
        setExtractedLocations(response.data.locations)
        
        // Auto-fill the first location
        const firstLocation = response.data.locations[0]
        if (firstLocation.geocoding_success) {
          setValue('location_name', firstLocation.location_name)
          setValue('lat', firstLocation.lat)
          setValue('lng', firstLocation.lng)
          toast.success(`Found ${response.data.locations.length} location(s)`)
        }
      } else {
        toast.error('No locations found in description')
        setExtractedLocations([])
      }
    } catch (error) {
      toast.error('Failed to extract locations')
      console.error('Location extraction error:', error)
    } finally {
      setIsGeocoding(false)
    }
  }

  // Geocode location name
  const geocodeLocation = async () => {
    if (!locationName.trim()) {
      toast.error('Please enter a location name first')
      return
    }

    setIsGeocoding(true)
    try {
      const response = await geocodingService.geocode({ location_name: locationName })
      
      if (response.data.primary_location) {
        const location = response.data.primary_location
        setValue('lat', location.lat)
        setValue('lng', location.lng)
        toast.success('Location geocoded successfully')
      } else {
        toast.error('Could not geocode location')
      }
    } catch (error) {
      toast.error('Failed to geocode location')
      console.error('Geocoding error:', error)
    } finally {
      setIsGeocoding(false)
    }
  }

  const onSubmit = (data) => {
    // Convert tags string to array
    const tags = data.tags
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)

    const disasterData = {
      title: data.title,
      description: data.description,
      location_name: data.location_name || undefined,
      tags,
      lat: data.lat ? parseFloat(data.lat) : undefined,
      lng: data.lng ? parseFloat(data.lng) : undefined
    }

    createMutation.mutate(disasterData)
  }

  const commonTags = [
    'flood', 'earthquake', 'hurricane', 'tornado', 'wildfire',
    'tsunami', 'volcano', 'landslide', 'drought', 'blizzard',
    'emergency', 'urgent', 'medical', 'shelter', 'evacuation'
  ]

  const addTag = (tag) => {
    const currentTags = watch('tags')
    const tagsArray = currentTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
    
    if (!tagsArray.includes(tag)) {
      const newTags = [...tagsArray, tag].join(', ')
      setValue('tags', newTags)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/disasters')}
          className="btn btn-secondary"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Disaster</h1>
          <p className="text-gray-600">Report a new disaster event for coordination</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
          </div>
          <div className="card-body space-y-4">
            {/* Title */}
            <div>
              <label className="form-label">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('title', { 
                  required: 'Title is required',
                  minLength: { value: 3, message: 'Title must be at least 3 characters' }
                })}
                className="form-input"
                placeholder="e.g., NYC Flood Emergency"
              />
              {errors.title && (
                <p className="text-red-600 text-sm mt-1">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="form-label">Description</label>
              <div className="relative">
                <textarea
                  {...register('description')}
                  rows={4}
                  className="form-input"
                  placeholder="Describe the disaster situation, affected areas, and current conditions..."
                />
                <button
                  type="button"
                  onClick={extractLocations}
                  disabled={isGeocoding || !description.trim()}
                  className="absolute bottom-2 right-2 btn btn-primary text-sm"
                >
                  {isGeocoding ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Search className="h-4 w-4 mr-1" />
                  )}
                  Extract Locations
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Use the "Extract Locations" button to automatically find locations mentioned in your description.
              </p>
            </div>

            {/* Extracted Locations */}
            {extractedLocations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Extracted Locations:</h3>
                <div className="space-y-2">
                  {extractedLocations.map((location, index) => (
                    <div key={index} className="flex items-center justify-between bg-white rounded p-2">
                      <div>
                        <span className="font-medium">{location.location_name}</span>
                        {location.geocoding_success && (
                          <span className="text-sm text-gray-600 ml-2">
                            ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
                          </span>
                        )}
                      </div>
                      {location.geocoding_success && (
                        <button
                          type="button"
                          onClick={() => {
                            setValue('location_name', location.location_name)
                            setValue('lat', location.lat)
                            setValue('lng', location.lng)
                          }}
                          className="btn btn-primary text-sm"
                        >
                          Use This
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Location Information */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Location Information</h2>
          </div>
          <div className="card-body space-y-4">
            {/* Location Name */}
            <div>
              <label className="form-label">Location Name</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  {...register('location_name')}
                  className="form-input flex-1"
                  placeholder="e.g., Manhattan, NYC"
                />
                <button
                  type="button"
                  onClick={geocodeLocation}
                  disabled={isGeocoding || !locationName.trim()}
                  className="btn btn-secondary"
                >
                  {isGeocoding ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <MapPin className="h-4 w-4 mr-1" />
                  )}
                  Geocode
                </button>
              </div>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Latitude</label>
                <input
                  type="number"
                  step="any"
                  {...register('lat')}
                  className="form-input"
                  placeholder="40.7831"
                />
              </div>
              <div>
                <label className="form-label">Longitude</label>
                <input
                  type="number"
                  step="any"
                  {...register('lng')}
                  className="form-input"
                  placeholder="-73.9712"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Tags</h2>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="form-label">Tags (comma-separated)</label>
              <input
                type="text"
                {...register('tags')}
                className="form-input"
                placeholder="flood, urgent, emergency"
              />
              <p className="text-sm text-gray-500 mt-1">
                Add relevant tags to help categorize and filter this disaster.
              </p>
            </div>

            {/* Common Tags */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Quick add common tags:</p>
              <div className="flex flex-wrap gap-2">
                {commonTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className="px-3 py-1 text-sm bg-gray-100 border border-gray-300 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/disasters')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isLoading}
            className="btn btn-primary"
          >
            {createMutation.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Save className="h-5 w-5 mr-2" />
            )}
            Create Disaster
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateDisaster
