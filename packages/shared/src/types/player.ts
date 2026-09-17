export interface PlayerProfileSummary {
  id: string;
  displayName: string;
  level: number;
  xp: number;
  coins: number;
  selectedVehicleId: string;
  isGuest: boolean;
}

export interface VehicleCustomizationState {
  vehicleId: string;
  colorwayId: string;
  wheelId: string;
  spoilerId: string;
  decalId: string | null;
  boostTrailId: string;
  hornId: string;
}
