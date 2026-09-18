/**
 * Parking Lot Layout Configuration
 * 20 parking spaces in 4 rows (bays A, B, C, D) — 5 spaces each
 * Positions in 3D world space (x, z = horizontal plane, y = height)
 */

// Each parking space in the lot
export const PARKING_SPACES = [
  // Row A (Bay A) - top row, facing south
  { id: 'P01', bayId: 'A', slot: 1, x: -9,  z: -6,  rotation: 0, chargerId: 'CH-01' },
  { id: 'P02', bayId: 'A', slot: 2, x: -5,  z: -6,  rotation: 0, chargerId: 'CH-02' },
  { id: 'P03', bayId: 'A', slot: 3, x: -1,  z: -6,  rotation: 0, chargerId: 'CH-03' },
  { id: 'P04', bayId: 'A', slot: 4, x:  3,  z: -6,  rotation: 0, chargerId: 'CH-04' },
  { id: 'P05', bayId: 'A', slot: 5, x:  7,  z: -6,  rotation: 0, chargerId: 'CH-05' },

  // Row B (Bay B) - second row, facing south
  { id: 'P06', bayId: 'B', slot: 1, x: -9,  z: -1.5, rotation: 0, chargerId: 'CH-06' },
  { id: 'P07', bayId: 'B', slot: 2, x: -5,  z: -1.5, rotation: 0, chargerId: 'CH-07' },
  { id: 'P08', bayId: 'B', slot: 3, x: -1,  z: -1.5, rotation: 0, chargerId: 'CH-08' },
  { id: 'P09', bayId: 'B', slot: 4, x:  3,  z: -1.5, rotation: 0, chargerId: 'CH-09' },
  { id: 'P10', bayId: 'B', slot: 5, x:  7,  z: -1.5, rotation: 0, chargerId: 'CH-10' },

  // Row C (Bay C) - third row, facing north
  { id: 'P11', bayId: 'C', slot: 1, x: -9,  z:  2,  rotation: Math.PI, chargerId: 'CH-11' },
  { id: 'P12', bayId: 'C', slot: 2, x: -5,  z:  2,  rotation: Math.PI, chargerId: 'CH-12' },
  { id: 'P13', bayId: 'C', slot: 3, x: -1,  z:  2,  rotation: Math.PI, chargerId: 'CH-13' },
  { id: 'P14', bayId: 'C', slot: 4, x:  3,  z:  2,  rotation: Math.PI, chargerId: 'CH-14' },
  { id: 'P15', bayId: 'C', slot: 5, x:  7,  z:  2,  rotation: Math.PI, chargerId: 'CH-15' },

  // Row D (Bay D) - bottom row, facing north
  { id: 'P16', bayId: 'D', slot: 1, x: -9,  z:  6.5, rotation: Math.PI, chargerId: 'CH-16' },
  { id: 'P17', bayId: 'D', slot: 2, x: -5,  z:  6.5, rotation: Math.PI, chargerId: 'CH-17' },
  { id: 'P18', bayId: 'D', slot: 3, x: -1,  z:  6.5, rotation: Math.PI, chargerId: 'CH-18' },
  { id: 'P19', bayId: 'D', slot: 4, x:  3,  z:  6.5, rotation: Math.PI, chargerId: 'CH-19' },
  { id: 'P20', bayId: 'D', slot: 5, x:  7,  z:  6.5, rotation: Math.PI, chargerId: 'CH-20' },
];

/**
 * Generate parking spaces dynamically according to vehicle count
 */
export function getFacilityParkingSpaces(count = 20) {
  if (count <= 20) {
    return PARKING_SPACES.slice(0, count);
  }
  const rows = Math.ceil(count / 5);
  const spaces = [];
  let idx = 1;
  const bayLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  for (let r = 0; r < rows; r++) {
    const bayId = bayLetters[r % bayLetters.length];
    const isNorth = r >= Math.floor(rows / 2);
    const zBase = -8 + r * 4.0;
    for (let s = 1; s <= 5 && idx <= count; s++) {
      const id = `P${String(idx).padStart(2, '0')}`;
      const x = -9 + (s - 1) * 4;
      spaces.push({
        id,
        bayId,
        slot: s,
        x,
        z: zBase,
        rotation: isNorth ? Math.PI : 0,
        chargerId: `CH-${String(idx).padStart(2, '0')}`
      });
      idx++;
    }
  }
  return spaces;
}

// Map EV id → parking space id (EV01 → P01, etc.)
export const EV_PARKING_MAP = {
  'EV-01': 'P01', 'EV-02': 'P02', 'EV-03': 'P03', 'EV-04': 'P04', 'EV-05': 'P05',
  'EV-06': 'P06', 'EV-07': 'P07', 'EV-08': 'P08', 'EV-09': 'P09', 'EV-10': 'P10',
  'EV-11': 'P11', 'EV-12': 'P12', 'EV-13': 'P13', 'EV-14': 'P14', 'EV-15': 'P15',
  'EV-16': 'P16', 'EV-17': 'P17', 'EV-18': 'P18', 'EV-19': 'P19', 'EV-20': 'P20',
};

// Map parking space id → EV id (reverse lookup)
export const PARKING_EV_MAP = Object.fromEntries(
  Object.entries(EV_PARKING_MAP).map(([ev, p]) => [p, ev])
);

/**
 * Status color system — single source of truth used across app + 3D
 */
export const EV_STATUS_CONFIG = {
  Charging: {
    label: 'Charging',
    color: '#16a34a',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    lightColor: '#86efac',
    threejsColor: 0x16a34a,
    indicatorColor: '#22c55e',
    animate: true,
  },
  Paused: {
    label: 'Grid Optimized',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    lightColor: '#fcd34d',
    threejsColor: 0xd97706,
    indicatorColor: '#f59e0b',
    animate: false,
  },
  Waiting: {
    label: 'Waiting',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    lightColor: '#93c5fd',
    threejsColor: 0x2563eb,
    indicatorColor: '#3b82f6',
    animate: false,
  },
  Completed: {
    label: 'Completed',
    color: '#0891b2',
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc',
    lightColor: '#67e8f9',
    threejsColor: 0x0891b2,
    indicatorColor: '#06b6d4',
    animate: false,
  },
  Parked: {
    label: 'Parked',
    color: '#6b7280',
    bgColor: '#f9fafb',
    borderColor: '#e5e7eb',
    lightColor: '#d1d5db',
    threejsColor: 0x6b7280,
    indicatorColor: '#9ca3af',
    animate: false,
  },
  Empty: {
    label: 'Available',
    color: '#9ca3af',
    bgColor: '#f9fafb',
    borderColor: '#e5e7eb',
    lightColor: '#f3f4f6',
    threejsColor: 0xd1d5db,
    indicatorColor: '#d1d5db',
    animate: false,
  },
  Fault: {
    label: 'Fault',
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    lightColor: '#fca5a5',
    threejsColor: 0xdc2626,
    indicatorColor: '#ef4444',
    animate: false,
  },
};

export function getStatusConfig(status) {
  return EV_STATUS_CONFIG[status] || EV_STATUS_CONFIG.Parked;
}

// Vehicle model variant deterministically assigned by EV id hash
export function getCarVariant(evId) {
  const hash = evId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 4; // 0,1,2,3 → four body shapes
}
