import api from './api'

export const disasterService = {
  // Get all disasters with optional filtering
  getDisasters: async (params = {}) => {
    const response = await api.get('/disasters', { params })
    return response.data
  },

  // Get a specific disaster by ID
  getDisaster: async (id) => {
    const response = await api.get(`/disasters/${id}`)
    return response.data
  },

  // Create a new disaster
  createDisaster: async (disasterData) => {
    const response = await api.post('/disasters', disasterData)
    return response.data
  },

  // Update a disaster
  updateDisaster: async (id, disasterData) => {
    const response = await api.put(`/disasters/${id}`, disasterData)
    return response.data
  },

  // Delete a disaster
  deleteDisaster: async (id) => {
    const response = await api.delete(`/disasters/${id}`)
    return response.data
  },

  // Get social media reports for a disaster
  getSocialMediaReports: async (id, params = {}) => {
    const response = await api.get(`/disasters/${id}/social-media`, { params })
    return response.data
  },

  // Get resources for a disaster
  getResources: async (id, params = {}) => {
    const response = await api.get(`/disasters/${id}/resources`, { params })
    return response.data
  },

  // Get official updates for a disaster
  getOfficialUpdates: async (id, params = {}) => {
    const response = await api.get(`/disasters/${id}/official-updates`, { params })
    return response.data
  },

  // Verify disaster image
  verifyImage: async (id, imageData) => {
    const response = await api.post(`/disasters/${id}/verify-image`, imageData)
    return response.data
  }
}

export default disasterService
