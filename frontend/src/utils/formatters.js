// Date formatting utilities
export const formatDate = (dateString, options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
  
  return new Date(dateString).toLocaleDateString('en-US', { ...defaultOptions, ...options })
}

export const formatRelativeTime = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)
  
  if (diffInSeconds < 60) {
    return 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
}

// Number formatting utilities
export const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// Distance formatting
export const formatDistance = (distanceInKm) => {
  if (distanceInKm < 1) {
    return `${Math.round(distanceInKm * 1000)}m`
  }
  return `${distanceInKm.toFixed(1)}km`
}

// Priority formatting
export const getPriorityLabel = (priority) => {
  const labels = {
    1: 'Low',
    2: 'Normal',
    3: 'Medium',
    4: 'High',
    5: 'Critical'
  }
  return labels[priority] || 'Unknown'
}

export const getPriorityColor = (priority) => {
  const colors = {
    1: 'text-gray-600 bg-gray-100',
    2: 'text-blue-600 bg-blue-100',
    3: 'text-yellow-600 bg-yellow-100',
    4: 'text-orange-600 bg-orange-100',
    5: 'text-red-600 bg-red-100'
  }
  return colors[priority] || 'text-gray-600 bg-gray-100'
}

// Status formatting
export const getStatusColor = (status) => {
  const colors = {
    'verified': 'text-green-600 bg-green-100',
    'pending': 'text-yellow-600 bg-yellow-100',
    'rejected': 'text-red-600 bg-red-100',
    'active': 'text-blue-600 bg-blue-100',
    'inactive': 'text-gray-600 bg-gray-100'
  }
  return colors[status] || 'text-gray-600 bg-gray-100'
}

// Tag formatting
export const formatTags = (tags) => {
  if (!Array.isArray(tags)) return []
  return tags.map(tag => tag.toLowerCase().trim()).filter(Boolean)
}

// Coordinate formatting
export const formatCoordinates = (lat, lng, precision = 4) => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return 'Unknown'
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`
}

// Text truncation
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}

// Capitalize first letter
export const capitalize = (str) => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
