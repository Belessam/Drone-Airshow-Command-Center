export interface SimulationState {
  drone_id: string
  start_latitude: number
  start_longitude: number
  heading: number
  speed_mps: number
  altitude: number
  started_at: string
  current_latitude: number
  current_longitude: number
  current_altitude: number
  elapsed_seconds: number
}

export interface SimulationSegment {
  start_latitude: number
  start_longitude: number
  end_latitude: number
  end_longitude: number
  heading: number
  speed_mps: number
  altitude: number
  started_at: string
  ended_at: string
}

export interface EstimatedPosition {
  latitude: number
  longitude: number
  altitude: number
  elapsed_seconds: number
}
