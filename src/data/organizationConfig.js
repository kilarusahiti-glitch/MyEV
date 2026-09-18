/**
 * Organization Mode Configuration
 * Provides dynamic terminology and metadata for Apartment, Office, College Campus, and Commercial Facility.
 */

export const ORGANIZATION_CONFIGS = {
  Apartment: {
    id: 'Apartment',
    name: 'SmartCharge Apartment',
    facilityType: 'Residential Society',
    substation: 'Building A • Residential Substation',
    unitsLabel: 'Flats & Apartments',
    occupantsLabel: 'Residents',
    fleetLabel: 'Resident EV Bays',
    tariffCategory: 'Domestic Time-of-Use (LT-2)',
    badgeColor: '#10b981',
    description: 'Residential EV charging community with tenant metering and night off-peak optimization.'
  },
  Office: {
    id: 'Office',
    name: 'VoltFlow Tech Park',
    facilityType: 'Corporate Office Campus',
    substation: 'Tower 2 • Corporate Substation',
    unitsLabel: 'Workstation Wings',
    occupantsLabel: 'Employees',
    fleetLabel: 'Commuter & Executive Bays',
    tariffCategory: 'Commercial High-Tension (HT-2)',
    badgeColor: '#06b6d4',
    description: 'Corporate workspace charging optimized for 9-to-5 workday charging and daytime solar peak matching.'
  },
  'College Campus': {
    id: 'College Campus',
    name: 'Greenfield University',
    facilityType: 'Educational University',
    substation: 'Engineering Hub • Campus Microgrid',
    unitsLabel: 'Hostels & Research Labs',
    occupantsLabel: 'Faculty & Students',
    fleetLabel: 'Campus Fleet & Student Bays',
    tariffCategory: 'Institutional Bulk Power (LT-4)',
    badgeColor: '#8b5cf6',
    description: 'Higher-education campus microgrid coordinating departmental shuttles, faculty cars, and solar carports.'
  },
  'Commercial Facility': {
    id: 'Commercial Facility',
    name: 'Metro Retail & Logistics Hub',
    facilityType: 'Commercial Center',
    substation: 'Feeder Substation 4 • Industrial Contract',
    unitsLabel: 'Retail Anchor Stores',
    occupantsLabel: 'Vendors & Delivery Drivers',
    fleetLabel: 'Delivery Fleet & Fast Chargers',
    tariffCategory: 'Industrial & Rapid Commercial (HT-1)',
    badgeColor: '#f59e0b',
    description: 'Commercial mall and last-mile delivery hub balancing high-turnover visitor chargers with electric van fleet.'
  }
};

export function getOrgConfig(mode = 'Apartment') {
  return ORGANIZATION_CONFIGS[mode] || ORGANIZATION_CONFIGS.Apartment;
}
