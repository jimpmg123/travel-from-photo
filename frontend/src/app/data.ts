import type {
  GalleryGroup,
  Metric,
  MockAccount,
  NavItem,
  PhotoEntry,
  WorkflowItem,
} from './types'

export const navItems: NavItem[] = [
  { id: 'home',      label: 'Home',     hint: 'search travel photos' },
  { id: 'journal',   label: 'Journal',  hint: 'generate travel log' },
  { id: 'gallery',   label: 'Gallery',  hint: 'my uploads' },
  { id: 'live-chat', label: 'Chat',     hint: 'live chat among users' },
  { id: 'profile',   label: 'Profile',  hint: 'account info' },
  { id: 'settings',  label: 'Settings', hint: 'account & preferences' },
  { id: 'admin',     label: 'Admin',    hint: 'moderation tools' },
]

export const metrics: Metric[] = [
  {
    label: 'Main journey',
    value: 'Photo -> place -> route',
    detail: 'Travel photos are resolved through EXIF, landmark cues, and user hints.',
  },
  {
    label: 'Food extension',
    value: 'Meal -> cuisine -> restaurant',
    detail: 'Food images can branch into restaurant discovery with location hints and recent uploads.',
  },
  {
    label: 'Required access',
    value: 'Mock sign-in ready',
    detail: 'Gallery access is gated so the signed-in flow already exists in the frontend.',
  },
  {
    label: 'Course fit',
    value: 'Responsive + media-based',
    detail: 'The shell is built around upload-first interactions across desktop and mobile.',
  },
]

export const uploadedPhotos: PhotoEntry[] = [
  {
    id: 1,
    title: 'Sunrise at the harbor',
    location: 'Busan, South Korea',
    date: '2026-03-08',
    type: 'Landmark',
    insight: 'Pier geometry and coastline cues suggest a harbor observation point.',
    nextStep: 'Open place estimate and compare with nearby viewpoints.',
    theme: 'coast',
  },
  {
    id: 2,
    title: 'Lantern alley dinner',
    location: 'Kyoto, Japan',
    date: '2026-03-06',
    type: 'Food',
    insight: 'Likely ramen set. Use recent travel photos plus city hint to narrow restaurant candidates.',
    nextStep: 'Search nearby ramen restaurants and build the final route.',
    theme: 'market',
  },
  {
    id: 3,
    title: 'Museum plaza',
    location: 'Chicago, United States',
    date: '2026-03-01',
    type: 'Landmark',
    insight: 'Strong skyline silhouette and plaza layout support a downtown landmark search.',
    nextStep: 'Confirm the exact plaza, then request directions from current location.',
    theme: 'city',
  },
  {
    id: 4,
    title: 'Night snack stop',
    location: 'Taipei, Taiwan',
    date: '2026-02-24',
    type: 'Food',
    insight: 'Street-food plate with neon ambience fits market-style restaurant discovery.',
    nextStep: 'Use night market context and saved uploads to rank nearby stalls.',
    theme: 'night',
  },
]

export const travelWorkflow: WorkflowItem[] = [
  {
    title: '1. Upload a travel photo',
    detail: 'Start with EXIF coordinates, then fall back to landmark and visual feature matching.',
  },
  {
    title: '2. Add hints only when needed',
    detail: 'Country and city inputs help reduce the candidate pool when the image is ambiguous.',
  },
  {
    title: '3. Return a route-ready destination',
    detail: 'The final output should be a place card that can open guidance immediately.',
  },
]

export const foodWorkflow: WorkflowItem[] = [
  {
    title: '1. Detect cuisine from the meal',
    detail: 'Food photos branch into cuisine recognition before trying to identify a restaurant area.',
  },
  {
    title: '2. Reuse recent uploads',
    detail:
      'The latest travel photos act as soft evidence for region, city, and nearby restaurant context.',
  },
  {
    title: '3. Suggest where to go',
    detail: 'The result is a ranked list of restaurant candidates plus a route entry point.',
  },
]

export const profileNotes: WorkflowItem[] = [
  {
    title: 'Saved hints',
    detail: 'Preferred countries, cities, and transport modes can prefill future searches.',
  },
  {
    title: 'Privacy controls',
    detail: 'Photo history and extracted EXIF data should be visible only to the signed-in owner.',
  },
  {
    title: 'Beta delivery',
    detail: 'This layout keeps deployment and login entry points visible from the start.',
  },
]

export const adminQueue: WorkflowItem[] = [
  {
    title: 'Review uploaded media',
    detail: 'Scan unclear uploads before they become shared examples or public content.',
  },
  {
    title: 'Check reported results',
    detail: 'Users can flag bad place guesses or incorrect restaurant matches for review.',
  },
  {
    title: 'Monitor future live chat',
    detail: 'Real-time chat is deferred, but the admin view reserves room for moderation later.',
  },
]

export const defaultMockAccount: MockAccount = {
  firstName: 'Jinu',
  lastName: 'Hong',
  userId: 'jinuhong',
  email: 'jinu@example.com',
  password: 'travel2026',
}

// Mock collections removed — the gallery now starts empty and only populates
// when real uploads land in image_metadata (via the Search/upload pipeline,
// not yet wired). The export is kept so callers can import it without a
// build-time error.
export const galleryGroups: GalleryGroup[] = []
