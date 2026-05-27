export type PageId =
  | 'search'
  | 'search-results'
  | 'travelize-1'
  | 'travelize-2'
  | 'travelize-3'
  | 'travelize-4'
  | 'gallery'
  | 'profile'
  | 'settings'
  | 'live-chat'
  | 'admin'
  | 'sign-in'
  | 'create-account'
  | 'images'
  | 'journal';

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
}

export type GalleryGroup = {
  id: number
  title: string
  city: string
  type: string
  lastUpdate: string
  description: string
  theme: PhotoEntry['theme']
  images: GalleryImage[]
}
