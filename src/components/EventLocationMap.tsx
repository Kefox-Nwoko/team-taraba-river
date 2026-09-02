/**
 * EventLocationMap — Stub component.
 * Renders a simple location label. Replace with a real map integration if needed.
 */
interface EventLocationMapProps {
  location?: string;
  className?: string;
}

export function EventLocationMap({ location, className }: EventLocationMapProps) {
  if (!location) return null;
  return (
    <div className={className} style={{ fontSize: 13, color: '#64748b' }}>
      📍 {location}
    </div>
  );
}
