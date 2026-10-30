const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const ROOT = __dirname;
const DATA = path.join(ROOT, "data.json");
const UPLOADS = path.join(ROOT, "public", "uploads");
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "CHANGE_ME";
const DG_KEY = process.env.DGIS_KEY || "";
const FREE_DELIVERY_MINIMUM = 5000;
const SMALL_ORDER_DELIVERY = 500;

// ФИЛИАЛЫ
const DEFAULT_BRANCHES = [
  {
    id: 1, name: "Абылай Хана 24", address: "Абылай Хана 24",
    lat: 43.2636, lon: 76.9399, workTime: "24/7",
    deliveryTime: "11:00-23:00", kaspi: "", whatsapp: "", radius: 1500
  },
  {
    id: 2, name: "Tomchi Premium — Абылай Хана 34", address: "Абылай Хана 34",
    lat: 43.2641, lon: 76.9406, workTime: "10:00-02:00",
    deliveryTime: "11:00-23:00", kaspi: "", whatsapp: "", radius: 1500
  },
  {
    id: 3, name: "Жібек Жолы 106", address: "Жибек Жолы 106",
    lat: 43.2624, lon: 76.9447, workTime: "10:00-02:00",
    deliveryTime: "11:00-23:00", kaspi: "", whatsapp: "", radius: 1500
  },
  {
    id: 4, name: "Абая 47", address: "Абая 47",
    lat: 43.2410, lon: 76.9126, workTime: "10:00-02:00",
    deliveryTime: "11:00-23:00", kaspi: "", whatsapp: "", radius: 1500
  },
  {
    id: 5, name: "Яссауи 66", address: "Яссауи 66",
    lat: 43.2210, lon: 76.7950, workTime: "10:00-02:00",
    deliveryTime: "11:00-23:00", kaspi: "", whatsapp: "", radius: 1500
  }
];

// ЗОНЫ ДОСТАВКИ
const ZONE_1 = {
  id: "zone1", name: "Зона 1",
  minLat: 43.2380, maxLat: 43.2750,
  minLon: 76.9100, maxLon: 76.9600
};

const ZONE_2 = {
  id: "zone2", name: "Зона 2",
  minLat: 43.2050, maxLat: 43.2400,
  minLon: 76.7500, maxLon: 76.8500
};

const DELIVERY_ZONES = [ZONE_1, ZONE_2];

// НАЧАЛЬНОЕ МЕНЮ
const MENU_SEED = [
  ["plov", "Плов", "🍚", [
    ["Ташкентский", 2090],
    ["Ханский", 2590],
    ["Казахский", 2690],
    ["Ташкентский 1 кг", 5490],
    ["Ханский 1 кг", 6990]
  ]],
  ["shashlyki", "Шашлыки", "🍢", [
    ["Люля", 1390],
    ["Крылышки", 1390],
    ["Окорочка", 1390],
    ["Утка", 1390],
    ["Рулет", 1490],
    ["Баранина", 1690],
    ["Говядина", 1690]
  ]],
  ["lagman", "Лагман Вок", "🍜", [
    ["Домашний лагман", 2390],
    ["Гуйру лагман", 2390],
    ["Гуйру цомян", 2490],
    ["Динь Динь", 2490],
    ["Мошуру", 2490],
    ["Мясо по-тайски", 2790],
    ["Фри с мясом", 2790],
    ["Казан кебаб с рисом", 3390]
  ]],
  ["bakery", "Выпечка", "🥟", [
    ["Самса говяжий", 600],
    ["Самса куриный", 550],
    ["Лепешка", 300]
  ]],
  ["sauces", "Соусы", "🥫", [
    ["Кетчуп", 250],
    ["Сырный", 250],
    ["Тар тар", 350],
    ["Соус для самсы", 250]
  ]],
  ["soups", "Супы", "🍲", [
    ["Пельмени", 1890],
    ["Тефтели", 1990],
    ["Сорпа", 1990],
    ["Манпар", 1990],
    ["Нарын", 2390]
  ]],
  ["combo", "Комбо и сеты", "🍱", [
    ["Комбо 1", 2690, "Суп с тефтелями, 1 самса говядина, 0.5 Салам кола"],
    ["Комбо 2", 8690, "1 кг ташкентский плов, 2 ачичук, 2 люля"],
    ["Комбо 3", 8590, "1 кг ханский плов, 1 ачичук, 1 л Салам кола"],
    ["Семейный Комбо", 13390, "1 кг ташкентский плов, 4 шашлыка, 1 свежий, 2 лепешки, 1 л Салам кола"],
    ["Ассорти Шашлыков", 7990, "3 люля, 1 баранина, 1 говядина, 1 утка, 1 крылья"]
  ]],
  ["salads", "Салаты", "🥗", [
    ["Ачичук", 1190],
    ["Свежий", 1390],
    ["Цезарь с курицей", 2190],
    ["Малибу", 1990],
    ["Хрустящий баклажан", 2190]
  ]],
  ["doner", "Донеры", "🌯", [
    ["Донер куриный", 1790],
    ["Донер куриный 1.5", 2290],
    ["Донер говяжий", 1890],
    ["Донер говяжий 1.5", 2390]
  ]],
  ["burgers", "Бургеры", "🍔", [
    ["Чизбургер Куриный", 1990],
    ["Чизбургер Говяжий", 2190],
    ["Чизбургер Ассорти", 2690]
  ]],
  ["pizza", "Пицца и закуски", "🍕", [
    ["Пицца донер", 2590],
    ["Маргаритта", 2290],
    ["Пицца куриная", 2690],
    ["Пепперони", 2790],
    ["4 сезона", 2890],
    ["Фри", 890],
    ["Наггетсы", 1190]
  ]],
  ["drinks", "Напитки", "🥤", [
    ["Салам 0.5", 790],
    ["Салам ЖБ", 790],
    ["Салам 1л", 1290],
    ["ДА ДА 0.2", 590],
    ["ДА ДА 1л", 1290],
    ["Компот 0.5", 490],
    ["Компот 1л", 790],
    ["Вода 0.5", 590],
    ["Вода 1л", 790],
    ["Айран", 400]
  ]]
];

function slug(value) {
  return String(value).toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "") || crypto.randomUUID();
}

function makeSeedMenu() {
  const categories = [];
  const products = [];

  for (const [catId, name, emoji, items] of MENU_SEED) {
    categories.push({
      id: catId,
      name,
      emoji,
      active: true,
      sort: categories.length + 1
    });

    for (const item of items) {
      const [productName, price, description = ""] = item;
      const branchSettings = {};

      for (const branch of DEFAULT_BRANCHES) {
        branchSettings[branch.id] = {
          enabled: true,
          price
        };
      }

      products.push({
        id: catId + "-" + slug(productName),
        categoryId: catId,
        name: productName,
        description,
        image: "",
        emoji,
        basePrice: price,
        active: true,
        sort: products.length + 1,
        branchSettings
      });
    }
  }

  return { categories, products };
}

function initialData() {
  return {
    nextOrderId: 1001,
    pickupPoints: DEFAULT_BRANCHES,
    orders: [],
    menu: makeSeedMenu()
  };
}

if (!fs.existsSync(DATA)) {
  fs.writeFileSync(DATA, JSON.stringify(initialData(), null, 2));
}

if (!fs.existsSync(UPLOADS)) {
  fs.mkdirSync(UPLOADS, { recursive: true });
}

function read() {
  const data = JSON.parse(fs.readFileSync(DATA, "utf8"));

  if (!Array.isArray(data.pickupPoints)) {
    data.pickupPoints = DEFAULT_BRANCHES;
  }

  if (!Array.isArray(data.orders)) data.orders = [];
  if (!data.nextOrderId) data.nextOrderId = 1001;

  if (
    !data.menu ||
    !Array.isArray(data.menu.categories) ||
    !Array.isArray(data.menu.products)
  ) {
    data.menu = makeSeedMenu();
  }

  data.pickupPoints = data.pickupPoints.map((p, i) => {
    const def = DEFAULT_BRANCHES[i];
    return {
      ...(def || {}),
      ...p,
      id: Number(p.id || (def && def.id) || i + 1)
    };
  });

  return data;
}

function save(data) {
  const temp = DATA + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, DATA);
}

function json(res, code, data) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  });
  res.end(JSON.stringify(data));
}

function getBody(req, maxBytes = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.on("data", chunk => {
      size += chunk.length;

      if (size > maxBytes) {
        reject(new Error("Размер запроса слишком большой"));
        req.destroy();
        return;
      }

      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Некорректный JSON"));
      }
    });

    req.on("error", reject);
  });
}

function auth(req) {
  return ADMIN_TOKEN !== "CHANGE_ME" &&
    req.headers.authorization === `Bearer ${ADMIN_TOKEN}`;
}

function requireAdmin(req, res) {
  if (auth(req)) return true;
  json(res, 401, { error: "Нет доступа. Проверьте ADMIN_TOKEN." });
  return false;
}

async function geocode(query) {
  if (!DG_KEY) throw new Error("DGIS_KEY не настроен в Render");

  const url = "https://catalog.api.2gis.com/3.0/items/geocode?" +
    new URLSearchParams({
      q: query + ", Алматы, Казахстан",
      fields: "items.point,items.full_address_name",
      page_size: "1",
      key: DG_KEY
    });

  const response = await fetch(url);
  if (!response.ok) throw new Error("Ошибка геокодера 2GIS");

  const data = await response.json();
  const item = data?.result?.items?.[0];

  if (!item?.point) return null;

  return {
    lat: Number(item.point.lat),
    lon: Number(item.point.lon),
    address: item.full_address_name || query
  };
}

function insideZone(point, zone) {
  return point.lat >= zone.minLat &&
    point.lat <= zone.maxLat &&
    point.lon >= zone.minLon &&
    point.lon <= zone.maxLon;
}

function findZone(point) {
  return DELIVERY_ZONES.find(zone => insideZone(point, zone)) || null;
}

function calculateDelivery(amount, inZone) {
  if (!inZone) {
    return {
      deliveryPrice: null,
      total: null,
      externalCourier: true
    };
  }

  if (amount >= FREE_DELIVERY_MINIMUM) {
    return {
      deliveryPrice: 0,
      total: amount,
      externalCourier: false
    };
  }

  return {
    deliveryPrice: SMALL_ORDER_DELIVERY,
    total: amount + SMALL_ORDER_DELIVERY,
    externalCourier: false
  };
}

async function checkZone(address, amount = 0) {
  const destination = await geocode(address);

  if (!destination) {
    return {
      found: false,
      inZone: false,
      message: "Не удалось найти адрес. Уточните адрес."
    };
  }

  const zone = findZone(destination);
  const delivery = calculateDelivery(
    Number(amount) || 0,
    Boolean(zone)
  );

  if (!zone) {
    return {
      found: true,
      inZone: false,
      zone: null,
      coordinates: destination,
      deliveryPrice: null,
      total: null,
      externalCourier: true,
      message: "Адрес вне зоны доставки. Курьера нужно вызвать через Яндекс Go или inDrive."
    };
  }

  return {
    found: true,
    inZone: true,
    zone: zone.name,
    coordinates: destination,
    deliveryPrice: delivery.deliveryPrice,
    total: delivery.total,
    externalCourier: false,
    message: delivery.deliveryPrice === 0
      ? "Адрес входит в зону. Доставка бесплатная — 0 ₸."
      : "Адрес входит в зону. Доставка — 500 ₸."
  };
}

function cleanProductForBranch(product, branchId) {
  const setting = product.branchSettings?.[String(branchId)] ||
    { enabled: true, price: product.basePrice };

  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description || "",
    image: product.image || "",
    emoji: product.emoji || "🍽️",
    price: Number(setting.price ?? product.basePrice),
    active: product.active !== false && setting.enabled !== false
  };
}

function publicMenu(branchId) {
  const data = read();
  const id = String(branchId || 1);

  const categories = data.menu.categories
    .filter(c => c.active !== false)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));

  const products = data.menu.products
    .filter(p => p.active !== false)
    .map(p => cleanProductForBranch(p, id))
    .filter(p => p.active);

  return {
    categories: categories.filter(c =>
      products.some(p => p.categoryId === c.id)
    ),
    products
  };
}