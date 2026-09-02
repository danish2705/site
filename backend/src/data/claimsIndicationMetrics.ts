export interface ClaimsIndicationMetrics {
  prevalencePer100k: number;
  regulatoryApprovalWeeks: number;
  avgCostPerPatientUsd: number;
}

export const CLAIMS_INDICATION_METRICS: Record<string, Record<string, ClaimsIndicationMetrics>> = {
  "Type 2 Diabetes": {
    "Argentina": {
      "prevalencePer100k": 14319,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 3100
    },
    "Australia": {
      "prevalencePer100k": 15389,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 10300
    },
    "Bangladesh": {
      "prevalencePer100k": 15907,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3000
    },
    "Canada": {
      "prevalencePer100k": 15745,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 12300
    },
    "Chile": {
      "prevalencePer100k": 15710,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 6100
    },
    "China": {
      "prevalencePer100k": 16267,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 4600
    },
    "Colombia": {
      "prevalencePer100k": 16334,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 2400
    },
    "Czech Republic": {
      "prevalencePer100k": 18007,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 5800
    },
    "Egypt": {
      "prevalencePer100k": 14272,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 2200
    },
    "France": {
      "prevalencePer100k": 13058,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 11300
    },
    "Germany": {
      "prevalencePer100k": 18398,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 10000
    },
    "India": {
      "prevalencePer100k": 14854,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 3100
    },
    "Indonesia": {
      "prevalencePer100k": 14007,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 3200
    },
    "Israel": {
      "prevalencePer100k": 13324,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 10800
    },
    "Italy": {
      "prevalencePer100k": 17344,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 4400
    },
    "Japan": {
      "prevalencePer100k": 16392,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 8900
    },
    "Kenya": {
      "prevalencePer100k": 14114,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 1600
    },
    "Netherlands": {
      "prevalencePer100k": 19886,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 7900
    },
    "Nigeria": {
      "prevalencePer100k": 13321,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 2600
    },
    "Pakistan": {
      "prevalencePer100k": 15697,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 1900
    },
    "Peru": {
      "prevalencePer100k": 15411,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 2200
    },
    "Philippines": {
      "prevalencePer100k": 15182,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3400
    },
    "Poland": {
      "prevalencePer100k": 14757,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 3700
    },
    "Romania": {
      "prevalencePer100k": 15610,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 2700
    },
    "Saudi Arabia": {
      "prevalencePer100k": 15605,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 6000
    },
    "South Africa": {
      "prevalencePer100k": 15483,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2300
    },
    "South Korea": {
      "prevalencePer100k": 16342,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 4500
    },
    "Spain": {
      "prevalencePer100k": 14233,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 6000
    },
    "Sri Lanka": {
      "prevalencePer100k": 10277,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 3300
    },
    "Sweden": {
      "prevalencePer100k": 14013,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 11100
    },
    "Taiwan": {
      "prevalencePer100k": 13371,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 3500
    },
    "United Arab Emirates": {
      "prevalencePer100k": 16110,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 5200
    },
    "United Kingdom": {
      "prevalencePer100k": 13820,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 12300
    },
    "United States": {
      "prevalencePer100k": 16962,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 10100
    },
    "Vietnam": {
      "prevalencePer100k": 16115,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2800
    }
  },
  "Obesity (BMI>30)": {
    "Argentina": {
      "prevalencePer100k": 9197,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 3700
    },
    "Australia": {
      "prevalencePer100k": 10684,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 9900
    },
    "Bangladesh": {
      "prevalencePer100k": 18654,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2700
    },
    "Canada": {
      "prevalencePer100k": 21813,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 12700
    },
    "Chile": {
      "prevalencePer100k": 26027,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 5900
    },
    "China": {
      "prevalencePer100k": 18853,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 4400
    },
    "Colombia": {
      "prevalencePer100k": 19451,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 2100
    },
    "Czech Republic": {
      "prevalencePer100k": 12413,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 5100
    },
    "Egypt": {
      "prevalencePer100k": 30472,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 2300
    },
    "France": {
      "prevalencePer100k": 14176,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 11000
    },
    "Germany": {
      "prevalencePer100k": 9820,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 11800
    },
    "India": {
      "prevalencePer100k": 6468,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 2900
    },
    "Indonesia": {
      "prevalencePer100k": 9954,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 3300
    },
    "Israel": {
      "prevalencePer100k": 10224,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 9000
    },
    "Italy": {
      "prevalencePer100k": 11026,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 4800
    },
    "Japan": {
      "prevalencePer100k": 4390,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 11200
    },
    "Kenya": {
      "prevalencePer100k": 23468,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 1400
    },
    "Netherlands": {
      "prevalencePer100k": 32829,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 9200
    },
    "Nigeria": {
      "prevalencePer100k": 16241,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 2600
    },
    "Pakistan": {
      "prevalencePer100k": 33228,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 1700
    },
    "Peru": {
      "prevalencePer100k": 15250,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 2100
    },
    "Philippines": {
      "prevalencePer100k": 15552,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3200
    },
    "Poland": {
      "prevalencePer100k": 18775,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 3700
    },
    "Romania": {
      "prevalencePer100k": 19457,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 2500
    },
    "Saudi Arabia": {
      "prevalencePer100k": 23096,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 5800
    },
    "South Africa": {
      "prevalencePer100k": 16225,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2200
    },
    "South Korea": {
      "prevalencePer100k": 10259,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 4400
    },
    "Spain": {
      "prevalencePer100k": 22896,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 5600
    },
    "Sri Lanka": {
      "prevalencePer100k": 27532,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 3300
    },
    "Sweden": {
      "prevalencePer100k": 21680,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 12400
    },
    "Taiwan": {
      "prevalencePer100k": 16959,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 3600
    },
    "United Arab Emirates": {
      "prevalencePer100k": 11813,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 5800
    },
    "United Kingdom": {
      "prevalencePer100k": 22278,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 13600
    },
    "United States": {
      "prevalencePer100k": 29104,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 10100
    },
    "Vietnam": {
      "prevalencePer100k": 7158,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2400
    }
  },
  "Breast Cancer (HER2+)": {
    "Argentina": {
      "prevalencePer100k": 32,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 10600
    },
    "Australia": {
      "prevalencePer100k": 24,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 31500
    },
    "Bangladesh": {
      "prevalencePer100k": 18,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 11500
    },
    "Canada": {
      "prevalencePer100k": 37,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 44500
    },
    "Chile": {
      "prevalencePer100k": 33,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 25000
    },
    "China": {
      "prevalencePer100k": 33,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 17100
    },
    "Colombia": {
      "prevalencePer100k": 29,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 9100
    },
    "Czech Republic": {
      "prevalencePer100k": 19,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 19600
    },
    "Egypt": {
      "prevalencePer100k": 24,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 7200
    },
    "France": {
      "prevalencePer100k": 17,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 38400
    },
    "Germany": {
      "prevalencePer100k": 33,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 37500
    },
    "India": {
      "prevalencePer100k": 50,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 10100
    },
    "Indonesia": {
      "prevalencePer100k": 21,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 13200
    },
    "Israel": {
      "prevalencePer100k": 21,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 37800
    },
    "Italy": {
      "prevalencePer100k": 46,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 14400
    },
    "Japan": {
      "prevalencePer100k": 35,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 32000
    },
    "Kenya": {
      "prevalencePer100k": 19,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 5200
    },
    "Netherlands": {
      "prevalencePer100k": 18,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 27800
    },
    "Nigeria": {
      "prevalencePer100k": 16,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 8900
    },
    "Pakistan": {
      "prevalencePer100k": 36,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 6400
    },
    "Peru": {
      "prevalencePer100k": 31,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 7700
    },
    "Philippines": {
      "prevalencePer100k": 44,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 13000
    },
    "Poland": {
      "prevalencePer100k": 35,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 15900
    },
    "Romania": {
      "prevalencePer100k": 41,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 8400
    },
    "Saudi Arabia": {
      "prevalencePer100k": 33,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 24300
    },
    "South Africa": {
      "prevalencePer100k": 16,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 6200
    },
    "South Korea": {
      "prevalencePer100k": 36,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 16100
    },
    "Spain": {
      "prevalencePer100k": 29,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 24100
    },
    "Sri Lanka": {
      "prevalencePer100k": 39,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 10700
    },
    "Sweden": {
      "prevalencePer100k": 26,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 42600
    },
    "Taiwan": {
      "prevalencePer100k": 20,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 12700
    },
    "United Arab Emirates": {
      "prevalencePer100k": 20,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 19400
    },
    "United Kingdom": {
      "prevalencePer100k": 36,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 45000
    },
    "United States": {
      "prevalencePer100k": 43,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 40200
    },
    "Vietnam": {
      "prevalencePer100k": 25,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 8500
    }
  },
  "Non-Small Cell Lung Cancer": {
    "Argentina": {
      "prevalencePer100k": 25,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 11300
    },
    "Australia": {
      "prevalencePer100k": 37,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 33400
    },
    "Bangladesh": {
      "prevalencePer100k": 42,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 10900
    },
    "Canada": {
      "prevalencePer100k": 41,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 49200
    },
    "Chile": {
      "prevalencePer100k": 25,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 22700
    },
    "China": {
      "prevalencePer100k": 24,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 16100
    },
    "Colombia": {
      "prevalencePer100k": 18,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 7400
    },
    "Czech Republic": {
      "prevalencePer100k": 42,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 17800
    },
    "Egypt": {
      "prevalencePer100k": 24,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 7500
    },
    "France": {
      "prevalencePer100k": 22,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 42500
    },
    "Germany": {
      "prevalencePer100k": 39,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 43700
    },
    "India": {
      "prevalencePer100k": 38,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 9200
    },
    "Indonesia": {
      "prevalencePer100k": 33,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 10900
    },
    "Israel": {
      "prevalencePer100k": 36,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 33900
    },
    "Italy": {
      "prevalencePer100k": 35,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 18700
    },
    "Japan": {
      "prevalencePer100k": 27,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 37200
    },
    "Kenya": {
      "prevalencePer100k": 28,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 5000
    },
    "Netherlands": {
      "prevalencePer100k": 21,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 36600
    },
    "Nigeria": {
      "prevalencePer100k": 19,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 9100
    },
    "Pakistan": {
      "prevalencePer100k": 44,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 7000
    },
    "Peru": {
      "prevalencePer100k": 26,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 8500
    },
    "Philippines": {
      "prevalencePer100k": 29,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 11500
    },
    "Poland": {
      "prevalencePer100k": 31,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 15700
    },
    "Romania": {
      "prevalencePer100k": 39,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 8300
    },
    "Saudi Arabia": {
      "prevalencePer100k": 27,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 25400
    },
    "South Africa": {
      "prevalencePer100k": 27,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 8000
    },
    "South Korea": {
      "prevalencePer100k": 30,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 16700
    },
    "Spain": {
      "prevalencePer100k": 32,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 19400
    },
    "Sri Lanka": {
      "prevalencePer100k": 36,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 9300
    },
    "Sweden": {
      "prevalencePer100k": 45,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 40500
    },
    "Taiwan": {
      "prevalencePer100k": 34,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 15000
    },
    "United Arab Emirates": {
      "prevalencePer100k": 17,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 15800
    },
    "United Kingdom": {
      "prevalencePer100k": 36,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 36200
    },
    "United States": {
      "prevalencePer100k": 17,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 34600
    },
    "Vietnam": {
      "prevalencePer100k": 35,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 9000
    }
  },
  "Colorectal Cancer": {
    "Argentina": {
      "prevalencePer100k": 55,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 11200
    },
    "Australia": {
      "prevalencePer100k": 74,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 28900
    },
    "Bangladesh": {
      "prevalencePer100k": 60,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 12100
    },
    "Canada": {
      "prevalencePer100k": 29,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 45500
    },
    "Chile": {
      "prevalencePer100k": 37,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 26400
    },
    "China": {
      "prevalencePer100k": 61,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 17600
    },
    "Colombia": {
      "prevalencePer100k": 35,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 8100
    },
    "Czech Republic": {
      "prevalencePer100k": 43,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 18400
    },
    "Egypt": {
      "prevalencePer100k": 45,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 8200
    },
    "France": {
      "prevalencePer100k": 61,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 42700
    },
    "Germany": {
      "prevalencePer100k": 29,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 41000
    },
    "India": {
      "prevalencePer100k": 35,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 10500
    },
    "Indonesia": {
      "prevalencePer100k": 27,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 11200
    },
    "Israel": {
      "prevalencePer100k": 64,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 33000
    },
    "Italy": {
      "prevalencePer100k": 60,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 15500
    },
    "Japan": {
      "prevalencePer100k": 61,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 39900
    },
    "Kenya": {
      "prevalencePer100k": 16,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 6100
    },
    "Netherlands": {
      "prevalencePer100k": 53,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 29600
    },
    "Nigeria": {
      "prevalencePer100k": 13,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 10600
    },
    "Pakistan": {
      "prevalencePer100k": 65,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 5800
    },
    "Peru": {
      "prevalencePer100k": 40,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 6900
    },
    "Philippines": {
      "prevalencePer100k": 38,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 13800
    },
    "Poland": {
      "prevalencePer100k": 45,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 14600
    },
    "Romania": {
      "prevalencePer100k": 44,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 7600
    },
    "Saudi Arabia": {
      "prevalencePer100k": 46,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 21600
    },
    "South Africa": {
      "prevalencePer100k": 53,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 8200
    },
    "South Korea": {
      "prevalencePer100k": 62,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 16800
    },
    "Spain": {
      "prevalencePer100k": 41,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 21600
    },
    "Sri Lanka": {
      "prevalencePer100k": 48,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 11100
    },
    "Sweden": {
      "prevalencePer100k": 43,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 39100
    },
    "Taiwan": {
      "prevalencePer100k": 29,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 16500
    },
    "United Arab Emirates": {
      "prevalencePer100k": 49,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 20000
    },
    "United Kingdom": {
      "prevalencePer100k": 54,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 45800
    },
    "United States": {
      "prevalencePer100k": 76,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 34000
    },
    "Vietnam": {
      "prevalencePer100k": 32,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 9400
    }
  },
  "Prostate Cancer": {
    "Argentina": {
      "prevalencePer100k": 66,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 12300
    },
    "Australia": {
      "prevalencePer100k": 88,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 29100
    },
    "Bangladesh": {
      "prevalencePer100k": 32,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 9300
    },
    "Canada": {
      "prevalencePer100k": 93,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 45400
    },
    "Chile": {
      "prevalencePer100k": 63,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 27300
    },
    "China": {
      "prevalencePer100k": 35,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 13300
    },
    "Colombia": {
      "prevalencePer100k": 85,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 8900
    },
    "Czech Republic": {
      "prevalencePer100k": 98,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 22800
    },
    "Egypt": {
      "prevalencePer100k": 75,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 9200
    },
    "France": {
      "prevalencePer100k": 62,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 42900
    },
    "Germany": {
      "prevalencePer100k": 80,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 39000
    },
    "India": {
      "prevalencePer100k": 50,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 11300
    },
    "Indonesia": {
      "prevalencePer100k": 76,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 11500
    },
    "Israel": {
      "prevalencePer100k": 56,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 32200
    },
    "Italy": {
      "prevalencePer100k": 110,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 18300
    },
    "Japan": {
      "prevalencePer100k": 34,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 34500
    },
    "Kenya": {
      "prevalencePer100k": 109,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 6100
    },
    "Netherlands": {
      "prevalencePer100k": 36,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 29000
    },
    "Nigeria": {
      "prevalencePer100k": 79,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 9400
    },
    "Pakistan": {
      "prevalencePer100k": 74,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 6300
    },
    "Peru": {
      "prevalencePer100k": 109,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 8400
    },
    "Philippines": {
      "prevalencePer100k": 67,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 13500
    },
    "Poland": {
      "prevalencePer100k": 83,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 15300
    },
    "Romania": {
      "prevalencePer100k": 108,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 7800
    },
    "Saudi Arabia": {
      "prevalencePer100k": 35,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 24000
    },
    "South Africa": {
      "prevalencePer100k": 31,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 7500
    },
    "South Korea": {
      "prevalencePer100k": 39,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 13700
    },
    "Spain": {
      "prevalencePer100k": 69,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 19200
    },
    "Sri Lanka": {
      "prevalencePer100k": 106,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 11000
    },
    "Sweden": {
      "prevalencePer100k": 43,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 38000
    },
    "Taiwan": {
      "prevalencePer100k": 80,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 15100
    },
    "United Arab Emirates": {
      "prevalencePer100k": 69,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 15200
    },
    "United Kingdom": {
      "prevalencePer100k": 40,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 37400
    },
    "United States": {
      "prevalencePer100k": 93,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 33700
    },
    "Vietnam": {
      "prevalencePer100k": 29,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 9100
    }
  },
  "Hypertension": {
    "Argentina": {
      "prevalencePer100k": 21635,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 5200
    },
    "Australia": {
      "prevalencePer100k": 20563,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 15200
    },
    "Bangladesh": {
      "prevalencePer100k": 35374,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 5000
    },
    "Canada": {
      "prevalencePer100k": 31891,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 18300
    },
    "Chile": {
      "prevalencePer100k": 25322,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 9000
    },
    "China": {
      "prevalencePer100k": 21669,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 5900
    },
    "Colombia": {
      "prevalencePer100k": 22067,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 3400
    },
    "Czech Republic": {
      "prevalencePer100k": 36464,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 9100
    },
    "Egypt": {
      "prevalencePer100k": 35242,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 3500
    },
    "France": {
      "prevalencePer100k": 34004,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 18000
    },
    "Germany": {
      "prevalencePer100k": 21101,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 14600
    },
    "India": {
      "prevalencePer100k": 24589,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 4300
    },
    "Indonesia": {
      "prevalencePer100k": 26393,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 4700
    },
    "Israel": {
      "prevalencePer100k": 23675,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 16100
    },
    "Italy": {
      "prevalencePer100k": 21170,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 7200
    },
    "Japan": {
      "prevalencePer100k": 22095,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 15400
    },
    "Kenya": {
      "prevalencePer100k": 43523,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 2300
    },
    "Netherlands": {
      "prevalencePer100k": 28129,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 13400
    },
    "Nigeria": {
      "prevalencePer100k": 26477,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 4600
    },
    "Pakistan": {
      "prevalencePer100k": 35625,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 2400
    },
    "Peru": {
      "prevalencePer100k": 26152,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 3200
    },
    "Philippines": {
      "prevalencePer100k": 22534,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 4900
    },
    "Poland": {
      "prevalencePer100k": 29725,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 7500
    },
    "Romania": {
      "prevalencePer100k": 23688,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 4100
    },
    "Saudi Arabia": {
      "prevalencePer100k": 35164,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 9000
    },
    "South Africa": {
      "prevalencePer100k": 32569,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3300
    },
    "South Korea": {
      "prevalencePer100k": 21222,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 6200
    },
    "Spain": {
      "prevalencePer100k": 34703,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 8800
    },
    "Sri Lanka": {
      "prevalencePer100k": 34168,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 4700
    },
    "Sweden": {
      "prevalencePer100k": 37503,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 14000
    },
    "Taiwan": {
      "prevalencePer100k": 36406,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 5300
    },
    "United Arab Emirates": {
      "prevalencePer100k": 26973,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 8300
    },
    "United Kingdom": {
      "prevalencePer100k": 27908,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 15700
    },
    "United States": {
      "prevalencePer100k": 25499,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 15600
    },
    "Vietnam": {
      "prevalencePer100k": 28967,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3600
    }
  },
  "Heart Failure (HFrEF)": {
    "Argentina": {
      "prevalencePer100k": 3066,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 5800
    },
    "Australia": {
      "prevalencePer100k": 3132,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 14700
    },
    "Bangladesh": {
      "prevalencePer100k": 2713,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 5200
    },
    "Canada": {
      "prevalencePer100k": 3188,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 17600
    },
    "Chile": {
      "prevalencePer100k": 3011,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 10100
    },
    "China": {
      "prevalencePer100k": 2920,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 6500
    },
    "Colombia": {
      "prevalencePer100k": 2960,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 3500
    },
    "Czech Republic": {
      "prevalencePer100k": 4028,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 10100
    },
    "Egypt": {
      "prevalencePer100k": 2734,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 3200
    },
    "France": {
      "prevalencePer100k": 3124,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 15300
    },
    "Germany": {
      "prevalencePer100k": 3164,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 17100
    },
    "India": {
      "prevalencePer100k": 3008,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 4600
    },
    "Indonesia": {
      "prevalencePer100k": 3097,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 5400
    },
    "Israel": {
      "prevalencePer100k": 2359,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 14100
    },
    "Italy": {
      "prevalencePer100k": 3192,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 6400
    },
    "Japan": {
      "prevalencePer100k": 3215,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 16100
    },
    "Kenya": {
      "prevalencePer100k": 3081,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 2000
    },
    "Netherlands": {
      "prevalencePer100k": 3567,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 15000
    },
    "Nigeria": {
      "prevalencePer100k": 2910,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 4300
    },
    "Pakistan": {
      "prevalencePer100k": 3001,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 2700
    },
    "Peru": {
      "prevalencePer100k": 3258,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 3700
    },
    "Philippines": {
      "prevalencePer100k": 2835,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 4600
    },
    "Poland": {
      "prevalencePer100k": 3405,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 6000
    },
    "Romania": {
      "prevalencePer100k": 2851,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 3500
    },
    "Saudi Arabia": {
      "prevalencePer100k": 3173,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 9700
    },
    "South Africa": {
      "prevalencePer100k": 3155,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3000
    },
    "South Korea": {
      "prevalencePer100k": 2649,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 5800
    },
    "Spain": {
      "prevalencePer100k": 2974,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 9100
    },
    "Sri Lanka": {
      "prevalencePer100k": 2990,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 4900
    },
    "Sweden": {
      "prevalencePer100k": 3116,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 14500
    },
    "Taiwan": {
      "prevalencePer100k": 5275,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 5300
    },
    "United Arab Emirates": {
      "prevalencePer100k": 3189,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 8300
    },
    "United Kingdom": {
      "prevalencePer100k": 3218,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 20600
    },
    "United States": {
      "prevalencePer100k": 3064,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 14600
    },
    "Vietnam": {
      "prevalencePer100k": 3115,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3500
    }
  },
  "Atrial Fibrillation": {
    "Argentina": {
      "prevalencePer100k": 5833,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 5400
    },
    "Australia": {
      "prevalencePer100k": 5426,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 14400
    },
    "Bangladesh": {
      "prevalencePer100k": 4555,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 4900
    },
    "Canada": {
      "prevalencePer100k": 5579,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 16600
    },
    "Chile": {
      "prevalencePer100k": 5705,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 11700
    },
    "China": {
      "prevalencePer100k": 5987,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 6100
    },
    "Colombia": {
      "prevalencePer100k": 5415,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 3900
    },
    "Czech Republic": {
      "prevalencePer100k": 7760,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 9700
    },
    "Egypt": {
      "prevalencePer100k": 5144,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 3100
    },
    "France": {
      "prevalencePer100k": 6233,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 14800
    },
    "Germany": {
      "prevalencePer100k": 6290,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 16300
    },
    "India": {
      "prevalencePer100k": 6160,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 3700
    },
    "Indonesia": {
      "prevalencePer100k": 5530,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 5100
    },
    "Israel": {
      "prevalencePer100k": 4010,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 15400
    },
    "Italy": {
      "prevalencePer100k": 5487,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 7400
    },
    "Japan": {
      "prevalencePer100k": 5756,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 16400
    },
    "Kenya": {
      "prevalencePer100k": 5381,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 2100
    },
    "Netherlands": {
      "prevalencePer100k": 6711,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 13000
    },
    "Nigeria": {
      "prevalencePer100k": 6056,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 4600
    },
    "Pakistan": {
      "prevalencePer100k": 5816,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 3000
    },
    "Peru": {
      "prevalencePer100k": 5899,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 3600
    },
    "Philippines": {
      "prevalencePer100k": 5420,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 4800
    },
    "Poland": {
      "prevalencePer100k": 6331,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 7200
    },
    "Romania": {
      "prevalencePer100k": 5657,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 3400
    },
    "Saudi Arabia": {
      "prevalencePer100k": 5948,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 8600
    },
    "South Africa": {
      "prevalencePer100k": 5838,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3000
    },
    "South Korea": {
      "prevalencePer100k": 5051,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 6600
    },
    "Spain": {
      "prevalencePer100k": 5725,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 9500
    },
    "Sri Lanka": {
      "prevalencePer100k": 5876,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 4300
    },
    "Sweden": {
      "prevalencePer100k": 6103,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 14500
    },
    "Taiwan": {
      "prevalencePer100k": 9962,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 7000
    },
    "United Arab Emirates": {
      "prevalencePer100k": 6467,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 8100
    },
    "United Kingdom": {
      "prevalencePer100k": 5550,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 15400
    },
    "United States": {
      "prevalencePer100k": 5646,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 15500
    },
    "Vietnam": {
      "prevalencePer100k": 5903,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 4200
    }
  },
  "Alzheimer's Disease (Early-stage)": {
    "Argentina": {
      "prevalencePer100k": 327,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 10000
    },
    "Australia": {
      "prevalencePer100k": 490,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 29300
    },
    "Bangladesh": {
      "prevalencePer100k": 614,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 7800
    },
    "Canada": {
      "prevalencePer100k": 641,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 40600
    },
    "Chile": {
      "prevalencePer100k": 551,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 18700
    },
    "China": {
      "prevalencePer100k": 418,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 11900
    },
    "Colombia": {
      "prevalencePer100k": 649,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 6900
    },
    "Czech Republic": {
      "prevalencePer100k": 320,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 17500
    },
    "Egypt": {
      "prevalencePer100k": 661,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 5900
    },
    "France": {
      "prevalencePer100k": 465,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 33100
    },
    "Germany": {
      "prevalencePer100k": 277,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 35000
    },
    "India": {
      "prevalencePer100k": 264,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 8600
    },
    "Indonesia": {
      "prevalencePer100k": 270,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 10500
    },
    "Israel": {
      "prevalencePer100k": 619,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 30600
    },
    "Italy": {
      "prevalencePer100k": 757,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 12500
    },
    "Japan": {
      "prevalencePer100k": 776,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 24700
    },
    "Kenya": {
      "prevalencePer100k": 191,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 3700
    },
    "Netherlands": {
      "prevalencePer100k": 469,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 23300
    },
    "Nigeria": {
      "prevalencePer100k": 192,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 8700
    },
    "Pakistan": {
      "prevalencePer100k": 207,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 4200
    },
    "Peru": {
      "prevalencePer100k": 467,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 6500
    },
    "Philippines": {
      "prevalencePer100k": 470,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 10300
    },
    "Poland": {
      "prevalencePer100k": 685,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 11100
    },
    "Romania": {
      "prevalencePer100k": 451,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 7600
    },
    "Saudi Arabia": {
      "prevalencePer100k": 568,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 21100
    },
    "South Africa": {
      "prevalencePer100k": 419,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 6300
    },
    "South Korea": {
      "prevalencePer100k": 211,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 11200
    },
    "Spain": {
      "prevalencePer100k": 544,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 17600
    },
    "Sri Lanka": {
      "prevalencePer100k": 208,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 7500
    },
    "Sweden": {
      "prevalencePer100k": 394,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 30400
    },
    "Taiwan": {
      "prevalencePer100k": 536,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 10800
    },
    "United Arab Emirates": {
      "prevalencePer100k": 307,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 14100
    },
    "United Kingdom": {
      "prevalencePer100k": 473,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 32700
    },
    "United States": {
      "prevalencePer100k": 348,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 31900
    },
    "Vietnam": {
      "prevalencePer100k": 460,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 8600
    }
  },
  "Parkinson's Disease": {
    "Argentina": {
      "prevalencePer100k": 119,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 8600
    },
    "Australia": {
      "prevalencePer100k": 141,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 29700
    },
    "Bangladesh": {
      "prevalencePer100k": 160,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 8200
    },
    "Canada": {
      "prevalencePer100k": 235,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 35600
    },
    "Chile": {
      "prevalencePer100k": 152,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 18500
    },
    "China": {
      "prevalencePer100k": 207,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 12200
    },
    "Colombia": {
      "prevalencePer100k": 105,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 5700
    },
    "Czech Republic": {
      "prevalencePer100k": 93,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 18600
    },
    "Egypt": {
      "prevalencePer100k": 154,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 7400
    },
    "France": {
      "prevalencePer100k": 113,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 31600
    },
    "Germany": {
      "prevalencePer100k": 136,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 28000
    },
    "India": {
      "prevalencePer100k": 180,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 8300
    },
    "Indonesia": {
      "prevalencePer100k": 195,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 10400
    },
    "Israel": {
      "prevalencePer100k": 205,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 28700
    },
    "Italy": {
      "prevalencePer100k": 190,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 11800
    },
    "Japan": {
      "prevalencePer100k": 168,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 28400
    },
    "Kenya": {
      "prevalencePer100k": 269,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 4700
    },
    "Netherlands": {
      "prevalencePer100k": 217,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 27400
    },
    "Nigeria": {
      "prevalencePer100k": 146,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 8400
    },
    "Pakistan": {
      "prevalencePer100k": 201,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 5300
    },
    "Peru": {
      "prevalencePer100k": 210,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 7000
    },
    "Philippines": {
      "prevalencePer100k": 277,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 8800
    },
    "Poland": {
      "prevalencePer100k": 227,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 12900
    },
    "Romania": {
      "prevalencePer100k": 151,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 7500
    },
    "Saudi Arabia": {
      "prevalencePer100k": 169,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 19400
    },
    "South Africa": {
      "prevalencePer100k": 83,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 6000
    },
    "South Korea": {
      "prevalencePer100k": 217,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 12300
    },
    "Spain": {
      "prevalencePer100k": 114,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 18900
    },
    "Sri Lanka": {
      "prevalencePer100k": 149,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 7700
    },
    "Sweden": {
      "prevalencePer100k": 263,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 25700
    },
    "Taiwan": {
      "prevalencePer100k": 130,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 10600
    },
    "United Arab Emirates": {
      "prevalencePer100k": 116,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 15600
    },
    "United Kingdom": {
      "prevalencePer100k": 129,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 30200
    },
    "United States": {
      "prevalencePer100k": 101,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 28800
    },
    "Vietnam": {
      "prevalencePer100k": 222,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 7500
    }
  },
  "Multiple Sclerosis (Relapsing-Remitting)": {
    "Argentina": {
      "prevalencePer100k": 25,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 10200
    },
    "Australia": {
      "prevalencePer100k": 41,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 23900
    },
    "Bangladesh": {
      "prevalencePer100k": 67,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 9400
    },
    "Canada": {
      "prevalencePer100k": 24,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 37100
    },
    "Chile": {
      "prevalencePer100k": 61,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 18200
    },
    "China": {
      "prevalencePer100k": 73,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 11300
    },
    "Colombia": {
      "prevalencePer100k": 77,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 7300
    },
    "Czech Republic": {
      "prevalencePer100k": 31,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 15800
    },
    "Egypt": {
      "prevalencePer100k": 76,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 6600
    },
    "France": {
      "prevalencePer100k": 20,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 34300
    },
    "Germany": {
      "prevalencePer100k": 35,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 29900
    },
    "India": {
      "prevalencePer100k": 62,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 8400
    },
    "Indonesia": {
      "prevalencePer100k": 7,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 9300
    },
    "Israel": {
      "prevalencePer100k": 36,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 25700
    },
    "Italy": {
      "prevalencePer100k": 74,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 14000
    },
    "Japan": {
      "prevalencePer100k": 65,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 31600
    },
    "Kenya": {
      "prevalencePer100k": 58,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 4300
    },
    "Netherlands": {
      "prevalencePer100k": 76,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 23200
    },
    "Nigeria": {
      "prevalencePer100k": 52,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 7400
    },
    "Pakistan": {
      "prevalencePer100k": 76,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 5400
    },
    "Peru": {
      "prevalencePer100k": 45,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 5700
    },
    "Philippines": {
      "prevalencePer100k": 52,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 9400
    },
    "Poland": {
      "prevalencePer100k": 45,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 12600
    },
    "Romania": {
      "prevalencePer100k": 83,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 7200
    },
    "Saudi Arabia": {
      "prevalencePer100k": 84,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 17300
    },
    "South Africa": {
      "prevalencePer100k": 56,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 6600
    },
    "South Korea": {
      "prevalencePer100k": 20,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 13700
    },
    "Spain": {
      "prevalencePer100k": 83,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 19400
    },
    "Sri Lanka": {
      "prevalencePer100k": 75,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 7400
    },
    "Sweden": {
      "prevalencePer100k": 147,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 28100
    },
    "Taiwan": {
      "prevalencePer100k": 35,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 11500
    },
    "United Arab Emirates": {
      "prevalencePer100k": 18,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 14500
    },
    "United Kingdom": {
      "prevalencePer100k": 78,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 37900
    },
    "United States": {
      "prevalencePer100k": 58,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 25800
    },
    "Vietnam": {
      "prevalencePer100k": 9,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 7300
    }
  },
  "Epilepsy (Focal)": {
    "Argentina": {
      "prevalencePer100k": 283,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 9300
    },
    "Australia": {
      "prevalencePer100k": 434,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 22700
    },
    "Bangladesh": {
      "prevalencePer100k": 274,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 9200
    },
    "Canada": {
      "prevalencePer100k": 300,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 35200
    },
    "Chile": {
      "prevalencePer100k": 263,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 21300
    },
    "China": {
      "prevalencePer100k": 386,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 14000
    },
    "Colombia": {
      "prevalencePer100k": 360,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 7200
    },
    "Czech Republic": {
      "prevalencePer100k": 186,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 15300
    },
    "Egypt": {
      "prevalencePer100k": 392,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 7400
    },
    "France": {
      "prevalencePer100k": 418,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 28900
    },
    "Germany": {
      "prevalencePer100k": 301,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 33200
    },
    "India": {
      "prevalencePer100k": 213,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 8700
    },
    "Indonesia": {
      "prevalencePer100k": 208,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 9100
    },
    "Israel": {
      "prevalencePer100k": 174,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 28200
    },
    "Italy": {
      "prevalencePer100k": 416,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 13500
    },
    "Japan": {
      "prevalencePer100k": 161,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 25800
    },
    "Kenya": {
      "prevalencePer100k": 506,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 4900
    },
    "Netherlands": {
      "prevalencePer100k": 218,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 24300
    },
    "Nigeria": {
      "prevalencePer100k": 418,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 7400
    },
    "Pakistan": {
      "prevalencePer100k": 213,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 5100
    },
    "Peru": {
      "prevalencePer100k": 368,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 5800
    },
    "Philippines": {
      "prevalencePer100k": 157,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 9900
    },
    "Poland": {
      "prevalencePer100k": 420,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 12700
    },
    "Romania": {
      "prevalencePer100k": 288,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 6600
    },
    "Saudi Arabia": {
      "prevalencePer100k": 173,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 16100
    },
    "South Africa": {
      "prevalencePer100k": 414,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 6400
    },
    "South Korea": {
      "prevalencePer100k": 326,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 13000
    },
    "Spain": {
      "prevalencePer100k": 250,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 16800
    },
    "Sri Lanka": {
      "prevalencePer100k": 386,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 9300
    },
    "Sweden": {
      "prevalencePer100k": 300,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 26700
    },
    "Taiwan": {
      "prevalencePer100k": 166,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 11600
    },
    "United Arab Emirates": {
      "prevalencePer100k": 335,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 13000
    },
    "United Kingdom": {
      "prevalencePer100k": 242,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 32700
    },
    "United States": {
      "prevalencePer100k": 196,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 27800
    },
    "Vietnam": {
      "prevalencePer100k": 354,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 8000
    }
  },
  "HIV (Treatment-naive)": {
    "Argentina": {
      "prevalencePer100k": 315,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 2400
    },
    "Australia": {
      "prevalencePer100k": 365,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 6000
    },
    "Bangladesh": {
      "prevalencePer100k": 101,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2300
    },
    "Canada": {
      "prevalencePer100k": 140,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 9600
    },
    "Chile": {
      "prevalencePer100k": 304,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 5000
    },
    "China": {
      "prevalencePer100k": 258,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 3000
    },
    "Colombia": {
      "prevalencePer100k": 67,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 1700
    },
    "Czech Republic": {
      "prevalencePer100k": 221,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 4700
    },
    "Egypt": {
      "prevalencePer100k": 131,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 1500
    },
    "France": {
      "prevalencePer100k": 93,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 8200
    },
    "Germany": {
      "prevalencePer100k": 235,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 8500
    },
    "India": {
      "prevalencePer100k": 275,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 2200
    },
    "Indonesia": {
      "prevalencePer100k": 159,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 2400
    },
    "Israel": {
      "prevalencePer100k": 164,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 6400
    },
    "Italy": {
      "prevalencePer100k": 385,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 2900
    },
    "Japan": {
      "prevalencePer100k": 236,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 6800
    },
    "Kenya": {
      "prevalencePer100k": 517,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 1000
    },
    "Netherlands": {
      "prevalencePer100k": 256,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 7000
    },
    "Nigeria": {
      "prevalencePer100k": 2348,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 2100
    },
    "Pakistan": {
      "prevalencePer100k": 87,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 1400
    },
    "Peru": {
      "prevalencePer100k": 203,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 1700
    },
    "Philippines": {
      "prevalencePer100k": 283,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2700
    },
    "Poland": {
      "prevalencePer100k": 64,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 2900
    },
    "Romania": {
      "prevalencePer100k": 172,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 2000
    },
    "Saudi Arabia": {
      "prevalencePer100k": 237,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 4900
    },
    "South Africa": {
      "prevalencePer100k": 3361,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 1400
    },
    "South Korea": {
      "prevalencePer100k": 125,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 2600
    },
    "Spain": {
      "prevalencePer100k": 272,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 4200
    },
    "Sri Lanka": {
      "prevalencePer100k": 241,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 1900
    },
    "Sweden": {
      "prevalencePer100k": 378,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 7200
    },
    "Taiwan": {
      "prevalencePer100k": 222,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 3300
    },
    "United Arab Emirates": {
      "prevalencePer100k": 137,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 3400
    },
    "United Kingdom": {
      "prevalencePer100k": 233,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 9400
    },
    "United States": {
      "prevalencePer100k": 262,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 7400
    },
    "Vietnam": {
      "prevalencePer100k": 299,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 1900
    }
  },
  "Tuberculosis (Drug-sensitive)": {
    "Argentina": {
      "prevalencePer100k": 63,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 2200
    },
    "Australia": {
      "prevalencePer100k": 86,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 6300
    },
    "Bangladesh": {
      "prevalencePer100k": 229,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2000
    },
    "Canada": {
      "prevalencePer100k": 79,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 9500
    },
    "Chile": {
      "prevalencePer100k": 89,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 4600
    },
    "China": {
      "prevalencePer100k": 59,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 3200
    },
    "Colombia": {
      "prevalencePer100k": 17,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 1500
    },
    "Czech Republic": {
      "prevalencePer100k": 63,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 4000
    },
    "Egypt": {
      "prevalencePer100k": 59,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 1800
    },
    "France": {
      "prevalencePer100k": 71,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 8000
    },
    "Germany": {
      "prevalencePer100k": 49,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 6600
    },
    "India": {
      "prevalencePer100k": 238,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 2100
    },
    "Indonesia": {
      "prevalencePer100k": 310,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 2600
    },
    "Israel": {
      "prevalencePer100k": 54,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 6800
    },
    "Italy": {
      "prevalencePer100k": 55,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 3700
    },
    "Japan": {
      "prevalencePer100k": 92,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 6300
    },
    "Kenya": {
      "prevalencePer100k": 42,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 1100
    },
    "Netherlands": {
      "prevalencePer100k": 80,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 7400
    },
    "Nigeria": {
      "prevalencePer100k": 114,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 1900
    },
    "Pakistan": {
      "prevalencePer100k": 72,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 1100
    },
    "Peru": {
      "prevalencePer100k": 38,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 1400
    },
    "Philippines": {
      "prevalencePer100k": 328,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2500
    },
    "Poland": {
      "prevalencePer100k": 22,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 3000
    },
    "Romania": {
      "prevalencePer100k": 15,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 1800
    },
    "Saudi Arabia": {
      "prevalencePer100k": 41,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 4400
    },
    "South Africa": {
      "prevalencePer100k": 515,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 1600
    },
    "South Korea": {
      "prevalencePer100k": 68,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 3100
    },
    "Spain": {
      "prevalencePer100k": 38,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 4700
    },
    "Sri Lanka": {
      "prevalencePer100k": 95,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 2400
    },
    "Sweden": {
      "prevalencePer100k": 77,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 8300
    },
    "Taiwan": {
      "prevalencePer100k": 80,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 3300
    },
    "United Arab Emirates": {
      "prevalencePer100k": 91,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 3700
    },
    "United Kingdom": {
      "prevalencePer100k": 14,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 8800
    },
    "United States": {
      "prevalencePer100k": 24,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 7700
    },
    "Vietnam": {
      "prevalencePer100k": 89,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2000
    }
  },
  "Chronic Hepatitis C": {
    "Argentina": {
      "prevalencePer100k": 2443,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 2300
    },
    "Australia": {
      "prevalencePer100k": 2646,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 7300
    },
    "Bangladesh": {
      "prevalencePer100k": 2907,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2400
    },
    "Canada": {
      "prevalencePer100k": 2677,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 9600
    },
    "Chile": {
      "prevalencePer100k": 2517,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 4600
    },
    "China": {
      "prevalencePer100k": 2309,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 3100
    },
    "Colombia": {
      "prevalencePer100k": 2480,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 1600
    },
    "Czech Republic": {
      "prevalencePer100k": 1987,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 3900
    },
    "Egypt": {
      "prevalencePer100k": 2662,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 1700
    },
    "France": {
      "prevalencePer100k": 2338,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 7500
    },
    "Germany": {
      "prevalencePer100k": 2210,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 8200
    },
    "India": {
      "prevalencePer100k": 2419,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 2200
    },
    "Indonesia": {
      "prevalencePer100k": 2515,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 2300
    },
    "Israel": {
      "prevalencePer100k": 984,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 7200
    },
    "Italy": {
      "prevalencePer100k": 2856,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 3000
    },
    "Japan": {
      "prevalencePer100k": 2340,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 7300
    },
    "Kenya": {
      "prevalencePer100k": 2353,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 1100
    },
    "Netherlands": {
      "prevalencePer100k": 2826,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 7200
    },
    "Nigeria": {
      "prevalencePer100k": 2765,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 1600
    },
    "Pakistan": {
      "prevalencePer100k": 2573,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 1300
    },
    "Peru": {
      "prevalencePer100k": 2482,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 1700
    },
    "Philippines": {
      "prevalencePer100k": 2678,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2200
    },
    "Poland": {
      "prevalencePer100k": 2498,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 2600
    },
    "Romania": {
      "prevalencePer100k": 2925,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 2000
    },
    "Saudi Arabia": {
      "prevalencePer100k": 2346,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 5000
    },
    "South Africa": {
      "prevalencePer100k": 2389,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 1600
    },
    "South Korea": {
      "prevalencePer100k": 2156,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 2800
    },
    "Spain": {
      "prevalencePer100k": 2193,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 4200
    },
    "Sri Lanka": {
      "prevalencePer100k": 2624,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 2400
    },
    "Sweden": {
      "prevalencePer100k": 2517,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 6900
    },
    "Taiwan": {
      "prevalencePer100k": 2310,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 3200
    },
    "United Arab Emirates": {
      "prevalencePer100k": 2940,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 3700
    },
    "United Kingdom": {
      "prevalencePer100k": 2519,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 8500
    },
    "United States": {
      "prevalencePer100k": 2695,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 8200
    },
    "Vietnam": {
      "prevalencePer100k": 2859,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 1800
    }
  },
  "Asthma (Moderate-Severe)": {
    "Argentina": {
      "prevalencePer100k": 3247,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 3200
    },
    "Australia": {
      "prevalencePer100k": 3643,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 7200
    },
    "Bangladesh": {
      "prevalencePer100k": 2536,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3100
    },
    "Canada": {
      "prevalencePer100k": 4779,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 11700
    },
    "Chile": {
      "prevalencePer100k": 4942,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 5300
    },
    "China": {
      "prevalencePer100k": 3178,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 4200
    },
    "Colombia": {
      "prevalencePer100k": 3731,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 2100
    },
    "Czech Republic": {
      "prevalencePer100k": 4860,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 4600
    },
    "Egypt": {
      "prevalencePer100k": 2087,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 1900
    },
    "France": {
      "prevalencePer100k": 3512,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 10400
    },
    "Germany": {
      "prevalencePer100k": 2429,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 11100
    },
    "India": {
      "prevalencePer100k": 4982,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 3000
    },
    "Indonesia": {
      "prevalencePer100k": 2258,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 3000
    },
    "Israel": {
      "prevalencePer100k": 3838,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 8500
    },
    "Italy": {
      "prevalencePer100k": 3608,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 4500
    },
    "Japan": {
      "prevalencePer100k": 4086,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 8400
    },
    "Kenya": {
      "prevalencePer100k": 4846,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 1600
    },
    "Netherlands": {
      "prevalencePer100k": 2635,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 8900
    },
    "Nigeria": {
      "prevalencePer100k": 4028,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 2500
    },
    "Pakistan": {
      "prevalencePer100k": 2977,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 1400
    },
    "Peru": {
      "prevalencePer100k": 2557,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 2200
    },
    "Philippines": {
      "prevalencePer100k": 4668,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3500
    },
    "Poland": {
      "prevalencePer100k": 2040,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 3400
    },
    "Romania": {
      "prevalencePer100k": 3102,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 2200
    },
    "Saudi Arabia": {
      "prevalencePer100k": 4190,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 6000
    },
    "South Africa": {
      "prevalencePer100k": 2459,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 1700
    },
    "South Korea": {
      "prevalencePer100k": 4974,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 3500
    },
    "Spain": {
      "prevalencePer100k": 3936,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 4800
    },
    "Sri Lanka": {
      "prevalencePer100k": 2716,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 2700
    },
    "Sweden": {
      "prevalencePer100k": 2669,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 11200
    },
    "Taiwan": {
      "prevalencePer100k": 2974,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 3400
    },
    "United Arab Emirates": {
      "prevalencePer100k": 3080,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 5100
    },
    "United Kingdom": {
      "prevalencePer100k": 4432,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 9300
    },
    "United States": {
      "prevalencePer100k": 4037,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 8300
    },
    "Vietnam": {
      "prevalencePer100k": 3513,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2700
    }
  },
  "COPD": {
    "Argentina": {
      "prevalencePer100k": 2080,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 3600
    },
    "Australia": {
      "prevalencePer100k": 3759,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 9400
    },
    "Bangladesh": {
      "prevalencePer100k": 2320,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3100
    },
    "Canada": {
      "prevalencePer100k": 4279,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 10800
    },
    "Chile": {
      "prevalencePer100k": 2862,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 5800
    },
    "China": {
      "prevalencePer100k": 4732,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 3800
    },
    "Colombia": {
      "prevalencePer100k": 3970,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 1800
    },
    "Czech Republic": {
      "prevalencePer100k": 3301,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 5300
    },
    "Egypt": {
      "prevalencePer100k": 4143,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 2400
    },
    "France": {
      "prevalencePer100k": 4018,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 10900
    },
    "Germany": {
      "prevalencePer100k": 2055,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 10400
    },
    "India": {
      "prevalencePer100k": 3329,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 2600
    },
    "Indonesia": {
      "prevalencePer100k": 4406,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 2800
    },
    "Israel": {
      "prevalencePer100k": 4215,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 9900
    },
    "Italy": {
      "prevalencePer100k": 3633,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 3800
    },
    "Japan": {
      "prevalencePer100k": 3073,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 8500
    },
    "Kenya": {
      "prevalencePer100k": 4365,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 1600
    },
    "Netherlands": {
      "prevalencePer100k": 2955,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 8500
    },
    "Nigeria": {
      "prevalencePer100k": 3795,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 2500
    },
    "Pakistan": {
      "prevalencePer100k": 4350,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 1500
    },
    "Peru": {
      "prevalencePer100k": 2933,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 1800
    },
    "Philippines": {
      "prevalencePer100k": 2076,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2800
    },
    "Poland": {
      "prevalencePer100k": 2330,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 4500
    },
    "Romania": {
      "prevalencePer100k": 2814,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 2200
    },
    "Saudi Arabia": {
      "prevalencePer100k": 4614,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 6200
    },
    "South Africa": {
      "prevalencePer100k": 4389,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 1900
    },
    "South Korea": {
      "prevalencePer100k": 4147,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 3800
    },
    "Spain": {
      "prevalencePer100k": 2540,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 6200
    },
    "Sri Lanka": {
      "prevalencePer100k": 3539,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 2500
    },
    "Sweden": {
      "prevalencePer100k": 2665,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 10500
    },
    "Taiwan": {
      "prevalencePer100k": 3409,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 4100
    },
    "United Arab Emirates": {
      "prevalencePer100k": 2188,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 4200
    },
    "United Kingdom": {
      "prevalencePer100k": 5206,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 12100
    },
    "United States": {
      "prevalencePer100k": 4968,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 9200
    },
    "Vietnam": {
      "prevalencePer100k": 4307,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2300
    }
  },
  "Rheumatoid Arthritis": {
    "Argentina": {
      "prevalencePer100k": 369,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 4900
    },
    "Australia": {
      "prevalencePer100k": 718,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 12000
    },
    "Bangladesh": {
      "prevalencePer100k": 484,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 4200
    },
    "Canada": {
      "prevalencePer100k": 670,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 18100
    },
    "Chile": {
      "prevalencePer100k": 574,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 9800
    },
    "China": {
      "prevalencePer100k": 758,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 6700
    },
    "Colombia": {
      "prevalencePer100k": 808,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 2700
    },
    "Czech Republic": {
      "prevalencePer100k": 555,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 8100
    },
    "Egypt": {
      "prevalencePer100k": 888,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 3000
    },
    "France": {
      "prevalencePer100k": 654,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 16100
    },
    "Germany": {
      "prevalencePer100k": 356,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 14900
    },
    "India": {
      "prevalencePer100k": 517,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 3500
    },
    "Indonesia": {
      "prevalencePer100k": 338,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 4100
    },
    "Israel": {
      "prevalencePer100k": 519,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 12300
    },
    "Italy": {
      "prevalencePer100k": 819,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 6900
    },
    "Japan": {
      "prevalencePer100k": 435,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 14000
    },
    "Kenya": {
      "prevalencePer100k": 723,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 2300
    },
    "Netherlands": {
      "prevalencePer100k": 425,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 14400
    },
    "Nigeria": {
      "prevalencePer100k": 716,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 3900
    },
    "Pakistan": {
      "prevalencePer100k": 860,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 2400
    },
    "Peru": {
      "prevalencePer100k": 502,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 3000
    },
    "Philippines": {
      "prevalencePer100k": 771,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 4800
    },
    "Poland": {
      "prevalencePer100k": 755,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 6300
    },
    "Romania": {
      "prevalencePer100k": 512,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 3000
    },
    "Saudi Arabia": {
      "prevalencePer100k": 485,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 10000
    },
    "South Africa": {
      "prevalencePer100k": 868,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2900
    },
    "South Korea": {
      "prevalencePer100k": 710,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 6700
    },
    "Spain": {
      "prevalencePer100k": 709,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 7600
    },
    "Sri Lanka": {
      "prevalencePer100k": 800,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 4400
    },
    "Sweden": {
      "prevalencePer100k": 509,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 17000
    },
    "Taiwan": {
      "prevalencePer100k": 333,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 6200
    },
    "United Arab Emirates": {
      "prevalencePer100k": 740,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 6900
    },
    "United Kingdom": {
      "prevalencePer100k": 559,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 15100
    },
    "United States": {
      "prevalencePer100k": 706,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 15200
    },
    "Vietnam": {
      "prevalencePer100k": 579,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3500
    }
  },
  "Psoriasis (Moderate-Severe)": {
    "Argentina": {
      "prevalencePer100k": 1143,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 3600
    },
    "Australia": {
      "prevalencePer100k": 531,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 11000
    },
    "Bangladesh": {
      "prevalencePer100k": 863,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3500
    },
    "Canada": {
      "prevalencePer100k": 846,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 15900
    },
    "Chile": {
      "prevalencePer100k": 1071,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 8800
    },
    "China": {
      "prevalencePer100k": 837,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 5900
    },
    "Colombia": {
      "prevalencePer100k": 1169,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 3000
    },
    "Czech Republic": {
      "prevalencePer100k": 796,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 7900
    },
    "Egypt": {
      "prevalencePer100k": 1100,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 2600
    },
    "France": {
      "prevalencePer100k": 583,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 14800
    },
    "Germany": {
      "prevalencePer100k": 1105,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 11800
    },
    "India": {
      "prevalencePer100k": 569,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 3900
    },
    "Indonesia": {
      "prevalencePer100k": 938,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 3800
    },
    "Israel": {
      "prevalencePer100k": 767,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 12700
    },
    "Italy": {
      "prevalencePer100k": 833,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 5900
    },
    "Japan": {
      "prevalencePer100k": 921,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 10900
    },
    "Kenya": {
      "prevalencePer100k": 1034,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 1700
    },
    "Netherlands": {
      "prevalencePer100k": 684,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 12400
    },
    "Nigeria": {
      "prevalencePer100k": 1048,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 2900
    },
    "Pakistan": {
      "prevalencePer100k": 950,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 1800
    },
    "Peru": {
      "prevalencePer100k": 804,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 2700
    },
    "Philippines": {
      "prevalencePer100k": 801,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3800
    },
    "Poland": {
      "prevalencePer100k": 545,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 5800
    },
    "Romania": {
      "prevalencePer100k": 1030,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 3200
    },
    "Saudi Arabia": {
      "prevalencePer100k": 569,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 7200
    },
    "South Africa": {
      "prevalencePer100k": 1144,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2300
    },
    "South Korea": {
      "prevalencePer100k": 676,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 5100
    },
    "Spain": {
      "prevalencePer100k": 1171,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 8100
    },
    "Sri Lanka": {
      "prevalencePer100k": 707,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 3600
    },
    "Sweden": {
      "prevalencePer100k": 1286,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 11700
    },
    "Taiwan": {
      "prevalencePer100k": 820,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 4300
    },
    "United Arab Emirates": {
      "prevalencePer100k": 890,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 6700
    },
    "United Kingdom": {
      "prevalencePer100k": 1352,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 13000
    },
    "United States": {
      "prevalencePer100k": 1105,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 13200
    },
    "Vietnam": {
      "prevalencePer100k": 738,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3300
    }
  },
  "Crohn's Disease": {
    "Argentina": {
      "prevalencePer100k": 346,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 5300
    },
    "Australia": {
      "prevalencePer100k": 279,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 14300
    },
    "Bangladesh": {
      "prevalencePer100k": 101,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 4600
    },
    "Canada": {
      "prevalencePer100k": 167,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 19200
    },
    "Chile": {
      "prevalencePer100k": 270,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 10800
    },
    "China": {
      "prevalencePer100k": 20,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 6200
    },
    "Colombia": {
      "prevalencePer100k": 107,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 3500
    },
    "Czech Republic": {
      "prevalencePer100k": 348,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 10800
    },
    "Egypt": {
      "prevalencePer100k": 229,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 3300
    },
    "France": {
      "prevalencePer100k": 301,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 16200
    },
    "Germany": {
      "prevalencePer100k": 298,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 16800
    },
    "India": {
      "prevalencePer100k": 71,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 5300
    },
    "Indonesia": {
      "prevalencePer100k": 51,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 4800
    },
    "Israel": {
      "prevalencePer100k": 320,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 15200
    },
    "Italy": {
      "prevalencePer100k": 139,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 7700
    },
    "Japan": {
      "prevalencePer100k": 291,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 18100
    },
    "Kenya": {
      "prevalencePer100k": 262,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 2400
    },
    "Netherlands": {
      "prevalencePer100k": 290,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 16100
    },
    "Nigeria": {
      "prevalencePer100k": 266,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 3700
    },
    "Pakistan": {
      "prevalencePer100k": 235,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 2500
    },
    "Peru": {
      "prevalencePer100k": 184,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 3600
    },
    "Philippines": {
      "prevalencePer100k": 222,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 4900
    },
    "Poland": {
      "prevalencePer100k": 139,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 6300
    },
    "Romania": {
      "prevalencePer100k": 218,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 3500
    },
    "Saudi Arabia": {
      "prevalencePer100k": 316,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 11000
    },
    "South Africa": {
      "prevalencePer100k": 140,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3000
    },
    "South Korea": {
      "prevalencePer100k": 160,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 6300
    },
    "Spain": {
      "prevalencePer100k": 280,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 9800
    },
    "Sri Lanka": {
      "prevalencePer100k": 93,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 5500
    },
    "Sweden": {
      "prevalencePer100k": 205,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 14900
    },
    "Taiwan": {
      "prevalencePer100k": 101,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 7000
    },
    "United Arab Emirates": {
      "prevalencePer100k": 260,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 8500
    },
    "United Kingdom": {
      "prevalencePer100k": 209,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 16700
    },
    "United States": {
      "prevalencePer100k": 349,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 16200
    },
    "Vietnam": {
      "prevalencePer100k": 34,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 4500
    }
  },
  "Chronic Kidney Disease (Stage 3-4)": {
    "Argentina": {
      "prevalencePer100k": 4970,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 5900
    },
    "Australia": {
      "prevalencePer100k": 5406,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 18800
    },
    "Bangladesh": {
      "prevalencePer100k": 4837,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 4900
    },
    "Canada": {
      "prevalencePer100k": 5425,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 24800
    },
    "Chile": {
      "prevalencePer100k": 5027,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 13100
    },
    "China": {
      "prevalencePer100k": 5361,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 9000
    },
    "Colombia": {
      "prevalencePer100k": 5276,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 4300
    },
    "Czech Republic": {
      "prevalencePer100k": 4511,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 12200
    },
    "Egypt": {
      "prevalencePer100k": 5910,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 3800
    },
    "France": {
      "prevalencePer100k": 5075,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 18300
    },
    "Germany": {
      "prevalencePer100k": 4443,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 19800
    },
    "India": {
      "prevalencePer100k": 4907,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 5800
    },
    "Indonesia": {
      "prevalencePer100k": 5285,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 6500
    },
    "Israel": {
      "prevalencePer100k": 6916,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 17300
    },
    "Italy": {
      "prevalencePer100k": 4831,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 8200
    },
    "Japan": {
      "prevalencePer100k": 4833,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 18500
    },
    "Kenya": {
      "prevalencePer100k": 5249,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 2600
    },
    "Netherlands": {
      "prevalencePer100k": 3218,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 14900
    },
    "Nigeria": {
      "prevalencePer100k": 4684,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 4400
    },
    "Pakistan": {
      "prevalencePer100k": 4593,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 3300
    },
    "Peru": {
      "prevalencePer100k": 5097,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 4200
    },
    "Philippines": {
      "prevalencePer100k": 4825,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 5300
    },
    "Poland": {
      "prevalencePer100k": 4348,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 8800
    },
    "Romania": {
      "prevalencePer100k": 5978,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 4300
    },
    "Saudi Arabia": {
      "prevalencePer100k": 5345,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 12300
    },
    "South Africa": {
      "prevalencePer100k": 5102,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 3600
    },
    "South Korea": {
      "prevalencePer100k": 4047,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 8200
    },
    "Spain": {
      "prevalencePer100k": 5196,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 11600
    },
    "Sri Lanka": {
      "prevalencePer100k": 4381,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 5700
    },
    "Sweden": {
      "prevalencePer100k": 5383,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 20100
    },
    "Taiwan": {
      "prevalencePer100k": 7087,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 8500
    },
    "United Arab Emirates": {
      "prevalencePer100k": 3051,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 9600
    },
    "United Kingdom": {
      "prevalencePer100k": 4663,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 23300
    },
    "United States": {
      "prevalencePer100k": 5031,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 18900
    },
    "Vietnam": {
      "prevalencePer100k": 5173,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 4300
    }
  },
  "Major Depressive Disorder": {
    "Argentina": {
      "prevalencePer100k": 4868,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 3000
    },
    "Australia": {
      "prevalencePer100k": 5477,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 6700
    },
    "Bangladesh": {
      "prevalencePer100k": 5925,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2300
    },
    "Canada": {
      "prevalencePer100k": 3411,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 9800
    },
    "Chile": {
      "prevalencePer100k": 4470,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 5500
    },
    "China": {
      "prevalencePer100k": 5590,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 3900
    },
    "Colombia": {
      "prevalencePer100k": 7263,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 1800
    },
    "Czech Republic": {
      "prevalencePer100k": 4896,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 4100
    },
    "Egypt": {
      "prevalencePer100k": 7164,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 1700
    },
    "France": {
      "prevalencePer100k": 3732,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 10100
    },
    "Germany": {
      "prevalencePer100k": 6478,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 10000
    },
    "India": {
      "prevalencePer100k": 3028,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 2600
    },
    "Indonesia": {
      "prevalencePer100k": 7392,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 2300
    },
    "Israel": {
      "prevalencePer100k": 4588,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 8800
    },
    "Italy": {
      "prevalencePer100k": 4199,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 3500
    },
    "Japan": {
      "prevalencePer100k": 6279,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 8700
    },
    "Kenya": {
      "prevalencePer100k": 7199,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 1400
    },
    "Netherlands": {
      "prevalencePer100k": 6609,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 6400
    },
    "Nigeria": {
      "prevalencePer100k": 3412,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 2000
    },
    "Pakistan": {
      "prevalencePer100k": 5387,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 1300
    },
    "Peru": {
      "prevalencePer100k": 6555,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 1600
    },
    "Philippines": {
      "prevalencePer100k": 3434,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2800
    },
    "Poland": {
      "prevalencePer100k": 4950,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 3200
    },
    "Romania": {
      "prevalencePer100k": 6651,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 1800
    },
    "Saudi Arabia": {
      "prevalencePer100k": 6988,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 4800
    },
    "South Africa": {
      "prevalencePer100k": 6936,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 1900
    },
    "South Korea": {
      "prevalencePer100k": 5499,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 3200
    },
    "Spain": {
      "prevalencePer100k": 6504,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 4300
    },
    "Sri Lanka": {
      "prevalencePer100k": 3641,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 2600
    },
    "Sweden": {
      "prevalencePer100k": 5035,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 9200
    },
    "Taiwan": {
      "prevalencePer100k": 5900,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 3300
    },
    "United Arab Emirates": {
      "prevalencePer100k": 5056,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 3400
    },
    "United Kingdom": {
      "prevalencePer100k": 4802,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 9100
    },
    "United States": {
      "prevalencePer100k": 6410,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 9100
    },
    "Vietnam": {
      "prevalencePer100k": 4271,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 2300
    }
  },
  "Sickle Cell Disease": {
    "Argentina": {
      "prevalencePer100k": 51,
      "regulatoryApprovalWeeks": 33,
      "avgCostPerPatientUsd": 10900
    },
    "Australia": {
      "prevalencePer100k": 28,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 30300
    },
    "Bangladesh": {
      "prevalencePer100k": 59,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 7700
    },
    "Canada": {
      "prevalencePer100k": 72,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 36500
    },
    "Chile": {
      "prevalencePer100k": 71,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 19900
    },
    "China": {
      "prevalencePer100k": 19,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 13800
    },
    "Colombia": {
      "prevalencePer100k": 51,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 6100
    },
    "Czech Republic": {
      "prevalencePer100k": 34,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 18200
    },
    "Egypt": {
      "prevalencePer100k": 25,
      "regulatoryApprovalWeeks": 43,
      "avgCostPerPatientUsd": 7700
    },
    "France": {
      "prevalencePer100k": 15,
      "regulatoryApprovalWeeks": 17,
      "avgCostPerPatientUsd": 38900
    },
    "Germany": {
      "prevalencePer100k": 74,
      "regulatoryApprovalWeeks": 18,
      "avgCostPerPatientUsd": 33400
    },
    "India": {
      "prevalencePer100k": 76,
      "regulatoryApprovalWeeks": 40,
      "avgCostPerPatientUsd": 9600
    },
    "Indonesia": {
      "prevalencePer100k": 79,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 9000
    },
    "Israel": {
      "prevalencePer100k": 26,
      "regulatoryApprovalWeeks": 16,
      "avgCostPerPatientUsd": 25400
    },
    "Italy": {
      "prevalencePer100k": 35,
      "regulatoryApprovalWeeks": 29,
      "avgCostPerPatientUsd": 12800
    },
    "Japan": {
      "prevalencePer100k": 58,
      "regulatoryApprovalWeeks": 20,
      "avgCostPerPatientUsd": 29100
    },
    "Kenya": {
      "prevalencePer100k": 600,
      "regulatoryApprovalWeeks": 55,
      "avgCostPerPatientUsd": 4800
    },
    "Netherlands": {
      "prevalencePer100k": 50,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 27900
    },
    "Nigeria": {
      "prevalencePer100k": 1108,
      "regulatoryApprovalWeeks": 50,
      "avgCostPerPatientUsd": 9200
    },
    "Pakistan": {
      "prevalencePer100k": 64,
      "regulatoryApprovalWeeks": 42,
      "avgCostPerPatientUsd": 4600
    },
    "Peru": {
      "prevalencePer100k": 34,
      "regulatoryApprovalWeeks": 46,
      "avgCostPerPatientUsd": 6400
    },
    "Philippines": {
      "prevalencePer100k": 27,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 10400
    },
    "Poland": {
      "prevalencePer100k": 69,
      "regulatoryApprovalWeeks": 32,
      "avgCostPerPatientUsd": 14600
    },
    "Romania": {
      "prevalencePer100k": 60,
      "regulatoryApprovalWeeks": 49,
      "avgCostPerPatientUsd": 6600
    },
    "Saudi Arabia": {
      "prevalencePer100k": 52,
      "regulatoryApprovalWeeks": 30,
      "avgCostPerPatientUsd": 20300
    },
    "South Africa": {
      "prevalencePer100k": 313,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 6300
    },
    "South Korea": {
      "prevalencePer100k": 78,
      "regulatoryApprovalWeeks": 22,
      "avgCostPerPatientUsd": 13900
    },
    "Spain": {
      "prevalencePer100k": 53,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 18300
    },
    "Sri Lanka": {
      "prevalencePer100k": 10,
      "regulatoryApprovalWeeks": 52,
      "avgCostPerPatientUsd": 8100
    },
    "Sweden": {
      "prevalencePer100k": 35,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 34200
    },
    "Taiwan": {
      "prevalencePer100k": 74,
      "regulatoryApprovalWeeks": 37,
      "avgCostPerPatientUsd": 13200
    },
    "United Arab Emirates": {
      "prevalencePer100k": 48,
      "regulatoryApprovalWeeks": 31,
      "avgCostPerPatientUsd": 14000
    },
    "United Kingdom": {
      "prevalencePer100k": 25,
      "regulatoryApprovalWeeks": 19,
      "avgCostPerPatientUsd": 34300
    },
    "United States": {
      "prevalencePer100k": 53,
      "regulatoryApprovalWeeks": 23,
      "avgCostPerPatientUsd": 31900
    },
    "Vietnam": {
      "prevalencePer100k": 44,
      "regulatoryApprovalWeeks": 51,
      "avgCostPerPatientUsd": 8900
    }
  }
};
