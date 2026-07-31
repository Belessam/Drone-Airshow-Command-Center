export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

export function validateDroneId(id: string): string | null {
  if (!id || !id.trim()) return 'Drone ID is required.'
  if (id.trim().length < 2) return 'Drone ID must be at least 2 characters.'
  return null
}

export function validateLatitude(lat: number): string | null {
  if (isNaN(lat)) return 'Latitude must be a number.'
  if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.'
  return null
}

export function validateLongitude(lng: number): string | null {
  if (isNaN(lng)) return 'Longitude must be a number.'
  if (lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.'
  return null
}

export function validateHeading(heading: number): string | null {
  if (isNaN(heading)) return 'Heading must be a number.'
  if (heading < 0 || heading >= 360) return 'Heading must be between 0 and 360.'
  return null
}

export function validateSpeed(speed: number): string | null {
  if (isNaN(speed)) return 'Speed must be a number.'
  if (speed < 0) return 'Speed cannot be negative.'
  if (speed > 500) return 'Speed exceeds maximum (500 m/s).'
  return null
}

export function validateAltitude(altitude: number): string | null {
  if (isNaN(altitude)) return 'Altitude must be a number.'
  if (altitude < 0) return 'Altitude cannot be negative.'
  if (altitude > 100000) return 'Altitude exceeds maximum (100,000 m).'
  return null
}

export function validateDroneForm(values: {
  droneId?: string
  latitude: string
  longitude: string
  heading: string
  speed: string
  altitude: string
}): ValidationResult {
  const errors: Record<string, string> = {}

  if (values.droneId !== undefined) {
    const idErr = validateDroneId(values.droneId)
    if (idErr) errors.droneId = idErr
  }

  const lat = parseFloat(values.latitude)
  const lng = parseFloat(values.longitude)
  const hdg = parseFloat(values.heading)
  const spd = parseFloat(values.speed)
  const alt = parseFloat(values.altitude)

  const latErr = validateLatitude(lat)
  if (latErr) errors.latitude = latErr

  const lngErr = validateLongitude(lng)
  if (lngErr) errors.longitude = lngErr

  const hdgErr = validateHeading(hdg)
  if (hdgErr) errors.heading = hdgErr

  const spdErr = validateSpeed(spd)
  if (spdErr) errors.speed = spdErr

  const altErr = validateAltitude(alt)
  if (altErr) errors.altitude = altErr

  return { valid: Object.keys(errors).length === 0, errors }
}
