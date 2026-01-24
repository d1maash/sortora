/**
 * Offline reverse geocoding utility
 *
 * Converts GPS coordinates to location names without external API calls.
 * Uses a built-in database of major cities and regions.
 */

export interface LocationInfo {
  country: string;
  countryCode: string;
  region?: string;
  city?: string;
  timezone?: string;
}

// Major cities database with approximate coordinates
// Format: [lat, lon, city, region, country, countryCode, timezone]
const CITIES_DATABASE: [number, number, string, string, string, string, string][] = [
  // Russia
  [55.7558, 37.6173, 'Москва', 'Москва', 'Россия', 'RU', 'Europe/Moscow'],
  [59.9343, 30.3351, 'Санкт-Петербург', 'Санкт-Петербург', 'Россия', 'RU', 'Europe/Moscow'],
  [56.8389, 60.6057, 'Екатеринбург', 'Свердловская область', 'Россия', 'RU', 'Asia/Yekaterinburg'],
  [55.0084, 82.9357, 'Новосибирск', 'Новосибирская область', 'Россия', 'RU', 'Asia/Novosibirsk'],
  [55.7887, 49.1221, 'Казань', 'Татарстан', 'Россия', 'RU', 'Europe/Moscow'],
  [54.9885, 73.3242, 'Омск', 'Омская область', 'Россия', 'RU', 'Asia/Omsk'],
  [53.2001, 50.1500, 'Самара', 'Самарская область', 'Россия', 'RU', 'Europe/Samara'],
  [47.2357, 39.7015, 'Ростов-на-Дону', 'Ростовская область', 'Россия', 'RU', 'Europe/Moscow'],
  [54.7388, 55.9721, 'Уфа', 'Башкортостан', 'Россия', 'RU', 'Asia/Yekaterinburg'],
  [56.3287, 44.0020, 'Нижний Новгород', 'Нижегородская область', 'Россия', 'RU', 'Europe/Moscow'],
  [43.1056, 131.8735, 'Владивосток', 'Приморский край', 'Россия', 'RU', 'Asia/Vladivostok'],
  [44.9572, 34.1108, 'Симферополь', 'Крым', 'Россия', 'RU', 'Europe/Simferopol'],
  [43.5855, 39.7231, 'Сочи', 'Краснодарский край', 'Россия', 'RU', 'Europe/Moscow'],
  [45.0448, 38.9760, 'Краснодар', 'Краснодарский край', 'Россия', 'RU', 'Europe/Moscow'],
  [48.7194, 44.5018, 'Волгоград', 'Волгоградская область', 'Россия', 'RU', 'Europe/Volgograd'],

  // Turkey
  [41.0082, 28.9784, 'Стамбул', 'Стамбул', 'Турция', 'TR', 'Europe/Istanbul'],
  [39.9334, 32.8597, 'Анкара', 'Анкара', 'Турция', 'TR', 'Europe/Istanbul'],
  [38.4192, 27.1287, 'Измир', 'Измир', 'Турция', 'TR', 'Europe/Istanbul'],
  [36.8969, 30.7133, 'Анталья', 'Анталья', 'Турция', 'TR', 'Europe/Istanbul'],
  [37.0000, 35.3213, 'Адана', 'Адана', 'Турция', 'TR', 'Europe/Istanbul'],
  [36.5500, 32.0000, 'Аланья', 'Анталья', 'Турция', 'TR', 'Europe/Istanbul'],
  [36.8500, 28.2667, 'Мармарис', 'Мугла', 'Турция', 'TR', 'Europe/Istanbul'],
  [37.0344, 27.4305, 'Бодрум', 'Мугла', 'Турция', 'TR', 'Europe/Istanbul'],
  [36.8841, 30.7056, 'Кемер', 'Анталья', 'Турция', 'TR', 'Europe/Istanbul'],

  // Egypt
  [30.0444, 31.2357, 'Каир', 'Каир', 'Египет', 'EG', 'Africa/Cairo'],
  [31.2001, 29.9187, 'Александрия', 'Александрия', 'Египет', 'EG', 'Africa/Cairo'],
  [27.2579, 33.8116, 'Хургада', 'Красное море', 'Египет', 'EG', 'Africa/Cairo'],
  [27.9158, 34.3300, 'Шарм-эш-Шейх', 'Южный Синай', 'Египет', 'EG', 'Africa/Cairo'],

  // UAE
  [25.2048, 55.2708, 'Дубай', 'Дубай', 'ОАЭ', 'AE', 'Asia/Dubai'],
  [24.4539, 54.3773, 'Абу-Даби', 'Абу-Даби', 'ОАЭ', 'AE', 'Asia/Dubai'],
  [25.3463, 55.4209, 'Шарджа', 'Шарджа', 'ОАЭ', 'AE', 'Asia/Dubai'],

  // Thailand
  [13.7563, 100.5018, 'Бангкок', 'Бангкок', 'Таиланд', 'TH', 'Asia/Bangkok'],
  [7.8804, 98.3923, 'Пхукет', 'Пхукет', 'Таиланд', 'TH', 'Asia/Bangkok'],
  [9.1382, 99.3219, 'Самуи', 'Сураттхани', 'Таиланд', 'TH', 'Asia/Bangkok'],
  [12.9236, 100.8825, 'Паттайя', 'Чонбури', 'Таиланд', 'TH', 'Asia/Bangkok'],
  [18.7883, 98.9853, 'Чиангмай', 'Чиангмай', 'Таиланд', 'TH', 'Asia/Bangkok'],

  // Europe
  [48.8566, 2.3522, 'Париж', 'Иль-де-Франс', 'Франция', 'FR', 'Europe/Paris'],
  [51.5074, -0.1278, 'Лондон', 'Англия', 'Великобритания', 'GB', 'Europe/London'],
  [52.5200, 13.4050, 'Берлин', 'Берлин', 'Германия', 'DE', 'Europe/Berlin'],
  [41.9028, 12.4964, 'Рим', 'Лацио', 'Италия', 'IT', 'Europe/Rome'],
  [40.4168, -3.7038, 'Мадрид', 'Мадрид', 'Испания', 'ES', 'Europe/Madrid'],
  [41.3851, 2.1734, 'Барселона', 'Каталония', 'Испания', 'ES', 'Europe/Madrid'],
  [48.2082, 16.3738, 'Вена', 'Вена', 'Австрия', 'AT', 'Europe/Vienna'],
  [50.0755, 14.4378, 'Прага', 'Прага', 'Чехия', 'CZ', 'Europe/Prague'],
  [52.3676, 4.9041, 'Амстердам', 'Северная Голландия', 'Нидерланды', 'NL', 'Europe/Amsterdam'],
  [47.4979, 19.0402, 'Будапешт', 'Будапешт', 'Венгрия', 'HU', 'Europe/Budapest'],
  [44.4268, 26.1025, 'Бухарест', 'Бухарест', 'Румыния', 'RO', 'Europe/Bucharest'],
  [42.6977, 23.3219, 'София', 'София', 'Болгария', 'BG', 'Europe/Sofia'],
  [37.9838, 23.7275, 'Афины', 'Аттика', 'Греция', 'GR', 'Europe/Athens'],
  [45.4642, 9.1900, 'Милан', 'Ломбардия', 'Италия', 'IT', 'Europe/Rome'],
  [43.7102, 7.2620, 'Ницца', 'Прованс', 'Франция', 'FR', 'Europe/Paris'],
  [43.2965, 5.3698, 'Марсель', 'Прованс', 'Франция', 'FR', 'Europe/Paris'],

  // USA
  [40.7128, -74.0060, 'Нью-Йорк', 'Нью-Йорк', 'США', 'US', 'America/New_York'],
  [34.0522, -118.2437, 'Лос-Анджелес', 'Калифорния', 'США', 'US', 'America/Los_Angeles'],
  [41.8781, -87.6298, 'Чикаго', 'Иллинойс', 'США', 'US', 'America/Chicago'],
  [29.7604, -95.3698, 'Хьюстон', 'Техас', 'США', 'US', 'America/Chicago'],
  [33.4484, -112.0740, 'Финикс', 'Аризона', 'США', 'US', 'America/Phoenix'],
  [37.7749, -122.4194, 'Сан-Франциско', 'Калифорния', 'США', 'US', 'America/Los_Angeles'],
  [25.7617, -80.1918, 'Майами', 'Флорида', 'США', 'US', 'America/New_York'],
  [36.1699, -115.1398, 'Лас-Вегас', 'Невада', 'США', 'US', 'America/Los_Angeles'],
  [47.6062, -122.3321, 'Сиэтл', 'Вашингтон', 'США', 'US', 'America/Los_Angeles'],
  [38.9072, -77.0369, 'Вашингтон', 'Округ Колумбия', 'США', 'US', 'America/New_York'],

  // Asia
  [35.6762, 139.6503, 'Токио', 'Токио', 'Япония', 'JP', 'Asia/Tokyo'],
  [37.5665, 126.9780, 'Сеул', 'Сеул', 'Южная Корея', 'KR', 'Asia/Seoul'],
  [31.2304, 121.4737, 'Шанхай', 'Шанхай', 'Китай', 'CN', 'Asia/Shanghai'],
  [39.9042, 116.4074, 'Пекин', 'Пекин', 'Китай', 'CN', 'Asia/Shanghai'],
  [22.3193, 114.1694, 'Гонконг', 'Гонконг', 'Китай', 'CN', 'Asia/Hong_Kong'],
  [1.3521, 103.8198, 'Сингапур', 'Сингапур', 'Сингапур', 'SG', 'Asia/Singapore'],
  [28.6139, 77.2090, 'Дели', 'Дели', 'Индия', 'IN', 'Asia/Kolkata'],
  [19.0760, 72.8777, 'Мумбаи', 'Махараштра', 'Индия', 'IN', 'Asia/Kolkata'],
  [3.1390, 101.6869, 'Куала-Лумпур', 'Куала-Лумпур', 'Малайзия', 'MY', 'Asia/Kuala_Lumpur'],
  [-6.2088, 106.8456, 'Джакарта', 'Джакарта', 'Индонезия', 'ID', 'Asia/Jakarta'],
  [-8.3405, 115.0920, 'Бали', 'Бали', 'Индонезия', 'ID', 'Asia/Makassar'],
  [14.5995, 120.9842, 'Манила', 'Метро Манила', 'Филиппины', 'PH', 'Asia/Manila'],
  [21.0278, 105.8342, 'Ханой', 'Ханой', 'Вьетнам', 'VN', 'Asia/Ho_Chi_Minh'],
  [10.8231, 106.6297, 'Хошимин', 'Хошимин', 'Вьетнам', 'VN', 'Asia/Ho_Chi_Minh'],

  // CIS
  [50.4501, 30.5234, 'Киев', 'Киев', 'Украина', 'UA', 'Europe/Kiev'],
  [49.9935, 36.2304, 'Харьков', 'Харьковская область', 'Украина', 'UA', 'Europe/Kiev'],
  [46.4825, 30.7233, 'Одесса', 'Одесская область', 'Украина', 'UA', 'Europe/Kiev'],
  [53.9045, 27.5615, 'Минск', 'Минск', 'Беларусь', 'BY', 'Europe/Minsk'],
  [43.2220, 76.8512, 'Алматы', 'Алматы', 'Казахстан', 'KZ', 'Asia/Almaty'],
  [51.1801, 71.4460, 'Нур-Султан', 'Нур-Султан', 'Казахстан', 'KZ', 'Asia/Almaty'],
  [41.2995, 69.2401, 'Ташкент', 'Ташкент', 'Узбекистан', 'UZ', 'Asia/Tashkent'],
  [41.3111, 36.2894, 'Самарканд', 'Самарканд', 'Узбекистан', 'UZ', 'Asia/Samarkand'],
  [42.8746, 74.5698, 'Бишкек', 'Бишкек', 'Кыргызстан', 'KG', 'Asia/Bishkek'],
  [40.4093, 49.8671, 'Баку', 'Баку', 'Азербайджан', 'AZ', 'Asia/Baku'],
  [41.7151, 44.8271, 'Тбилиси', 'Тбилиси', 'Грузия', 'GE', 'Asia/Tbilisi'],
  [40.1872, 44.5152, 'Ереван', 'Ереван', 'Армения', 'AM', 'Asia/Yerevan'],

  // Popular beach destinations
  [36.4618, 28.2176, 'Родос', 'Южные Эгейские острова', 'Греция', 'GR', 'Europe/Athens'],
  [35.5138, 24.0180, 'Крит', 'Крит', 'Греция', 'GR', 'Europe/Athens'],
  [25.0330, -77.3963, 'Нассау', 'Нью-Провиденс', 'Багамы', 'BS', 'America/Nassau'],
  [21.1619, -86.8515, 'Канкун', 'Кинтана-Роо', 'Мексика', 'MX', 'America/Cancun'],
  [20.2114, -87.4654, 'Тулум', 'Кинтана-Роо', 'Мексика', 'MX', 'America/Cancun'],
  [-4.0383, 39.6682, 'Момбаса', 'Момбаса', 'Кения', 'KE', 'Africa/Nairobi'],
  [-6.1659, 39.2026, 'Занзибар', 'Занзибар', 'Танзания', 'TZ', 'Africa/Dar_es_Salaam'],
  [-20.1609, 57.5012, 'Маврикий', 'Маврикий', 'Маврикий', 'MU', 'Indian/Mauritius'],
  [-4.6796, 55.4920, 'Сейшелы', 'Маэ', 'Сейшелы', 'SC', 'Indian/Mahe'],
  [4.1755, 73.5093, 'Мальдивы', 'Мале', 'Мальдивы', 'MV', 'Indian/Maldives'],
  [21.4735, 39.8148, 'Джидда', 'Мекка', 'Саудовская Аравия', 'SA', 'Asia/Riyadh'],
];

// Country boundaries (rough approximations for fallback)
const COUNTRY_BOUNDS: Record<string, { name: string; latMin: number; latMax: number; lonMin: number; lonMax: number }> = {
  RU: { name: 'Россия', latMin: 41, latMax: 82, lonMin: 19, lonMax: 180 },
  TR: { name: 'Турция', latMin: 36, latMax: 42, lonMin: 26, lonMax: 45 },
  EG: { name: 'Египет', latMin: 22, latMax: 32, lonMin: 25, lonMax: 37 },
  AE: { name: 'ОАЭ', latMin: 22, latMax: 26, lonMin: 51, lonMax: 57 },
  TH: { name: 'Таиланд', latMin: 5, latMax: 21, lonMin: 97, lonMax: 106 },
  FR: { name: 'Франция', latMin: 41, latMax: 51, lonMin: -5, lonMax: 10 },
  GB: { name: 'Великобритания', latMin: 49, latMax: 61, lonMin: -8, lonMax: 2 },
  DE: { name: 'Германия', latMin: 47, latMax: 55, lonMin: 6, lonMax: 15 },
  IT: { name: 'Италия', latMin: 36, latMax: 47, lonMin: 6, lonMax: 19 },
  ES: { name: 'Испания', latMin: 36, latMax: 44, lonMin: -10, lonMax: 5 },
  US: { name: 'США', latMin: 24, latMax: 50, lonMin: -125, lonMax: -66 },
  JP: { name: 'Япония', latMin: 24, latMax: 46, lonMin: 123, lonMax: 146 },
  KR: { name: 'Южная Корея', latMin: 33, latMax: 39, lonMin: 124, lonMax: 132 },
  CN: { name: 'Китай', latMin: 18, latMax: 54, lonMin: 73, lonMax: 135 },
  IN: { name: 'Индия', latMin: 8, latMax: 37, lonMin: 68, lonMax: 98 },
  AU: { name: 'Австралия', latMin: -44, latMax: -10, lonMin: 113, lonMax: 154 },
  BR: { name: 'Бразилия', latMin: -34, latMax: 6, lonMin: -74, lonMax: -34 },
  UA: { name: 'Украина', latMin: 44, latMax: 53, lonMin: 22, lonMax: 41 },
  BY: { name: 'Беларусь', latMin: 51, latMax: 56, lonMin: 23, lonMax: 33 },
  KZ: { name: 'Казахстан', latMin: 40, latMax: 56, lonMin: 46, lonMax: 88 },
  GR: { name: 'Греция', latMin: 35, latMax: 42, lonMin: 19, lonMax: 30 },
  ID: { name: 'Индонезия', latMin: -11, latMax: 6, lonMin: 95, lonMax: 141 },
  VN: { name: 'Вьетнам', latMin: 8, latMax: 24, lonMin: 102, lonMax: 110 },
  MX: { name: 'Мексика', latMin: 14, latMax: 33, lonMin: -118, lonMax: -86 },
  MV: { name: 'Мальдивы', latMin: -1, latMax: 8, lonMin: 72, lonMax: 74 },
};

/**
 * Calculate distance between two GPS points in kilometers (Haversine formula)
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Find the nearest city to the given coordinates
 */
function findNearestCity(lat: number, lon: number): {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  timezone: string;
  distance: number;
} | null {
  let nearest: typeof CITIES_DATABASE[0] | null = null;
  let minDistance = Infinity;

  for (const city of CITIES_DATABASE) {
    const [cityLat, cityLon] = city;
    const distance = haversineDistance(lat, lon, cityLat, cityLon);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = city;
    }
  }

  // Only return if within 100km of a known city
  if (nearest && minDistance <= 100) {
    return {
      city: nearest[2],
      region: nearest[3],
      country: nearest[4],
      countryCode: nearest[5],
      timezone: nearest[6],
      distance: minDistance,
    };
  }

  return null;
}

/**
 * Find country by coordinates using bounding boxes
 */
function findCountry(lat: number, lon: number): { name: string; code: string } | null {
  for (const [code, bounds] of Object.entries(COUNTRY_BOUNDS)) {
    if (
      lat >= bounds.latMin &&
      lat <= bounds.latMax &&
      lon >= bounds.lonMin &&
      lon <= bounds.lonMax
    ) {
      return { name: bounds.name, code };
    }
  }
  return null;
}

/**
 * Reverse geocode GPS coordinates to a location name
 *
 * @param latitude - GPS latitude
 * @param longitude - GPS longitude
 * @returns Location information
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<LocationInfo> {
  // Validate coordinates
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    isNaN(latitude) ||
    isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Invalid GPS coordinates');
  }

  // Try to find nearest city first
  const nearestCity = findNearestCity(latitude, longitude);

  if (nearestCity) {
    return {
      country: nearestCity.country,
      countryCode: nearestCity.countryCode,
      region: nearestCity.region,
      city: nearestCity.city,
      timezone: nearestCity.timezone,
    };
  }

  // Fallback to country detection
  const country = findCountry(latitude, longitude);

  if (country) {
    return {
      country: country.name,
      countryCode: country.code,
    };
  }

  // Unknown location
  return {
    country: 'Неизвестно',
    countryCode: 'XX',
  };
}

/**
 * Format location for display
 */
export function formatLocation(location: LocationInfo, style: 'full' | 'short' = 'short'): string {
  if (style === 'full') {
    const parts = [location.city, location.region, location.country].filter(Boolean);
    return parts.join(', ');
  }

  // Short style: city or country
  return location.city || location.country;
}

/**
 * Get city suggestions for a partial name
 */
export function suggestCities(query: string, limit = 10): string[] {
  const lowerQuery = query.toLowerCase();

  const matches = CITIES_DATABASE
    .filter(([, , city]) => city.toLowerCase().includes(lowerQuery))
    .map(([, , city, region, country]) => `${city}, ${country}`)
    .slice(0, limit);

  return matches;
}

export default reverseGeocode;
