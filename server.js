const http=require("http"),fs=require("fs"),path=require("path"),{URL}=require("url");
const ROOT=__dirname,PUBLIC=path.join(ROOT,"public"),DATA=path.join(ROOT,"data.json");
const PORT=process.env.PORT||3000, ADMIN_TOKEN=process.env.ADMIN_TOKEN||"CHANGE_ME";
const DG_KEY=process.env.DGIS_KEY||"";
const DEFAULT={
 nextOrderId:1001,
 pickupPoints:[
  {address:"Абылай Хана 24",radius:1500},
  {address:"Абылай Хана 34",radius:1500},
  {address:"Жибек Жолы 106",radius:1500},
  {address:"Яссауи 66а",radius:1500},
  {address:"Абай 47",radius:1500}
 ],
 orders:[]
};
if(!fs.existsSync(DATA))fs.writeFileSync(DATA,JSON.stringify(DEFAULT,null,2));
const read=()=>JSON.parse(fs.readFileSync(DATA,"utf8")),save=d=>fs.writeFileSync(DATA,JSON.stringify(d,null,2));
const json=(res,c,x)=>{res.writeHead(c,{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type,Authorization"});res.end(JSON.stringify(x))};
const getBody=req=>new Promise((ok,no)=>{let s="";req.on("data",c=>s+=c);req.on("end",()=>{try{ok(s?JSON.parse(s):{})}catch(e){no(e)}})});
const auth=req=>req.headers.authorization===`Bearer ${ADMIN_TOKEN}`;
function dist(a,b){const R=6371000,p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLon=(b.lon-a.lon)*p;
 const x=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;
 return 2*R*Math.asin(Math.sqrt(x));
}
async function geocode(q){
 if(!DG_KEY) throw Error("DGIS_KEY is not configured");
 const u="https://catalog.api.2gis.com/3.0/items/geocode?"+new URLSearchParams({
  q:q+", Алматы, Казахстан",fields:"items.point,items.full_address_name",page_size:"1",key:DG_KEY
 });
 const r=await fetch(u); if(!r.ok)throw Error("Geocoder error");
 const j=await r.json(),it=j?.result?.items?.[0];
 if(!it?.point) return null;
 return {lat:Number(it.point.lat),lon:Number(it.point.lon),address:it.full_address_name||q};
}
async function checkZone(address,d){
 const dest=await geocode(address);
 if(!dest)return {found:false,free:false,message:"Не удалось найти этот адрес на карте. Уточните адрес."};
 let best=null;
 for(const p of d.pickupPoints){
  const origin=await geocode(p.address);
  if(!origin)continue;
  const meters=dist(origin,dest);
  if(!best||meters<best.distance)best={pickup:p.address,distance:Math.round(meters),radius:p.radius};
 }
 if(!best)return {found:true,free:false,message:"Не удалось определить зону доставки."};
 const free=best.distance<=best.radius;
 return {found:true,free,distance:best.distance,radius:best.radius,pickup:best.pickup,coordinates:dest,
  message:free?"Ваш адрес входит в бесплатную зону доставки. Стоимость: 0 ₸.":"Ваш адрес не входит в бесплатную зону доставки."};
}
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,`http://${req.headers.host}`),m=req.method;
 if(m==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type,Authorization"});return res.end()}
 try{
  if(u.pathname==="/api/config"&&m==="GET"){const d=read();return json(res,200,{pickupPoints:d.pickupPoints.map(x=>x.address)})}
  if(u.pathname==="/api/check-zone"&&m==="POST"){const b=await getBody(req),d=read();return json(res,200,await checkZone(b.address,d))}
  if(u.pathname==="/api/orders"&&m==="POST"){
   const b=await getBody(req),d=read();
   if(!b.name||!b.phone||!b.pickup||!b.address)return json(res,400,{error:"Заполните обязательные поля"});
   if(!d.pickupPoints.some(x=>x.address===b.pickup))return json(res,400,{error:"Недопустимая точка отправления"});
   const z=await checkZone(b.address,d);
   if(!z.found)return json(res,400,{error:z.message});
   const o={id:d.nextOrderId++,createdAt:new Date().toISOString(),name:b.name,phone:b.phone,pickup:b.pickup,address:b.address,item:b.item||"",comment:b.comment||"",free:z.free,distance:z.distance,radius:z.radius,deliveryPrice:z.free?0:null,status:"Новый"};
   d.orders.unshift(o);save(d);return json(res,201,o);
  }
  if(u.pathname==="/api/orders"&&m==="GET"){if(!auth(req))return json(res,401,{error:"Нет доступа"});return json(res,200,read().orders)}
  if(u.pathname.startsWith("/api/orders/")&&m==="PATCH"){if(!auth(req))return json(res,401,{error:"Нет доступа"});const id=+u.pathname.split("/").pop(),b=await getBody(req),d=read(),o=d.orders.find(x=>x.id===id);if(!o)return json(res,404,{error:"Не найдено"});if(b.status)o.status=b.status;if("deliveryPrice"in b)o.deliveryPrice=b.deliveryPrice;save(d);return json(res,200,o)}
  if(u.pathname==="/api/zone-settings"&&m==="GET"){if(!auth(req))return json(res,401,{error:"Нет доступа"});return json(res,200,read().pickupPoints)}
  if(u.pathname==="/api/zone-settings"&&m==="PUT"){if(!auth(req))return json(res,401,{error:"Нет доступа"});const b=await getBody(req),d=read();if(!Array.isArray(b.pickupPoints))return json(res,400,{error:"Неверные данные"});d.pickupPoints=b.pickupPoints.map(x=>({address:String(x.address),radius:Math.max(0,Number(x.radius)||0)}));save(d);return json(res,200,d.pickupPoints)}
  let file=u.pathname==="/"?"/index.html":u.pathname;if(file==="/admin")file="/admin.html";
  const full=path.normalize(path.join(PUBLIC,file));if(!full.startsWith(PUBLIC))return json(res,403,{error:"Forbidden"});
  fs.readFile(full,(e,data)=>{if(e){res.writeHead(404);return res.end("Not found")}const ext=path.extname(full),types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"};res.writeHead(200,{"Content-Type":types[ext]||"text/plain; charset=utf-8"});res.end(data)})
 }catch(e){json(res,500,{error:e.message})}
});
server.listen(PORT,()=>console.log(`Jet Delivery: http://localhost:${PORT}`));
