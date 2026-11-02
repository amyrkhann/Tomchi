
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

// ФИЛИАЛЫ
const DEFAULT_BRANCHES = [
  {
    id: 1,
    name: "Абылай Хана 24",
    address: "Абылай Хана 24",
    workTime: "24/7",
    deliveryTime: "11:00-23:00",
    kaspi: "",
    whatsapp: ""
  },
  {
    id: 2,
    name: "Tomchi Premium — Абылай Хана 34",
    address: "Абылай Хана 34",
    workTime: "10:00-02:00",
    deliveryTime: "11:00-23:00",
    kaspi: "",
    whatsapp: ""
  },
  {
    id: 3,
    name: "Жібек Жолы 106",
    address: "Жибек Жолы 106",
    workTime: "10:00-02:00",
    deliveryTime: "11:00-23:00",
    kaspi: "",
    whatsapp: ""
  },
  {
    id: 4,
    name: "Абая 47",
    address: "Абая 47",
    workTime: "10:00-02:00",
    deliveryTime: "11:00-23:00",
    kaspi: "",
    whatsapp: ""
  },
  {
    id: 5,
    name: "Яссауи 66",
    address: "Яссауи 66",
    workTime: "10:00-02:00",
    deliveryTime: "11:00-23:00",
    kaspi: "",
    whatsapp: ""
  }
];

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
    siteOpen: true,
    siteMessage: "",
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

  if (typeof data.siteOpen !== "boolean") {
    data.siteOpen = true;
  }

  if (typeof data.siteMessage !== "string") {
    data.siteMessage = "";
  }

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

function sendStaticFile(res, full) {
  fs.readFile(full, (err, content) => {
    if (err) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      return res.end("Not found");
    }

    const ext = path.extname(full).toLowerCase();

    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon"
    };

    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream"
    });

    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const method = req.method;
  const pathname = decodeURIComponent(u.pathname);

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    });
    return res.end();
  }

  try {
    // ПУБЛИЧНЫЕ НАСТРОЙКИ
    if (pathname === "/api/config" && method === "GET") {
      const data = read();

      return json(res, 200, {
        pickupPoints: data.pickupPoints,
        deliveryHours: "11:00-23:00",
        siteOpen: data.siteOpen !== false,
        siteMessage: data.siteMessage || ""
      });
    }

    // МЕНЮ ДЛЯ ВЫБРАННОГО ФИЛИАЛА
    if (pathname === "/api/menu" && method === "GET") {
      return json(
        res,
        200,
        publicMenu(u.searchParams.get("branchId") || 1)
      );
    }

    // СОЗДАНИЕ ЗАКАЗА
    if (pathname === "/api/orders" && method === "POST") {
      const body = await getBody(req);
      const data = read();

      if (data.siteOpen === false) {
        const message = String(data.siteMessage || "").trim() ||
          "Приём заказов временно остановлен. Попробуйте позже.";

        return json(res, 503, {
          error: message,
          siteMessage: message
        });
      }

      if (!body.name || !body.phone || !body.pickup || !body.address) {
        return json(res, 400, {
          error: "Заполните имя, телефон, филиал и адрес."
        });
      }

      const branch = data.pickupPoints.find(p =>
        String(p.id) === String(body.branchId) ||
        p.address === body.pickup ||
        p.name === body.pickup
      );

      if (!branch) {
        return json(res, 400, {
          error: "Выберите действующий филиал."
        });
      }

      const items = Array.isArray(body.items) ? body.items : [];
      let amount = Number(body.amount || 0);
      let itemText = String(body.item || "");

      if (items.length) {
        amount = 0;

        const orderLines = [];

        for (const item of items) {
          const product = data.menu.products.find(
            p => p.id === item.id
          );

          if (!product || product.active === false) {
            return json(res, 400, {
              error: "Одно из выбранных блюд больше недоступно."
            });
          }

          const clean = cleanProductForBranch(product, branch.id);

          if (!clean.active) {
            return json(res, 400, {
              error: `Блюдо «${product.name}» недоступно в выбранном филиале.`
            });
          }

          const qty = Math.max(
            1,
            Math.min(99, Number(item.quantity || 1))
          );

          amount += clean.price * qty;

          orderLines.push(
            `${product.name} x${qty} — ${clean.price * qty} ₸`
          );
        }

        itemText = orderLines.join("\n");
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return json(res, 400, {
          error: "Корзина пуста или сумма заказа некорректна."
        });
      }

      const order = {
        id: data.nextOrderId++,
        createdAt: new Date().toISOString(),
        name: String(body.name),
        phone: String(body.phone),
        pickup: branch.address,
        branchId: branch.id,
        branchName: branch.name,
        address: String(body.address),
        amount,
        item: itemText,
        items,
        comment: String(body.comment || ""),
        inZone: null,
        zone: null,
        deliveryPrice: null,
        total: amount,
        externalCourier: null,
        coordinates: null,
        status: "Новый"
      };

      data.orders.unshift(order);
      save(data);

      return json(res, 201, order);
    }

    // АВТОРИЗАЦИЯ АДМИНКИ
    if (
      pathname.startsWith("/api/admin/") ||
      (pathname === "/api/orders" && method !== "POST") ||
      (pathname.startsWith("/api/orders/") && method === "PATCH")
    ) {
      if (!requireAdmin(req, res)) return;
    }

    // УПРАВЛЕНИЕ РАБОТОЙ САЙТА
    if (pathname === "/api/admin/site-status" && method === "GET") {
      const data = read();

      return json(res, 200, {
        siteOpen: data.siteOpen !== false,
        siteMessage: data.siteMessage || ""
      });
    }

    if (pathname === "/api/admin/site-status" && method === "PUT") {
      const body = await getBody(req);
      const data = read();

      if (body.siteOpen !== undefined) {
        if (typeof body.siteOpen !== "boolean") {
          return json(res, 400, {
            error: "Укажите корректное состояние сайта."
          });
        }

        data.siteOpen = body.siteOpen;
      }

      if (body.siteMessage !== undefined) {
        if (typeof body.siteMessage !== "string") {
          return json(res, 400, {
            error: "Введите текст сообщения."
          });
        }

        data.siteMessage = body.siteMessage.trim().slice(0, 1000);
      }

      if (
        body.siteOpen === undefined &&
        body.siteMessage === undefined
      ) {
        return json(res, 400, {
          error: "Нет настроек для сохранения."
        });
      }

      save(data);

      return json(res, 200, {
        success: true,
        siteOpen: data.siteOpen !== false,
        siteMessage: data.siteMessage || ""
      });
    }

    // ПОЛУЧИТЬ ВСЁ МЕНЮ ДЛЯ АДМИНКИ
    if (pathname === "/api/admin/menu" && method === "GET") {
      return json(res, 200, read().menu);
    }

    // ДОБАВИТЬ КАТЕГОРИЮ
    if (pathname === "/api/admin/categories" && method === "POST") {
      const body = await getBody(req);

      if (!body.name || !String(body.name).trim()) {
        return json(res, 400, {
          error: "Введите название категории."
        });
      }

      const data = read();

      const category = {
        id: "cat-" + crypto.randomUUID(),
        name: String(body.name).trim(),
        emoji: String(body.emoji || "🍽️"),
        active: body.active !== false,
        sort: Number(
          body.sort || data.menu.categories.length + 1
        )
      };

      data.menu.categories.push(category);
      save(data);

      return json(res, 201, category);
    }

    // ИЗМЕНИТЬ ИЛИ УДАЛИТЬ КАТЕГОРИЮ
    const categoryMatch = pathname.match(
      /^\/api\/admin\/categories\/([^/]+)$/
    );

    if (
      categoryMatch &&
      (method === "PATCH" || method === "DELETE")
    ) {
      const id = categoryMatch[1];
      const data = read();

      const category = data.menu.categories.find(
        x => x.id === id
      );

      if (!category) {
        return json(res, 404, {
          error: "Категория не найдена."
        });
      }

      if (method === "DELETE") {
        data.menu.categories = data.menu.categories.filter(
          x => x.id !== id
        );

        data.menu.products.forEach(p => {
          if (p.categoryId === id) p.active = false;
        });
      } else {
        const body = await getBody(req);

        if (body.name !== undefined) {
          category.name = String(body.name).trim();
        }

        if (body.emoji !== undefined) {
          category.emoji = String(body.emoji);
        }

        if (body.active !== undefined) {
          category.active = Boolean(body.active);
        }

        if (body.sort !== undefined) {
          category.sort = Number(body.sort);
        }
      }

      save(data);
      return json(res, 200, { success: true });
    }

    // ДОБАВИТЬ БЛЮДО
    if (pathname === "/api/admin/products" && method === "POST") {
      const body = await getBody(req);

      if (!body.name || !body.categoryId) {
        return json(res, 400, {
          error: "Укажите название блюда и категорию."
        });
      }

      const data = read();

      if (!data.menu.categories.some(
        c => c.id === body.categoryId
      )) {
        return json(res, 400, {
          error: "Категория не найдена."
        });
      }

      const basePrice = Number(body.basePrice);

      if (!Number.isFinite(basePrice) || basePrice < 0) {
        return json(res, 400, {
          error: "Укажите правильную цену."
        });
      }

      const id = "product-" + crypto.randomUUID();
      const branchSettings = {};

      const selected = Array.isArray(body.branchIds)
        ? body.branchIds.map(String)
        : data.pickupPoints.map(p => String(p.id));

      for (const branch of data.pickupPoints) {
        branchSettings[String(branch.id)] = {
          enabled: selected.includes(String(branch.id)),
          price: basePrice
        };
      }

      const product = {
        id,
        categoryId: String(body.categoryId),
        name: String(body.name).trim(),
        description: String(body.description || ""),
        image: String(body.image || ""),
        emoji: String(body.emoji || "🍽️"),
        basePrice,
        active: body.active !== false,
        sort: Number(
          body.sort || data.menu.products.length + 1
        ),
        branchSettings
      };

      data.menu.products.push(product);
      save(data);

      return json(res, 201, product);
    }

    // ИЗМЕНИТЬ ИЛИ УДАЛИТЬ БЛЮДО
    const productMatch = pathname.match(
      /^\/api\/admin\/products\/([^/]+)$/
    );

    if (
      productMatch &&
      (method === "PATCH" || method === "DELETE")
    ) {
      const id = productMatch[1];
      const data = read();

      const product = data.menu.products.find(
        x => x.id === id
      );

      if (!product) {
        return json(res, 404, {
          error: "Блюдо не найдено."
        });
      }

      if (method === "DELETE") {
        product.active = false;
      } else {
        const body = await getBody(req);

        if (body.name !== undefined) {
          product.name = String(body.name).trim();
        }

        if (body.categoryId !== undefined) {
          product.categoryId = String(body.categoryId);
        }

        if (body.description !== undefined) {
          product.description = String(body.description);
        }

        if (body.image !== undefined) {
          product.image = String(body.image);
        }

        if (body.emoji !== undefined) {
          product.emoji = String(body.emoji);
        }

        if (body.basePrice !== undefined) {
          const price = Number(body.basePrice);

          if (!Number.isFinite(price) || price < 0) {
            return json(res, 400, {
              error: "Укажите правильную цену."
            });
          }

          product.basePrice = price;
        }

        if (body.active !== undefined) {
          product.active = Boolean(body.active);
        }

        if (body.sort !== undefined) {
          product.sort = Number(body.sort);
        }

        if (
          body.branchSettings &&
          typeof body.branchSettings === "object"
        ) {
          product.branchSettings = product.branchSettings || {};

          for (const [branchId, setting] of Object.entries(body.branchSettings)) {
            if (!data.pickupPoints.some(
              p => String(p.id) === String(branchId)
            )) continue;

            const price = Number(
              setting.price ?? product.basePrice
            );

            if (!Number.isFinite(price) || price < 0) {
              return json(res, 400, {
                error: "Укажите правильную цену филиала."
              });
            }

            product.branchSettings[String(branchId)] = {
              enabled: setting.enabled !== false,
              price
            };
          }
        }

        if (Array.isArray(body.branchIds)) {
          product.branchSettings = product.branchSettings || {};

          for (const branch of data.pickupPoints) {
            const key = String(branch.id);

            product.branchSettings[key] =
              product.branchSettings[key] ||
              { price: product.basePrice };

            product.branchSettings[key].enabled =
              body.branchIds.map(String).includes(key);
          }
        }
      }

      save(data);
      return json(res, 200, product);
    }

    // ФИЛИАЛЫ
    if (pathname === "/api/admin/branches" && method === "GET") {
      return json(res, 200, read().pickupPoints);
    }

    if (pathname === "/api/admin/branches" && method === "PUT") {
      const body = await getBody(req);

      if (!Array.isArray(body.pickupPoints)) {
        return json(res, 400, {
          error: "Неверный список филиалов."
        });
      }

      const data = read();

      data.pickupPoints = data.pickupPoints.map(old => {
        const incoming = body.pickupPoints.find(
          x => Number(x.id) === Number(old.id)
        );

        return incoming
          ? { ...old, ...incoming, id: old.id }
          : old;
      });

      save(data);
      return json(res, 200, data.pickupPoints);
    }

    // ЗАГРУЗКА ФОТОГРАФИЙ
    if (pathname === "/api/admin/upload" && method === "POST") {
      const body = await getBody(req, 12 * 1024 * 1024);

      const match = String(body.data || "").match(
        /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
      );

      if (!match) {
        return json(res, 400, {
          error: "Поддерживаются JPG, PNG и WEBP."
        });
      }

      const mime = match[1];
      const ext = mime === "image/jpeg"
        ? ".jpg"
        : mime === "image/png"
          ? ".png"
          : ".webp";

      const buffer = Buffer.from(match[2], "base64");

      if (buffer.length > 8 * 1024 * 1024) {
        return json(res, 400, {
          error: "Изображение должно быть меньше 8 МБ."
        });
      }

      fs.mkdirSync(UPLOADS, { recursive: true });

      const filename =
        Date.now() + "-" +
        crypto.randomBytes(5).toString("hex") + ext;

      fs.writeFileSync(
        path.join(UPLOADS, filename),
        buffer
      );

      return json(res, 201, {
        url: "/uploads/" + filename
      });
    }

    // СПИСОК ЗАКАЗОВ
    if (pathname === "/api/orders" && method === "GET") {
      return json(res, 200, read().orders);
    }

    // ИЗМЕНИТЬ СТАТУС ЗАКАЗА
    const orderMatch = pathname.match(
      /^\/api\/orders\/(\d+)$/
    );

    if (orderMatch && method === "PATCH") {
      const body = await getBody(req);
      const data = read();

      const order = data.orders.find(
        x => x.id === Number(orderMatch[1])
      );

      if (!order) {
        return json(res, 404, {
          error: "Заказ не найден."
        });
      }

      if (body.status) {
        order.status = String(body.status);
      }

      if ("deliveryPrice" in body) {
        order.deliveryPrice = body.deliveryPrice;
      }

      save(data);
      return json(res, 200, order);
    }

    // СТАТИЧЕСКИЕ ФАЙЛЫ САЙТА
    let relative;

    if (pathname === "/" || pathname === "/index.html") {
      relative = "index.html";
    } else if (
      pathname === "/admin" ||
      pathname === "/admin.html"
    ) {
      relative = "admin.html";
    } else if (
      /^\/(images|uploads|assets)\//.test(pathname)
    ) {
      relative = path.join(
        "public",
        pathname.replace(/^\/+/, "")
      );
    } else {
      return json(res, 404, {
        error: "Not found"
      });
    }

    const full = path.resolve(ROOT, relative);

    const publicRoot =
      path.resolve(ROOT, "public") + path.sep;

    const isRootPage =
      full === path.resolve(ROOT, "index.html") ||
      full === path.resolve(ROOT, "admin.html");

    if (!isRootPage && !full.startsWith(publicRoot)) {
      return json(res, 403, {
        error: "Forbidden"
      });
    }

    sendStaticFile(res, full);

  } catch (error) {
    console.error(error);

    if (!res.headersSent) {
      json(res, 500, {
        error: error.message || "Внутренняя ошибка сервера"
      });
    }
  }
});

server.listen(PORT, () => {
  console.log(`Tomchi Premium запущен на порту ${PORT}`);
});
