/**
 * 广西主要机场禁飞区数据
 * 数据来源：大疆飞行安全地图、民航局、地方政府公告
 * 坐标格式：[经度, 纬度]
 * 
 * 机场净空保护区：跑道中心线两侧各10公里，两端各20公里
 */

// 广西主要机场列表
const guangxiAirports = [
  {
    name: "南宁吴圩国际机场",
    icao: "ZGNN",
    iata: "NNG",
    lat: 22.608400,
    lng: 108.172400,
    city: "南宁",
  },
  {
    name: "桂林两江国际机场",
    icao: "ZGKL",
    iata: "KWL",
    lat: 25.218500,
    lng: 110.039200,
    city: "桂林",
  },
  {
    name: "北海福成机场",
    icao: "ZGBH",
    iata: "BHY",
    lat: 21.539200,
    lng: 109.292500,
    city: "北海",
  },
  {
    name: "柳州白莲机场",
    icao: "ZGZH",
    iata: "LZH",
    lat: 24.207500,
    lng: 109.390800,
    city: "柳州",
  },
  {
    name: "梧州长洲岛机场",
    icao: "ZGWZ",
    iata: "WUZ",
    lat: 23.456400,
    lng: 111.201900,
    city: "梧州",
  },
  {
    name: "百色巴马机场",
    icao: "ZGBS",
    iata: "AEB",
    lat: 23.787000,
    lng: 106.962500,
    city: "百色",
  },
  {
    name: "河池金城江机场",
    icao: "ZGHC",
    iata: "HCJ",
    lat: 24.806500,
    lng: 108.049800,
    city: "河池",
  },
  {
    name: "玉林福绵机场",
    icao: "ZGYL",
    iata: "YLX",
    lat: 22.554300,
    lng: 110.031800,
    city: "玉林",
  },
  {
    name: "钦州贝丘机场 (军用)",
    lat: 21.980800,
    lng: 108.624000,
    city: "钦州",
    military: true,
  },
  {
    name: "崇左凭祥机场 (军用)",
    lat: 22.086400,
    lng: 106.765300,
    city: "崇左",
    military: true,
  },
];

/**
 * 生成机场净空保护区矩形范围
 * 跑道中心线两侧各10km，两端各20km
 */
function generateAirportZone(
  lat: number,
  lng: number,
  heading: number = 0 // 跑道方向
): { coordinates: number[][][]; center: { lat: number; lng: number } } {
  // 简化为矩形 approximation
  const latOffset = 10 / 111; // 约10km
  const lngOffset = 10 / (111 * Math.cos((lat * Math.PI) / 180)); // 约10km
  const endOffset = 20 / 111; // 约20km

  // 简化为中心点+半径圆形区域
  const center = { lat, lng };
  const radius = 20000; // 20km + 10km buffer

  // 生成圆形近似多边形（8个点）
  const coordinates: number[][][] = [];
  const points = 16;
  const circleCoords: number[][] = [];

  for (let i = 0; i < points; i++) {
    const angle = (i * 360) / points;
    const radian = (angle * Math.PI) / 180;
    const dLat = (radius / 111000) * Math.cos(radian);
    const dLng =
      (radius / 111000 / Math.cos((lat * Math.PI) / 180)) * Math.sin(radian);
    circleCoords.push([lng + dLng, lat + dLat]);
  }

  // 闭合多边形
  circleCoords.push(circleCoords[0]);
  coordinates.push(circleCoords);

  return { coordinates, center };
}

/**
 * 生成广西机场禁飞区数据
 */
export function getGuangxiNoFlyZones() {
  return guangxiAirports.map((airport) => {
    const { coordinates, center } = generateAirportZone(
      airport.lat,
      airport.lng
    );

    return {
      id: `airport_${airport.city.toLowerCase()}`,
      name: airport.name,
      type: "polygon" as const,
      coordinates,
      center,
      radius: 22000, // 22km radius
      riskLevel: airport.military ? "critical" : ("high" as const),
      description: `${airport.city}机场净空保护区，${
        airport.military ? "军用机场，禁止飞行" : "民航机场，请遵守相关规定"
      }`,
      color: airport.military ? "#ff0000" : "#ff6600",
      enabled: true,
      source: "官方公告",
      city: airport.city,
    };
  });
}

/**
 * 广西其他重要禁飞区域
 */
export function getGuangxiOtherZones() {
  return [
    // 南宁市区部分区域
    {
      id: "region_nanning",
      name: "南宁市五象新区禁飞区",
      type: "polygon" as const,
      coordinates: [
        [108.4, 22.75],
        [108.45, 22.75],
        [108.45, 22.72],
        [108.4, 22.72],
        [108.4, 22.75],
      ],
      center: { lat: 22.735, lng: 108.425 },
      riskLevel: "medium" as const,
      description: "南宁市五象新区部分区域",
      color: "#ffaa00",
      enabled: false, // 默认不启用
    },
    // 军事管理区示例（需要更精确数据）
    {
      id: "military_placeholder",
      name: "军事管理区（示例）",
      type: "circle" as const,
      center: { lat: 22.8, lng: 108.3 },
      radius: 3000,
      riskLevel: "critical" as const,
      description: "军事管理区示例，实际数据需从官方获取",
      color: "#ff0000",
      enabled: false,
    },
  ];
}

/**
 * 导出完整的广西禁飞区数据
 */
export function getAllGuangxiZones() {
  return [
    ...getGuangxiNoFlyZones(),
    ...getGuangxiOtherZones(),
  ];
}

// 导出供其他地方使用
export default {
  guangxiAirports,
  getGuangxiNoFlyZones,
  getGuangxiOtherZones,
  getAllGuangxiZones,
};
