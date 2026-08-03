const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PUBLIC = ROOT;
const DATA = path.join(ROOT, "data.json");

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN =
  process.env.ADMIN_TOKEN || "CHANGE_ME";

const DG_KEY = process.env.DGIS_KEY || "";

/*
  TOMCHI DELIVERY RULES

  1. Адрес внутри зоны + заказ от 5000 ₸
     = доставка 0 ₸

  2. Адрес внутри зоны + заказ меньше 5000 ₸
     = доставка 500 ₸

  3. Адрес вне зоны
     = клиент самостоятельно вызывает курьера
       через Яндекс Go / inDrive.
*/

/*
  ВАЖНО:
  Координаты ниже — это настройки квадратов.

  Если после тестирования нужно увеличить,
  уменьшить или сдвинуть квадрат,
  меняются только эти значения.
*/

const DELIVERY_ZONES = [

  {
    id: "zone1",
    name: "Зона 1",

    /*
      Алматы-2 / Сейфуллина / Сатпаева / Абая

      Сейчас задаём прямоугольную область.
    */
    minLat: 43.2250,
    maxLat: 43.2550,
    minLon: 76.8750,
    maxLon: 76.9250
  },

  {
    id: "zone2",
    name: "Зона 2",

    /*
      Ташкентская / Каргалинская /
      Б. Момышулы / пр. Абая
    */
    minLat: 43.2050,
    maxLat: 43.2450,
    minLon: 76.7600,
    maxLon: 76.8500
  }

];

const DEFAULT = {

  nextOrderId: 1001,

  pickupPoints: [
    {
      address: "Алматы-2",
      radius: 0
    },
    {
      address: "Ташкентская",
      radius: 0
    }
  ],

  orders: []
};

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

const save = d =>
  fs.writeFileSync(
    DATA,
    JSON.stringify(d, null, 2)
  );

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

        resolve(
          body
            ? JSON.parse(body)
            : {}
        );

      } catch (e) {

        reject(e);

      }

    });

  });

const auth = req =>
  req.headers.authorization ===
  `Bearer ${ADMIN_TOKEN}`;


/*
  2GIS GEOCODING
*/

async function geocode(q) {

  if (!DG_KEY) {
    throw Error(
      "DGIS_KEY is not configured"
    );
  }

  const url =
    "https://catalog.api.2gis.com/3.0/items/geocode?" +
    new URLSearchParams({

      q: q + ", Алматы, Казахстан",

      fields:
        "items.point,items.full_address_name",

      page_size: "1",

      key: DG_KEY
    });

  const response =
    await fetch(url);

  if (!response.ok) {
    throw Error("Geocoder error");
  }

  const data =
    await response.json();

  const item =
    data?.result?.items?.[0];

  if (!item?.point) {
    return null;
  }

  return {

    lat: Number(item.point.lat),

    lon: Number(item.point.lon),

    address:
      item.full_address_name || q
  };
}


/*
  Проверка попадания точки
  в квадрат.
*/

function pointInsideZone(point, zone) {

  return (

    point.lat >= zone.minLat &&

    point.lat <= zone.maxLat &&

    point.lon >= zone.minLon &&

    point.lon <= zone.maxLon

  );
}


/*
  Проверка адреса доставки.
*/

async function checkZone(address) {

  const destination =
    await geocode(address);

  if (!destination) {

    return {

      found: false,

      inZone: false,

      message:
        "Не удалось найти этот адрес на карте. Уточните адрес."
    };
  }

  let matchedZone = null;

  for (const zone of DELIVERY_ZONES) {

    if (
      pointInsideZone(
        destination,
        zone
      )
    ) {

      matchedZone = zone;

      break;
    }
  }

  return {

    found: true,

    inZone: Boolean(matchedZone),

    zone:
      matchedZone?.name || null,

    coordinates: destination,

    message: matchedZone

      ? `Адрес входит в ${matchedZone.name}.`

      : "Адрес находится вне бесплатной зоны."
  };
}


/*
  HTTP SERVER
*/

const server =
  http.createServer(
    async (req, res) => {

      const url =
        new URL(
          req.url,
          `http://${req.headers.host}`
        );

      const method = req.method;

      if (method === "OPTIONS") {

        res.writeHead(204, {

          "Access-Control-Allow-Origin":
            "*",

          "Access-Control-Allow-Headers":
            "Content-Type,Authorization"

        });

        return res.end();
      }

      try {

        /*
          CONFIG
        */

        if (
          url.pathname ===
            "/api/config" &&
          method === "GET"
        ) {

          const data = read();

          return json(
            res,
            200,
            {

              pickupPoints:
                data.pickupPoints
                  .map(x => x.address),

              zones:
                DELIVERY_ZONES
                  .map(z => z.name)

            }
          );
        }


        /*
          CHECK ZONE
        */

        if (
          url.pathname ===
            "/api/check-zone" &&
          method === "POST"
        ) {

          const body =
            await getBody(req);

          return json(
            res,
            200,
            await checkZone(
              body.address
            )
          );
        }


        /*
          CREATE ORDER
        */

        if (
          url.pathname ===
            "/api/orders" &&
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

            return json(
              res,
              400,
              {
                error:
                  "Заполните обязательные поля."
              }
            );
          }


          const amount =
            Number(body.amount || 0);

          if (
            !Number.isFinite(amount) ||
            amount <= 0
          ) {

            return json(
              res,
              400,
              {
                error:
                  "Укажите корректную сумму заказа."
              }
            );
          }


          if (
            !data.pickupPoints.some(
              x =>
                x.address === body.pickup
            )
          ) {

            return json(
              res,
              400,
              {
                error:
                  "Недопустимая точка отправления."
              }
            );
          }


          const zone =
            await checkZone(
              body.address
            );


          if (!zone.found) {

            return json(
              res,
              400,
              {
                error:
                  zone.message
              }
            );
          }


          let deliveryPrice = null;
          let total = amount;


          /*
            ВНУТРИ ЗОНЫ
          */

          if (zone.inZone) {

            if (amount < 5000) {

              deliveryPrice = 500;

            } else {

              deliveryPrice = 0;
            }

            total =
              amount +
              deliveryPrice;

          }


          /*
            ВНЕ ЗОНЫ
            deliveryPrice = null,
            потому что стоимость
            стороннего курьера
            определяет сам сервис.
          */


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

            deliveryPrice,

            total:

              zone.inZone
                ? total
                : null,

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


        /*
          ADMIN: GET ORDERS
        */

        if (
          url.pathname ===
            "/api/orders" &&
          method === "GET"
        ) {

          if (!auth(req)) {

            return json(
              res,
              401,
              {
                error:
                  "Нет доступа"
              }
            );
          }

          return json(
            res,
            200,
            read().orders
          );
        }


        /*
          ADMIN: CHANGE ORDER
        */

        if (
          url.pathname.startsWith(
            "/api/orders/"
          ) &&
          method === "PATCH"
        ) {

          if (!auth(req)) {

            return json(
              res,
              401,
              {
                error:
                  "Нет доступа"
              }
            );
          }

          const id =
            Number(
              url.pathname
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

            return json(
              res,
              404,
              {
                error:
                  "Заказ не найден"
              }
            );
          }

          if (
            body.status
          ) {

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


        /*
          ADMIN: ZONE SETTINGS
        */

        if (
          url.pathname ===
            "/api/zone-settings" &&
          method === "GET"
        ) {

          if (!auth(req)) {

            return json(
              res,
              401,
              {
                error:
                  "Нет доступа"
              }
            );
          }

          return json(
            res,
            200,
            DELIVERY_ZONES
          );
        }


        /*
          STATIC FILES
        */

        let file =
          url.pathname === "/"
            ? "/index.html"
            : url.pathname;

        if (file === "/admin") {
          file = "/admin.html";
        }

        const full =
          path.normalize(
            path.join(
              PUBLIC,
              file
            )
          );

        if (
          !full.startsWith(PUBLIC)
        ) {

          return json(
            res,
            403,
            {
              error:
                "Forbidden"
            }
          );
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
                "text/css; charset=utf-8",

              ".json":
                "application/json; charset=utf-8"

            };

            res.writeHead(
              200,
              {
                "Content-Type":
                  types[ext] ||
                  "text/plain; charset=utf-8"
              }
            );

            res.end(content);
          }
        );

      } catch (error) {

        console.error(error);

        json(
          res,
          500,
          {
            error:
              error.message
          }
        );
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