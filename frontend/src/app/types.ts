export type PageId =
  | 'home'
  | 'search'
  | 'search-results'
  | 'gallery'
  | 'profile'
  | 'sign-in'
  | 'create-account'
  | 'images'
  | 'live-chat'
  | 'journal'
  | 'settings';

export type PageNavigator = (page: PageId) => void

export type Role = 'traveler' | 'admin'

export type NavItem = {
  id: PageId
  label: string
  hint: string
}

export type Metric = {
  label: string
  value: string
  detail: string
}

export type PhotoEntry = {
  id: number
  title: string
  location: string
  date: string
  type: 'Landmark' | 'Food'
  insight: string
  nextStep: string
  theme: 'coast' | 'city' | 'market' | 'night'
}

export type WorkflowItem = {
  title: string
  detail: string
}

export type MockAccount = {
  firstName: string
  lastName: string
  userId: string
  email: string
  password: string
}

export type AuthUser = {
  userId: string
  firstName: string
  lastName: string
  email: string
  role: Role
}

export type AuthResult = {
  success: boolean
  message?: string
}

export type GalleryImage = {
  id: number
  title: string
  date: string
  category: string
  theme: PhotoEntry['theme']
  latitude?: number
  longitude?: number
}

export type GalleryGroup = {
  id: number
  title: string
  city: string
  country: string
  type: string
  lastUpdate: string
  description: string
  theme: PhotoEntry['theme']
  isLocked: boolean
  images: GalleryImage[]
}
