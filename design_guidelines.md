# ChatApp - Design Guidelines

## Design Approach
**Reference-Based Approach** inspired by modern chat applications (WhatsApp Web, Slack, Discord) with custom aesthetic requirements emphasizing glassmorphism and gradient treatments.

## Core Visual Identity

### Color Palette
- **Primary Gradient**: Blue to purple vertical transition (`bg-gradient-to-b from-blue-600 to-purple-600`)
- **Status Indicators**: Green (online), Yellow (away), Red (offline), Blue (pending), Orange (attending)
- **Glass Effect**: `backdrop-blur-lg bg-white/10 border border-white/20`

### Typography
- **Font Family**: Inter via Google Fonts
- **Hierarchy**:
  - Headers: `text-xl font-semibold` 
  - Body: `text-base font-normal`
  - Captions: `text-sm text-gray-600`
  - Timestamps: `text-xs text-gray-500`

### Spacing System
**Tailwind Units**: Consistently use 2, 4, 6, 8, 12, 16, 20
- Component padding: `p-4` to `p-6`
- Section spacing: `gap-4` to `gap-8`
- Tight spacing: `space-y-2`

## Layout Architecture

### Header (Full-Width)
- Height: `h-16`
- Glass effect with gradient background
- Fixed positioning: `fixed top-0 w-full z-50`
- Contains: Logo left, user profile right
- Shadow: `shadow-lg`

### Sidebar (Left) - Collapsible
- Width: `w-64` (expanded), `w-16` (collapsed)
- Transition: `transition-all duration-300 ease-in-out`
- Collapse button: Centered on right edge, circular with icon
- When collapsed: Show only icons with tooltips
- Background: `bg-gray-50 border-r border-gray-200`

### Main Content Area
- Margin: Adjust based on sidebar state (`ml-64` or `ml-16`)
- Padding: `p-6`
- Responsive height: `h-[calc(100vh-4rem)]` (accounting for header)

### Sidebar (Right) - Conversation Details
- Width: `w-80` (expanded), `w-0` (collapsed)
- Default state: Collapsed with half-visible expand button on left edge
- Transition: `transition-all duration-300`
- Background: `bg-white border-l border-gray-200`
- Sections: Protocol number (top), user info, attendant, geolocation, conversation history

## Component Library

### Conversation List Card
- Height: `h-20`
- Layout: Flex with `gap-3`
- Structure: Avatar (48px) | Content (name + last message) | Timestamp
- Status dot: `w-3 h-3 rounded-full` positioned on avatar
- Hover: `hover:bg-gray-100 cursor-pointer`
- Active: `bg-blue-50 border-l-4 border-blue-600`

### Tabs (Pendente, Atendendo, Fechada)
- Container: `flex gap-1 bg-gray-100 rounded-lg p-1`
- Active tab: `bg-white shadow-sm rounded-md px-4 py-2`
- Inactive tab: `px-4 py-2 text-gray-600 hover:text-gray-900`
- Badge count: `ml-2 bg-gray-200 text-xs px-2 py-0.5 rounded-full`

### Message Bubble
- User messages: Right-aligned, `bg-blue-600 text-white rounded-l-2xl rounded-tr-2xl`
- Other messages: Left-aligned, `bg-gray-100 text-gray-900 rounded-r-2xl rounded-tl-2xl`
- Padding: `px-4 py-2`
- Max width: `max-w-[70%]`
- Timestamp: Below bubble, `text-xs text-gray-500`

### Message Input Box (Fixed Bottom)
- Container: `fixed bottom-0 bg-white border-t border-gray-200 shadow-lg`
- Expandable: `min-h-[60px] max-h-[200px] resize-y`
- Textarea: `flex-1 px-4 py-3 focus:outline-none resize-none`
- Button row: `flex gap-2` fixed at bottom of container
- Icons: `w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center`
- Send button: `bg-blue-600 text-white rounded-full w-10 h-10`

### Search Input
- Container: `relative`
- Input: `w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500`
- Icon: `absolute left-3 top-1/2 -translate-y-1/2 text-gray-400`

### Button - "Nova Conversa"
- Style: `bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2`
- Icon: Plus icon from Heroicons

### Avatar
- Sizes: `w-12 h-12` (list), `w-10 h-10` (header), `w-8 h-8` (message)
- Style: `rounded-full object-cover`
- Fallback: Initials with gradient background

## Interaction Patterns

### Scrolling
- Conversation list: `overflow-y-auto custom-scrollbar`
- Message area: `overflow-y-auto` with auto-scroll to bottom on new messages
- Custom scrollbar: `scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent`

### States
- Loading: Skeleton screens with `animate-pulse`
- Empty states: Centered icon + text with `text-gray-400`
- Error states: Red toast notifications

### Icons
**Library**: Heroicons (outline for default, solid for active states)
- Collapse/Expand: ChevronLeft/ChevronRight
- Audio: Microphone
- Video: VideCamera
- Images: Photo
- Attachments: PaperClip
- Send: PaperAirplane
- Search: MagnifyingGlass
- New Chat: Plus

## Accessibility
- Focus states: `focus:ring-2 focus:ring-blue-500 focus:outline-none`
- Keyboard navigation: Full support for tab navigation
- ARIA labels: All interactive elements labeled in Portuguese
- Contrast: Minimum 4.5:1 for text

## Responsive Behavior
- Desktop: Full three-column layout
- Tablet: Hide right sidebar by default, overlay on demand
- Mobile: Single column, stack navigation, bottom sheet for details

## Brazilian Portuguese Labels
- "Pendente" / "Atendendo" / "Fechada"
- "Nova Conversa"
- "Buscar conversas..."
- "Protocolo", "Geolocalização", "Conversas Anteriores"
- "Enviar mensagem..."