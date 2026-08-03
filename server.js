const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const DATA = path.join(ROOT, "data.json");

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "CHANGE_ME";
const DG_KEY = process.env.DGIS_KEY || "";

// =====================================================
// TOMCHI — ДОСТАВКА
// =====================================================

const FREE_DELIVERY_MINIMUM = 5000;
const SMALL_ORDER_DELIVERY = 500;

// =====================================================
// 5 ТОЧЕК ОТПРАВЛЕНИЯ — НЕ УДАЛЯЕМ
// =====================================================
const DEFAULT = {
  nextOrderId: 1001,

  pickupPoints: [

    {
      id:1,
      name:"Абылай Хана 24",
      address:"Абылай Хана 24",

      lat:43.2636,
      lon:76.9399,

      workTime:"24/7",

      deliveryTime:"11:00-23:00",

      kaspi:"",
      whatsapp:""
    },

    {
      id:2,
      name:"Tomchi Premium",

      address:"Абылай Хана 34",

      lat:43.2641,
      lon:76.9406,

      workTime:"10:00-02:00",

      deliveryTime:"11:00-23:00",

      kaspi:"",
      whatsapp:""
    },

    {
      id:3,
      name:"Арбат",

      address:"Жибек Жолы 106",

      lat:43.2624,
      lon:76.9447,

      workTime:"10:00-02:00",

      deliveryTime:"11:00-23:00",

      kaspi:"",
      whatsapp:""
    },

    {
      id:4,
      name:"Абая 47",

      address:"Абая 47",

      lat:43.2410,
      lon:76.9126,

      workTime:"10:00-02:00",

      deliveryTime:"11:00-23:00",

      kaspi:"",
      whatsapp:""
    },

    {
      id:5,
      name:"Яссауи",

      address:"Яссауи 66А",

      lat:43.2210,
      lon:76.7950,

      workTime:"10:00-02:00",

      deliveryTime:"11:00-23:00",

      kaspi:"",
      whatsapp:""
    }

  ],

  orders:[]
};

// =====================================================
// 2 КВАДРАТНЫЕ ЗОНЫ
// =====================================================

// ЗОНА 1
// Алматы-2 / Сейфуллина / Сатпаева / Абая

const ZONE_1 = {
  id: "zone1",
  name: "Зона 1",

  minLat: 43.2380,
  maxLat: 43.2750,

  minLon: 76.9100,
  maxLon: 76.9600
};

// ЗОНА 2
// Ташкентская / Каргалинская / Б. Момышулы / Абая

const ZONE_2 = {
  id: "zone2",
  name: "Зона 2",

  minLat: 43.2050,
  maxLat: 43.2400,

  minLon: 76.7500,
  maxLon: 76.8500
};

const DELIVERY_ZONES = [
  ZONE_1,
  ZONE_2
];

// =====================================================
// DATA
// =====================================================

if (!fs.existsSync(DATA)) {
  fs.writeFileSync(
    DATA,
    JSON.stringify(DEFAULT, null, 2)
  );
}

const read = () =>
  JSON.parse(
    fs.readFileSync(DATA, "utf8")
  );

const save = data =>
  fs.writeFileSync(
    DATA,
    JSON.stringify(data, null, 2)
  );

// =====================================================
// HELPERS
// =====================================================

const json = (res, code, data) => {
  res.writeHead(code, {
    "Content-Type":
      "application/json; charset=utf-8",

    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Headers":
      "Content-Type,Authorization"
  });

  res.end(JSON.stringify(data));
};

const getBody = req =>
  new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });

const auth = req =>
  req.headers.authorization ===
  `Bearer ${ADMIN_TOKEN}`;

// =====================================================
// 2GIS
// =====================================================

async function geocode(query) {
  if (!DG_KEY) {
    throw Error("DGIS_KEY is not configured");
  }

  const url =
    "https://catalog.api.2gis.com/3.0/items/geocode?" +
    new URLSearchParams({
      q: query + ", Алматы, Казахстан",
      fields: "items.point,items.full_address_name",
      page_size: "1",
      key: DG_KEY
    });

  const response = await fetch(url);

  if (!response.ok) {
    throw Error("Geocoder error");
  }

  const data = await response.json();

  const item =
    data?.result?.items?.[0];

  if (!item?.point) {
    return null;
  }

  return {
    lat: Number(item.point.lat),
    lon: Number(item.point.lon),
    address:
      item.full_address_name || query
  };
}

// =====================================================
// ПРОВЕРКА КВАДРАТА
// =====================================================

function insideZone(point, zone) {
  return (
    point.lat >= zone.minLat &&
    point.lat <= zone.maxLat &&
    point.lon >= zone.minLon &&
    point.lon <= zone.maxLon
  );
}

function findZone(point) {
  for (const zone of DELIVERY_ZONES) {
    if (insideZone(point, zone)) {
      return zone;
    }
  }

  return null;
}

// =====================================================
// РАСЧЁТ ДОСТАВКИ
// =====================================================

function calculateDelivery(amount, inZone) {

  // ВНЕ ЗОНЫ
  if (!inZone) {
    return {
      deliveryPrice: null,
      total: null,
      externalCourier: true
    };
  }

  // В ЗОНЕ + 5000 И БОЛЬШЕ
  if (amount >= FREE_DELIVERY_MINIMUM) {
    return {
      deliveryPrice: 0,
      total: amount,
      externalCourier: false
    };
  }

  // В ЗОНЕ + МЕНЬШЕ 5000
  return {
    deliveryPrice: SMALL_ORDER_DELIVERY,
    total: amount + SMALL_ORDER_DELIVERY,
    externalCourier: false
  };
}

// =====================================================
// ПРОВЕРКА АДРЕСА
// =====================================================

async function checkZone(address, amount = 0) {

  const destination =
    await geocode(address);

  if (!destination) {
    return {
      found: false,
      inZone: false,
      message:
        "Не удалось найти этот адрес. Уточните адрес."
    };
  }

  const zone =
    findZone(destination);

  const inZone = Boolean(zone);

  const delivery =
    calculateDelivery(
      Number(amount) || 0,
      inZone
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

      message:
        "Адрес вне зоны доставки. Курьера нужно вызвать через Яндекс Go или inDrive."
    };
  }

  return {
    found: true,

    inZone: true,

    zone: zone.name,

    coordinates: destination,

    deliveryPrice:
      delivery.deliveryPrice,

    total:
      delivery.total,

    externalCourier: false,

    message:
      delivery.deliveryPrice === 0
        ? "Адрес входит в зону. Доставка бесплатная — 0 ₸."
        : "Адрес входит в зону. Доставка — 500 ₸."
  };
}

// =====================================================
// SERVER
// =====================================================

const server =
  http.createServer(
    async (req, res) => {

      const u =
        new URL(
          req.url,
          `http://${req.headers.host}`
        );

      const method = req.method;

      if (method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "Content-Type,Authorization"
        });

        return res.end();
      }

      try {

        // -----------------------------
        // CONFIG
        // -----------------------------

        if (
          u.pathname === "/api/config" &&
          method === "GET"
        ) {

          const data = read();

          return json(res, 200, {
            pickupPoints:
              data.pickupPoints.map(
                x => x.address
              ),

            zones:
              DELIVERY_ZONES.map(
                x => x.name
              )
          });
        }

        // -----------------------------
        // CHECK ZONE
        // -----------------------------

        if (
          u.pathname === "/api/check-zone" &&
          method === "POST"
        ) {

          const body =
            await getBody(req);

          if (!body.address) {
            return json(res, 400, {
              found: false,
              message:
                "Введите адрес доставки."
            });
          }

          return json(
            res,
            200,
            await checkZone(
              body.address,
              Number(body.amount || 0)
            )
          );
        }

        // -----------------------------
        // CREATE ORDER
        // -----------------------------

        if (
          u.pathname === "/api/orders" &&
          method === "POST"
        ) {

          const body =
            await getBody(req);

          const data = read();

          if (
            !body.name ||
            !body.phone ||
            !body.pickup ||
            !body.address
          ) {
            return json(res, 400, {
              error:
                "Заполните обязательные поля."
            });
          }

          if (
            !data.pickupPoints.some(
              x => x.address === body.pickup
            )
          ) {
            return json(res, 400, {
              error:
                "Недопустимая точка отправления."
            });
          }

          const amount =
            Number(body.amount || 0);

           {
            return json(res, 400, {
              error:
                "Введите сумму заказа."
            });
          }

          const zone =
            await checkZone(
              body.address,
              amount
            );

          if (!zone.found) {
            return json(res, 400, {
              error: zone.message
            });
          }

          const order = {
            id:
              data.nextOrderId++,

            createdAt:
              new Date().toISOString(),

            name:
              String(body.name),

            phone:
              String(body.phone),

            pickup:
              String(body.pickup),

            address:
              String(body.address),

            amount,

            item:
              String(body.item || ""),

            comment:
              String(body.comment || ""),

            inZone:
              zone.inZone,

            zone:
              zone.zone || null,

            deliveryPrice:
              zone.deliveryPrice,

            total:
              zone.total,

            externalCourier:
              zone.externalCourier,

            coordinates:
              zone.coordinates,

            status:
              "Новый"
          };

          data.orders.unshift(order);

          save(data);

          return json(
            res,
            201,
            order
          );
        }

        // -----------------------------
        // ADMIN ORDERS
        // -----------------------------

        if (
          u.pathname === "/api/orders" &&
          method === "GET"
        ) {

          if (!auth(req)) {
            return json(res, 401, {
              error: "Нет доступа"
            });
          }

          return json(
            res,
            200,
            read().orders
          );
        }

        // -----------------------------
        // ADMIN PATCH
        // -----------------------------

        if (
          u.pathname.startsWith(
            "/api/orders/"
          ) &&
          method === "PATCH"
        ) {

          if (!auth(req)) {
            return json(res, 401, {
              error: "Нет доступа"
            });
          }

          const id =
            Number(
              u.pathname
                .split("/")
                .pop()
            );

          const body =
            await getBody(req);

          const data = read();

          const order =
            data.orders.find(
              x => x.id === id
            );

          if (!order) {
            return json(res, 404, {
              error:
                "Заказ не найден"
            });
          }

          if (body.status) {
            order.status =
              body.status;
          }

          if (
            "deliveryPrice" in body
          ) {
            order.deliveryPrice =
              body.deliveryPrice;
          }

          save(data);

          return json(
            res,
            200,
            order
          );
        }

        // -----------------------------
        // STATIC FILES
        // -----------------------------

        let file =
          u.pathname === "/"
            ? "/index.html"
            : u.pathname;

        if (file === "/admin") {
          file = "/admin.html";
        }

        const full =
          path.normalize(
            path.join(ROOT, file)
          );

        if (!full.startsWith(ROOT)) {
          return json(res, 403, {
            error: "Forbidden"
          });
        }

        fs.readFile(
          full,
          (error, content) => {

            if (error) {
              res.writeHead(404);
              return res.end(
                "Not found"
              );
            }

            const ext =
              path.extname(full);

            const types = {
              ".html":
                "text/html; charset=utf-8",

              ".js":
                "text/javascript; charset=utf-8",

              ".css":
                "text/css; charset=utf-8"
            };

            res.writeHead(200, {
              "Content-Type":
                types[ext] ||
                "text/plain; charset=utf-8"
            });

            res.end(content);
          }
        );

      } catch (error) {

        console.error(error);

        json(res, 500, {
          error:
            error.message
        });
      }
    }
  );

server.listen(
  PORT,
  () => {
    console.log(
      `Tomchi: http://localhost:${PORT}`
    );
  }
);