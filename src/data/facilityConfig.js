/**
 * Centralized Facility Configuration
 * When the user switches facility type, this config drives:
 *  - Grid capacity
 *  - Solar capacity
 *  - EV count / charging profiles
 *  - Building load profile
 *  - Billing model (combined residential vs separate commercial)
 *  - Tariff rates
 */

export const FACILITY_CONFIG = {
  Apartment: {
    id: 'Apartment',
    label: 'Residential Apartment',
    billingMode: 'residential',      // combined current bill
    gridCapacity: 100,               // kW
    transformerCapacity: 100,        // kVA
    solarCapacity: 40,               // kWp
    evCount: 20,
    buildingBaseLoad: 30,            // kW base
    buildingPeakLoad: 81,            // kW peak evening
    chargingProfile: 'residential',  // evening/night charging
    tariffType: 'residential',
    // Monthly simulation scale factor
    monthlyScale: 0.045,
    description: 'Residential apartment complex with overnight EV charging',
  },
  Office: {
    id: 'Office',
    label: 'Commercial Office',
    billingMode: 'commercial',
    gridCapacity: 250,
    transformerCapacity: 250,
    solarCapacity: 80,
    evCount: 15,
    buildingBaseLoad: 80,
    buildingPeakLoad: 210,
    chargingProfile: 'office',       // daytime charging
    tariffType: 'commercial',
    monthlyScale: 0.11,
    description: 'Corporate office campus with daytime commuter EV charging',
  },
  'College Campus': {
    id: 'College Campus',
    label: 'College Campus',
    billingMode: 'commercial',
    gridCapacity: 500,
    transformerCapacity: 500,
    solarCapacity: 150,
    evCount: 30,
    buildingBaseLoad: 120,
    buildingPeakLoad: 420,
    chargingProfile: 'campus',       // variable morning/afternoon
    tariffType: 'institutional',
    monthlyScale: 0.22,
    description: 'University campus microgrid with mixed fleet and student EVs',
  },
  'Commercial Facility': {
    id: 'Commercial Facility',
    label: 'Commercial Mall / Retail Hub',
    billingMode: 'commercial',
    gridCapacity: 750,
    transformerCapacity: 750,
    solarCapacity: 200,
    evCount: 50,
    buildingBaseLoad: 250,
    buildingPeakLoad: 650,
    chargingProfile: 'commercial',   // high-turnover visitor charging
    tariffType: 'commercial',
    monthlyScale: 0.35,
    description: 'Commercial mall and delivery hub with fast-charging visitor bays',
  },
};

/**
 * Tariff configuration per facility type.
 * All rates in ₹/kWh.
 */
export const TARIFF_CONFIG = {
  residential: {
    currency: '₹',
    currencyCode: 'INR',
    peakRate: 9.50,       // ₹/kWh  17:00–21:00
    midPeakRate: 6.80,    // ₹/kWh  08:00–17:00
    offPeakRate: 4.20,    // ₹/kWh  22:00–08:00
    flatRate: 7.20,
    solarFeedInRate: 4.50,
    fixedCharge: 550,     // ₹/month
    demandCharge: 0,      // no demand charge for residential
    taxRate: 0.09,
    billingCycleDay: 1,
  },
  commercial: {
    currency: '₹',
    currencyCode: 'INR',
    peakRate: 12.80,
    midPeakRate: 9.50,
    offPeakRate: 6.20,
    flatRate: 10.50,
    solarFeedInRate: 5.50,
    fixedCharge: 2800,    // ₹/month
    demandCharge: 380,    // ₹/kVA/month demand charge
    taxRate: 0.12,
    billingCycleDay: 1,
  },
  institutional: {
    currency: '₹',
    currencyCode: 'INR',
    peakRate: 10.20,
    midPeakRate: 7.80,
    offPeakRate: 5.10,
    flatRate: 8.40,
    solarFeedInRate: 5.00,
    fixedCharge: 5500,
    demandCharge: 250,
    taxRate: 0.10,
    billingCycleDay: 1,
  },
};

/**
 * Get facility config by organization mode key
 */
export function getFacilityConfig(organizationMode = 'Apartment') {
  return FACILITY_CONFIG[organizationMode] || FACILITY_CONFIG.Apartment;
}

/**
 * Get tariff config for the facility's tariff type
 */
export function getFacilityTariff(organizationMode = 'Apartment') {
  const fc = getFacilityConfig(organizationMode);
  return TARIFF_CONFIG[fc.tariffType] || TARIFF_CONFIG.residential;
}

/**
 * Build load profile multiplier curves by facility/time-of-day.
 * Returns [baseKw, peakKw, profile curve coefficients].
 */
export function getBuildingLoadAtHour(hour, minute, facilityConfig, multiplier = 1.0) {
  const timeDec = hour + minute / 60;
  const fc = facilityConfig;
  let base = fc.buildingBaseLoad;
  const span = fc.buildingPeakLoad - fc.buildingBaseLoad;

  switch (fc.chargingProfile) {
    case 'office': {
      // Heavy daytime use, low nights/weekends
      if (timeDec >= 7 && timeDec < 9) base = fc.buildingBaseLoad + span * 0.55 * ((timeDec - 7) / 2);
      else if (timeDec >= 9 && timeDec < 18) base = fc.buildingBaseLoad + span * 0.80 + Math.sin((timeDec - 9) * 0.55) * span * 0.08;
      else if (timeDec >= 18 && timeDec < 20) base = fc.buildingBaseLoad + span * 0.35;
      else if (timeDec >= 20) base = fc.buildingBaseLoad + span * 0.10;
      else base = fc.buildingBaseLoad + span * 0.05;
      break;
    }
    case 'campus': {
      // Morning activity, afternoon peak, evening wind-down
      if (timeDec >= 7 && timeDec < 10) base = fc.buildingBaseLoad + span * 0.5 * ((timeDec - 7) / 3);
      else if (timeDec >= 10 && timeDec < 17) base = fc.buildingBaseLoad + span * 0.68 + Math.sin((timeDec - 10) * 0.4) * span * 0.07;
      else if (timeDec >= 17 && timeDec < 21) base = fc.buildingBaseLoad + span * 0.55;
      else if (timeDec >= 21) base = fc.buildingBaseLoad + span * 0.20;
      else base = fc.buildingBaseLoad + span * 0.12;
      break;
    }
    case 'commercial': {
      // Mall: opens 10am, peak 12-20, stays busy
      if (timeDec < 9) base = fc.buildingBaseLoad + span * 0.08;
      else if (timeDec >= 9 && timeDec < 11) base = fc.buildingBaseLoad + span * 0.35 * ((timeDec - 9) / 2);
      else if (timeDec >= 11 && timeDec < 21) {
        const peakFactor = Math.sin(((timeDec - 11) / 10) * Math.PI);
        base = fc.buildingBaseLoad + span * (0.55 + peakFactor * 0.35);
      } else if (timeDec >= 21) base = fc.buildingBaseLoad + span * 0.20;
      break;
    }
    default: {
      // Residential: evening peak
      if (timeDec >= 6 && timeDec < 10) base = fc.buildingBaseLoad + span * 0.4 * ((timeDec - 6) / 4);
      else if (timeDec >= 10 && timeDec < 17) base = fc.buildingBaseLoad + span * 0.5 + Math.sin((timeDec - 10) * 0.5) * span * 0.04;
      else if (timeDec >= 17 && timeDec < 22) {
        const peakFactor = Math.sin(((timeDec - 17) / 5) * Math.PI);
        base = fc.buildingBaseLoad + span * (0.52 + peakFactor * 0.48);
      } else if (timeDec >= 22) base = fc.buildingBaseLoad + span * 0.20;
      else base = fc.buildingBaseLoad + span * 0.05;
      break;
    }
  }

  const noise = (Math.random() - 0.5) * fc.buildingBaseLoad * 0.04;
  return Math.max(fc.buildingBaseLoad * 0.5, (base + noise) * multiplier);
}
