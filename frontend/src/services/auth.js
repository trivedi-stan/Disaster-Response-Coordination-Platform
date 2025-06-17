// Mock authentication service
const mockUsers = {
  'netrunnerX': {
    id: 'netrunnerX',
    name: 'Emergency Coordinator',
    role: 'admin',
    permissions: ['create', 'read', 'update', 'delete', 'manage_users', 'verify_images']
  },
  'reliefAdmin': {
    id: 'reliefAdmin',
    name: 'Relief Administrator',
    role: 'contributor',
    permissions: ['create', 'read', 'update', 'verify_reports']
  },
  'citizen1': {
    id: 'citizen1',
    name: 'Citizen Reporter',
    role: 'reporter',
    permissions: ['create', 'read']
  },
  'responder1': {
    id: 'responder1',
    name: 'First Responder',
    role: 'responder',
    permissions: ['read', 'update', 'create_reports']
  }
}

export const getCurrentUser = () => {
  const stored = localStorage.getItem('currentUser')
  if (stored) {
    const user = JSON.parse(stored)
    return mockUsers[user.id] || null
  }
  
  // Default to netrunnerX for demo
  const defaultUser = mockUsers['netrunnerX']
  localStorage.setItem('currentUser', JSON.stringify(defaultUser))
  return defaultUser
}

export const setCurrentUser = (userId) => {
  const user = mockUsers[userId]
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user))
    return user
  }
  return null
}

export const logout = () => {
  localStorage.removeItem('currentUser')
}

export const hasPermission = (permission) => {
  const user = getCurrentUser()
  return user && user.permissions.includes(permission)
}

export const hasRole = (role) => {
  const user = getCurrentUser()
  return user && user.role === role
}

export const getAvailableUsers = () => {
  return Object.values(mockUsers).map(user => ({
    id: user.id,
    name: user.name,
    role: user.role
  }))
}
