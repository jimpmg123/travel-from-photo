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
  { id: 'settings',  label: 'Settings', hint: 'account & preferences' },
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

export const galleryGroups: GalleryGroup[] = [
  {
    id: 1,
    title: 'Busan memory set',
    city: 'Busan, South Korea',
    type: 'Mixed city memory',
    lastUpdate: 'Updated 3 days ago',
    description: 'Coastal landmarks, harbor views, and city streets from an early spring trip.',
    theme: 'coast',
    images: [
      { id: 101, title: 'Harbor View', date: 'March 10, 2026', category: 'Landmark', theme: 'coast' },
      { id: 102, title: 'Sunrise Pier', date: 'March 10, 2026', category: 'Scenic', theme: 'coast' },
      { id: 103, title: 'Bridge Skyline', date: 'March 11, 2026', category: 'Cityscape', theme: 'city' },
      { id: 104, title: 'Ocean Walk', date: 'March 11, 2026', category: 'Scenic', theme: 'coast' },
    ],
  },
  {
    id: 2,
    title: 'Kyoto food trail',
    city: 'Kyoto, Japan',
    type: 'Food group',
    lastUpdate: 'Updated 1 week ago',
    description: 'Late-night ramen spots, alleys, and market meals from a Kyoto food run.',
    theme: 'market',
    images: [
      { id: 201, title: 'Lantern Ramen', date: 'March 06, 2026', category: 'Food', theme: 'market' },
      { id: 202, title: 'Street Counter', date: 'March 06, 2026', category: 'Food', theme: 'market' },
      { id: 203, title: 'Night Alley', date: 'March 07, 2026', category: 'Cityscape', theme: 'night' },
      { id: 204, title: 'Market Bowl', date: 'March 07, 2026', category: 'Food', theme: 'market' },
    ],
  },
  {
    id: 3,
    title: 'Chicago city set',
    city: 'Chicago, United States',
    type: 'Landmark group',
    lastUpdate: 'Updated 2 weeks ago',
    description: 'Downtown plazas, museum views, and the skyline edge around the lakefront.',
    theme: 'city',
    images: [
      { id: 301, title: 'Museum Plaza', date: 'March 01, 2026', category: 'Landmark', theme: 'city' },
      { id: 302, title: 'Lakefront Wind', date: 'March 01, 2026', category: 'Scenic', theme: 'city' },
      { id: 303, title: 'Downtown Grid', date: 'March 02, 2026', category: 'Cityscape', theme: 'city' },
      { id: 304, title: 'Glass Tower', date: 'March 02, 2026', category: 'Landmark', theme: 'city' },
    ],
  },
  {
    id: 4,
    title: 'Taipei street moments',
    city: 'Taipei, Taiwan',
    type: 'Mixed city memory',
    lastUpdate: 'Updated 3 weeks ago',
    description: 'Street food, neon markets, and dense late-night neighborhood scenes.',
    theme: 'night',
    images: [
      { id: 401, title: 'Night Snack', date: 'February 24, 2026', category: 'Food', theme: 'night' },
      { id: 402, title: 'Neon Crossing', date: 'February 24, 2026', category: 'Cityscape', theme: 'night' },
      { id: 403, title: 'Temple Corner', date: 'February 25, 2026', category: 'Landmark', theme: 'market' },
      { id: 404, title: 'Market Steam', date: 'February 25, 2026', category: 'Food', theme: 'market' },
    ],
  },
]
