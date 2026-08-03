const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PUBLIC = ROOT;
const DATA = path.join(ROOT, "data.json");

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "CHANGE_ME";
const DG_KEY = process.env.DGIS_KEY || "";

/*
====================================================
 TOMCHI — НАСТРОЙКИ ДОСТАВКИ
====================================================

5 ТОЧЕК ОТПРАВЛЕНИЯ НЕ ТРОГАЕМ.

Они используются как места, откуда забирается заказ.

ЗОНЫ ДОСТАВКИ — ОТДЕЛЬНО.
*/


/*
====================================================
 2 КВАДРАТНЫЕ ЗОНЫ
====================================================

ВАЖНО:
координаты можно потом подкорректировать,
если понадобится сделать квадрат больше/меньше.

Зона 1:
Алматы-2 / Сейфуллина / Сатпаева / Абая

Зона 2:
Ташкентская / Каргалинская / Б. Момышулы / Абая
*/

const DELIVERY_ZONES = [

  {
    id: "zone1",
    name: "Зона 1",

    minLat: 43.2350,
    maxLat: 43.2750,

    minLon: 76.9000,
    maxLon: 76.9550
  },

  {
    id: "zone2",
    name: "Зона 2",

    minLat: 43.2000,
    maxLat: 43.2350,

    minLon: 76.7200,
    maxLon: 76.8400
  }

];


/*
====================================================
 ОСНОВНЫЕ ПРАВИЛА
====================================================

В зоне + заказ >= 5000 ₸
→ доставка 0 ₸

В зоне + заказ < 5000 ₸
→ доставка 500 ₸

Вне зоны
→ стоимость доставки здесь не рассчитываем.
Клиент самостоятельно вызывает Яндекс Go / inDrive.
*/

const FREE_DELIVERY_MINIMUM = 5000;
const SMALL_ORDER_DELIVERY = 500;


/*
====================================================
 5 ТОЧЕК ОТПРАВЛЕНИЯ
====================================================
*/

const DEFAULT = {

  nextOrderId: 1001,

  pickupPoints: [

    {
      address: "Абылай Хана 24",
      radius: 1500
    },

    {
      address: "Абылай Хана 34",
      radius: 1500
    },

    {
      address: "Жибек Жолы 106",
      radius: 1500
    },

    {
      address: "Яссауи 66а",
      radius: 1500
    },

    {
      address: "Абай 47",
      radius: 1500
    }

  ],

  orders: []

};


/*
====================================================
 СОЗДАЁМ data.json ТОЛЬКО ЕСЛИ ЕГО НЕТ
====================================================
*/

if (!fs.existsSync(DATA)) {

  fs.writeFileSync(
    DATA,
    JSON.stringify(DEFAULT, null, 2)
  );

}


/*
====================================================
 DATA HELPERS
====================================================
*/

const read = () => {

  return JSON.parse(
    fs.readFileSync(DATA, "utf8")
  );

};


const save = data => {

  fs.writeFileSync(
    DATA,
    JSON.stringify(data, null, 2)
  );

};


/*
====================================================
 JSON RESPONSE
====================================================
*/

const json = (res, code, data) => {

  res.writeHead(code, {

    "Content-Type":
      "application/json; charset=utf-8",

    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Headers":
      "Content-Type,Authorization"

  });

  res.end(
    JSON.stringify(data)
  );

};


/*
====================================================
 BODY
====================================================
*/

const getBody = req =>

  new Promise((resolve, reject) => {

    let body = "";

    req.on(
      "data",
      chunk => {
        body += chunk;
      }
    );

    req.on(
      "end",
      () => {

        try {

          resolve(
            body
              ? JSON.parse(body)
              : {}
          );

        } catch (error) {

          reject(error);

        }

      }
    );

  });


/*
====================================================
 ADMIN AUTH
====================================================
*/

const auth = req => {

  return (
    req.headers.authorization ===
    `Bearer ${ADMIN_TOKEN}`
  );

};


/*
====================================================
 2GIS GEOCODING
====================================================
*/

async function geocode(query) {

  if (!DG_KEY) {

    throw Error(
      "DGIS_KEY is not configured"
    );

  }


  const url =
    "https://catalog.api.2gis.com/3.0/items/geocode?" +

    new URLSearchParams({

      q:
        query +
        ", Алматы, Казахстан",

      fields:
        "items.point,items.full_address_name",

      page_size:
        "1",

      key:
        DG_KEY

    });


  const response =
    await fetch(url);


  if (!response.ok) {

    throw Error(
      "Geocoder error"
    );

  }


  const data =
    await response.json();


  const item =
    data?.result?.items?.[0];


  if (!item?.point) {

    return null;

  }


  return {

    lat:
      Number(item.point.lat),

    lon:
      Number(item.point.lon),

    address:
      item.full_address_name ||
      query

  };

}


/*
====================================================
 ПРОВЕРКА: ПОПАЛА ЛИ ТОЧКА В КВАДРАТ
====================================================
*/

function pointInsideZone(
  point,
  zone
) {

  return (

    point.lat >= zone.minLat &&

    point.lat <= zone.maxLat &&

    point.lon >= zone.minLon &&

    point.lon <= zone.maxLon

  );

}


/*
====================================================
 ОПРЕДЕЛЕНИЕ ЗОНЫ
====================================================
*/

function findDeliveryZone(
  coordinates
) {

  for (
    const zone
    of DELIVERY_ZONES
  ) {

    if (
      pointInsideZone(
        coordinates,
        zone
      )
    ) {

      return zone;

    }

  }


  return null;

}


/*
====================================================
 ПРОВЕРКА АДРЕСА
====================================================
*/

async function checkZone(
  address,
  data
) {

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


  const matchedZone =
    findDeliveryZone(
      destination
    );


  /*
  ================================================
  АДРЕС В ОДНОЙ ИЗ 2 ЗОН
  ================================================
  */

  if (matchedZone) {

    return {

      found: true,

      inZone: true,

      zone:
        matchedZone.name,

      coordinates:
        destination,

      message:
        `Адрес входит в ${matchedZone.name}.`

    };

  }


  /*
  ================================================
  АДРЕС ВНЕ ЗОН
  ================================================
  */

  return {

    found: true,

    inZone: false,

    zone: null,

    coordinates:
      destination,

    message:
      "Адрес находится вне бесплатной зоны."

  };

}


/*
====================================================
 HTTP SERVER
====================================================
*/

const server =
  http.createServer(
    async (req, res) => {

      const url =
        new URL(
          req.url,
          `http://${req.headers.host}`
        );

      const method =
        req.method;


      /*
      ==============================================
      OPTIONS
      ==============================================
      */

      if (
        method === "OPTIONS"
      ) {

        res.writeHead(
          204,
          {

            "Access-Control-Allow-Origin":
              "*",

            "Access-Control-Allow-Headers":
              "Content-Type,Authorization"

          }
        );

        return res.end();

      }


      try {


        /*
        ==========================================
        CONFIG
        ==========================================
        */

        if (
          url.pathname ===
            "/api/config" &&
          method === "GET"
        ) {

          const data =
            read();


          return json(
            res,
            200,
            {

              pickupPoints:
                data.pickupPoints
                  .map(
                    x => x.address
                  ),

              zones:
                DELIVERY_ZONES
                  .map(
                    x => x.name
                  )

            }
          );

        }


        /*
        ==========================================
        CHECK ZONE
        ==========================================
        */

        if (
          url.pathname ===
            "/api/check-zone" &&
          method === "POST"
        ) {

          const body =
            await getBody(req);


          if (
            !body.address
          ) {

            return json(
              res,
              400,
              {

                found: false,

                inZone: false,

                message:
                  "Введите адрес доставки."

              }
            );

          }


          const data =
            read();


          const result =
            await checkZone(
              body.address,
              data
            );


          return json(
            res,
            200,
            result
          );

        }


        /*
        ==========================================
        CREATE ORDER
        ==========================================
        */

        if (
          url.pathname ===
            "/api/orders" &&
          method === "POST"
        ) {

          const body =
            await getBody(req);


          const data =
            read();


          /*
          обязательные поля
          */

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


          /*
          сумма заказа
          */

          const amount =
            Number(
              body.amount || 0
            );


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


          /*
          проверяем точку отправления
          */

          if (
            !data.pickupPoints.some(
              x =>
                x.address ===
                body.pickup
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


          /*
          проверяем адрес
          */

          const zone =
            await checkZone(
              body.address,
              data
            );


          if (
            !zone.found
          ) {

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

          let total = null;


          /*
          ========================================
          АДРЕС В ЗОНЕ
          ========================================
          */

          if (
            zone.inZone
          ) {

            if (
              amount >=
              FREE_DELIVERY_MINIMUM
            ) {

              deliveryPrice =
                0;

            } else {

              deliveryPrice =
                SMALL_ORDER_DELIVERY;

            }


            total =
              amount +
              deliveryPrice;

          }


          /*
          ========================================
          ВНЕ ЗОНЫ
          ========================================

          deliveryPrice = null

          потому что стоимость
          Яндекс / inDrive определяет
          отдельно.
          */


          const order = {

            id:
              data.nextOrderId++,

            createdAt:
              new Date()
                .toISOString(),

            name:
              String(
                body.name
              ),

            phone:
              String(
                body.phone
              ),

            pickup:
              String(
                body.pickup
              ),

            address:
              String(
                body.address
              ),

            amount:

              amount,

            item:
              String(
                body.item || ""
              ),

            comment:
              String(
                body.comment || ""
              ),


            /*
            зона
            */

            inZone:
              zone.inZone,

            zone:
              zone.zone || null,


            /*
            доставка
            */

            deliveryPrice:
              deliveryPrice,


            /*
            итог
            */

            total:
              total,


            /*
            координаты
            */

            coordinates:
              zone.coordinates,


            status:
              "Новый"

          };


          data.orders.unshift(
            order
          );


          save(data);


          return json(
            res,
            201,
            order
          );

        }


        /*
        ==========================================
        ADMIN — GET ORDERS
        ==========================================
        */

        if (
          url.pathname ===
            "/api/orders" &&
          method === "GET"
        ) {

          if (
            !auth(req)
          ) {

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
        ==========================================
        ADMIN — CHANGE ORDER
        ==========================================
        */

        if (
          url.pathname.startsWith(
            "/api/orders/"
          ) &&
          method === "PATCH"
        ) {

          if (
            !auth(req)
          ) {

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


          const data =
            read();


          const order =
            data.orders.find(
              x =>
                x.id === id
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
            "deliveryPrice"
            in body
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
        ==========================================
        ADMIN — ZONE SETTINGS
        ==========================================
        */

        if (
          url.pathname ===
            "/api/zone-settings" &&
          method === "GET"
        ) {

          if (
            !auth(req)
          ) {

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
            {

              pickupPoints:
                read().pickupPoints,

              deliveryZones:
                DELIVERY_ZONES

            }
          );

        }


        /*
        ==========================================
        STATIC FILES
        ==========================================
        */

        let file =
          url.pathname === "/"
            ? "/index.html"
            : url.pathname;


        if (
          file === "/admin"
        ) {

          file =
            "/admin.html";

        }


        const full =
          path.normalize(
            path.join(
              PUBLIC,
              file
            )
          );


        if (
          !full.startsWith(
            PUBLIC
          )
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

              res.writeHead(
                404
              );

              return res.end(
                "Not found"
              );

            }


            const ext =
              path.extname(
                full
              );


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


            res.end(
              content
            );

          }
        );


      } catch (error) {

        console.error(
          error
        );


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