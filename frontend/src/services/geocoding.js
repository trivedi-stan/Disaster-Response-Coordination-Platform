import api from './api'

export const geocodingService = {
  // Extract location from description and geocode
  geocode: async (data) => {
    const response = await api.post('/geocode', data)
    return response.data
  },

  // Reverse geocode coordinates to location
  reverseGeocode: async (lat, lng) => {
    const response = await api.get('/geocode/reverse', {
      params: { lat, lng }
    })
    return response.data
  },

  // Batch geocode multiple locations
  batchGeocode: async (locations) => {
    const response = await api.post('/geocode/batch', { locations })
    return response.data
  }
}

export default geocodingService
