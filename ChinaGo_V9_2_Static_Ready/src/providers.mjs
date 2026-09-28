function cleanUrl(url){ return String(url||"").replace(/\/$/,""); }
function configured(name){ return Boolean(process.env[name]); }
function env(name, fallback=""){ return process.env[name] ?? fallback; }

export function providerStatus() {
  return {
    hotels: configured("HOTEL_PROVIDER_URL"),
    trains: configured("TRAIN_PROVIDER_URL"),
    tickets: configured("TICKET_PROVIDER_URL"),
    transfers: configured("TRANSFER_PROVIDER_URL"),
    experiences: configured("EXPERIENCE_PROVIDER_URL"),
    booking_com: Boolean(process.env.BOOKING_COM_API_KEY && process.env.BOOKING_COM_AFFILIATE_ID),
    maps: configured("MAP_PROVIDER_URL")
  };
}

export function providerConfig(){
  const names=["HOTEL","TRAIN","TICKET","TRANSFER","EXPERIENCE"];
  return Object.fromEntries(names.map(n=>[n.toLowerCase(),{configured:configured(`${n}_PROVIDER_URL`),url:cleanUrl(env(`${n}_PROVIDER_URL`)),affiliate:env(`${n}_AFFILIATE_ID`),commission:env(`${n}_COMMISSION_TYPE`,`lead`)}]));
}

function normalizeItem(item, category, provider){
  const x=item||{};
  return {
    id:String(x.id||x.code||`${provider}-${category}-${Math.random().toString(36).slice(2,9)}`),
    category, provider, title:String(x.title||x.name||"Untitled"),
    location:String(x.location||x.city||""),
    description:String(x.description||x.summary||""),
    price_from:x.price_from ?? x.price ?? null, currency:String(x.currency||"CNY"),
    booking_url:String(x.booking_url||x.url||""),
    deep_link:String(x.deep_link||x.booking_url||x.url||""),
    raw:x
  };
}

async function requestProvider(envPrefix, path, payload={}) {
  const base=cleanUrl(process.env[`${envPrefix}_PROVIDER_URL`]);
  if(!base) return {configured:false,items:[],provider:envPrefix.toLowerCase(),message:`${envPrefix.toLowerCase()} provider not configured.`};
  const url=`${base}${path.startsWith("/")?"":"/"}${path}`;
  const headers={"content-type":"application/json",accept:"application/json","x-chinago-client":"chinago-v6"};
  const token=process.env[`${envPrefix}_PROVIDER_TOKEN`];
  if(token) headers.authorization=`Bearer ${token}`;
  const affiliate=process.env[`${envPrefix}_AFFILIATE_ID`];
  if(affiliate) headers["x-affiliate-id"]=affiliate;
  try {
    const r=await fetch(url,{method:"POST",headers,body:JSON.stringify({...payload,chinago:{affiliate_id:affiliate||null,locale:"en",version:"6"}})});
    const text=await r.text(); let data; try{data=JSON.parse(text)}catch{data={raw:text}}
    const list=Array.isArray(data?.items)?data.items:(Array.isArray(data)?data:[]);
    if(!r.ok) return {configured:true,items:[],provider:envPrefix.toLowerCase(),error:`Provider returned ${r.status}`,provider_status:r.status,details:data};
    return {configured:true,items:list.map(x=>normalizeItem(x,envPrefix.toLowerCase(),envPrefix.toLowerCase())),data,provider_status:r.status};
  } catch(e){ return {configured:true,items:[],provider:envPrefix.toLowerCase(),error:e.message||"Provider request failed"}; }
}
export const searchHotels=q=>requestProvider("HOTEL","/search",q);
export const searchTrains=q=>requestProvider("TRAIN","/search",q);
export const searchTickets=q=>requestProvider("TICKET","/search",q);
export const searchTransfers=q=>requestProvider("TRANSFER","/search",q);
export const searchExperiences=q=>requestProvider("EXPERIENCE","/search",q);

export async function healthProvider(envPrefix){
  const base=cleanUrl(process.env[`${envPrefix}_PROVIDER_URL`]);
  if(!base) return {configured:false,ok:false,provider:envPrefix.toLowerCase()};
  try{
    const r=await fetch(`${base}/health`,{method:"GET",headers:{accept:"application/json"}});
    return {configured:true,ok:r.ok,status:r.status,provider:envPrefix.toLowerCase()};
  }catch(e){return {configured:true,ok:false,provider:envPrefix.toLowerCase(),error:e.message};}
}

// V7 real supplier adapter: Booking.com Demand API 3.2 (Search & Redirect).
// Credentials stay server-side. Requires BOOKING_COM_API_KEY and BOOKING_COM_AFFILIATE_ID.
export function bookingComConfig(){
  return {
    configured:Boolean(process.env.BOOKING_COM_API_KEY && process.env.BOOKING_COM_AFFILIATE_ID),
    apiBase: cleanUrl(process.env.BOOKING_COM_API_BASE || "https://demandapi.booking.com/3.2"),
    affiliateId: process.env.BOOKING_COM_AFFILIATE_ID || "",
    flow:"search-look-redirect"
  };
}

function bookingPayload(q={}){
  const adults=Number(q.adults ?? q.number_of_adults ?? 2);
  const rooms=Number(q.rooms ?? q.number_of_rooms ?? 1);
  const country=String(q.booker_country || q.country || "").toLowerCase();
  const payload={
    booker:{country:country || "gb", platform:q.platform || "mobile"},
    checkin:String(q.checkin || ""),
    checkout:String(q.checkout || ""),
    guests:{number_of_adults:adults, number_of_rooms:rooms}
  };
  if(q.city_id!=null) payload.city=Number(q.city_id);
  else if(q.country_code) payload.country=String(q.country_code).toLowerCase();
  else if(q.region_id!=null) payload.region=Number(q.region_id);
  else if(q.airport) payload.airport=String(q.airport).toUpperCase();
  else if(q.landmark_id!=null) payload.landmark=Number(q.landmark_id);
  else if(q.latitude!=null && q.longitude!=null) payload.coordinates={latitude:Number(q.latitude),longitude:Number(q.longitude),radius:Number(q.radius||10)};
  if(q.currency) payload.currency=String(q.currency).toUpperCase();
  payload.extras=["products","extra_charges"];
  if(q.rows) payload.rows=Math.min(100,Math.max(10,Math.floor(Number(q.rows)/10)*10));
  if(q.sort_by) payload.sort={by:String(q.sort_by),direction:String(q.sort_direction||"ascending")};
  if(q.free_cancellation) { payload.filters={...(payload.filters||{}),cancellation_type:"free_cancellation"}; }
  if(q.min_price!=null || q.max_price!=null){
    payload.filters={price:{}};
    if(q.min_price!=null) payload.filters.price.minimum=Number(q.min_price);
    if(q.max_price!=null) payload.filters.price.maximum=Number(q.max_price);
  }
  return payload;
}

function normalizeBookingHotel(item){
  const p=item?.price || {};
  const currency=typeof item?.currency === "string" ? item.currency : (item?.currency?.booker || item?.currency?.accommodation || "CNY");
  const amount=p.display ?? p.book ?? p.total ?? p.base ?? null;
  const url=typeof item?.url === "string" ? item.url : (item?.url?.web || "");
  return {
    id:String(item?.id||""), category:"hotel", provider:"booking_com",
    title:String(item?.name||item?.hotel_name||`Accommodation ${item?.id||""}`),
    location:String(item?.location?.city || item?.address?.city || ""),
    description:String(item?.description||""),
    price_from:amount, currency, booking_url:url, deep_link:String(item?.deep_link_url||item?.url?.app||url),
    rating:item?.review_score ?? item?.review?.score ?? null,
    raw:item
  };
}

export async function searchBookingComHotels(q={}){
  const key=process.env.BOOKING_COM_API_KEY;
  const affiliate=process.env.BOOKING_COM_AFFILIATE_ID;
  if(!key || !affiliate) return {configured:false,items:[],provider:"booking_com",message:"Booking.com Demand API is not configured."};
  const base=cleanUrl(process.env.BOOKING_COM_API_BASE || "https://demandapi.booking.com/3.2");
  const payload=bookingPayload(q);
  const required=["checkin","checkout"];
  const missing=required.filter(k=>!payload[k]);
  if(!payload.city && !payload.country && !payload.region && !payload.airport && !payload.landmark && !payload.coordinates) missing.push("location");
  if(missing.length) return {configured:true,items:[],provider:"booking_com",error:`Missing required search fields: ${missing.join(", ")}`};
  try{
    const r=await fetch(`${base}/accommodations/search`,{
      method:"POST",
      headers:{Authorization:`Bearer ${key}`,"X-Affiliate-Id":String(affiliate),"Content-Type":"application/json",Accept:"application/json","x-chinago-client":"chinago-v7"},
      body:JSON.stringify(payload)
    });
    const text=await r.text(); let data; try{data=JSON.parse(text)}catch{data={raw:text}};
    if(!r.ok) return {configured:true,items:[],provider:"booking_com",error:`Booking.com returned ${r.status}`,provider_status:r.status,details:data};
    const rows=Array.isArray(data?.data)?data.data:[];
    return {configured:true,provider:"booking_com",provider_status:r.status,items:rows.map(normalizeBookingHotel),metadata:data?.metadata||{},request_id:data?.request_id||null,raw:data};
  }catch(e){return {configured:true,items:[],provider:"booking_com",error:e.message||"Booking.com request failed"};}
}

export async function healthBookingCom(){
  const cfg=bookingComConfig();
  if(!cfg.configured) return {provider:"booking_com",configured:false,ok:false};
  try{
    const r=await fetch(`${cfg.apiBase}/common/locations/countries`,{method:"POST",headers:{Authorization:`Bearer ${process.env.BOOKING_COM_API_KEY}`,"X-Affiliate-Id":String(process.env.BOOKING_COM_AFFILIATE_ID),"Content-Type":"application/json"},body:JSON.stringify({})});
    return {provider:"booking_com",configured:true,ok:r.ok,status:r.status};
  }catch(e){return {provider:"booking_com",configured:true,ok:false,error:e.message};}
}


// V8: Booking.com Demand API 3.2 conversion helpers.
export async function searchBookingComSmartHotels(q={}){
  const key=process.env.BOOKING_COM_API_KEY, affiliate=process.env.BOOKING_COM_AFFILIATE_ID;
  if(!key || !affiliate) return {configured:false,items:[],provider:"booking_com",message:"Booking.com Demand API is not configured."};
  const base=cleanUrl(process.env.BOOKING_COM_API_BASE || "https://demandapi.booking.com/3.2");
  const payload=bookingPayload(q);
  const text=String(q.search_query||q.query||"").trim();
  if(text.length<3) return {configured:true,items:[],provider:"booking_com",error:"search_query must be at least 3 characters"};
  payload.search_query=text;
  delete payload.extras;
  if(q.rows) payload.rows=Math.min(100,Math.max(10,Math.floor(Number(q.rows)/10)*10));
  try{
    const r=await fetch(`${base}/accommodations/smart-search`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"X-Affiliate-Id":String(affiliate),"Content-Type":"application/json",Accept:"application/json","x-chinago-client":"chinago-v8"},body:JSON.stringify(payload)});
    const raw=await r.text(); let data; try{data=JSON.parse(raw)}catch{data={raw}};
    if(!r.ok) return {configured:true,items:[],provider:"booking_com",error:`Booking.com returned ${r.status}`,provider_status:r.status,details:data};
    const rows=Array.isArray(data?.data)?data.data:[];
    return {configured:true,provider:"booking_com",provider_status:r.status,items:rows.map(normalizeBookingHotel),metadata:data?.metadata||{},request_id:data?.request_id||null,raw:data};
  }catch(e){return {configured:true,items:[],provider:"booking_com",error:e.message||"Booking.com smart search failed"};}
}

export async function getBookingComAvailability(q={}){
  const key=process.env.BOOKING_COM_API_KEY, affiliate=process.env.BOOKING_COM_AFFILIATE_ID;
  if(!key || !affiliate) return {configured:false,provider:"booking_com",message:"Booking.com Demand API is not configured."};
  const ids=Array.isArray(q.accommodations)?q.accommodations.map(Number).filter(Number.isFinite):[Number(q.accommodation_id)].filter(Number.isFinite);
  if(!ids.length || !q.checkin || !q.checkout) return {configured:true,provider:"booking_com",error:"accommodation_id(s), checkin and checkout are required"};
  const payload={booker:{country:String(q.booker_country||q.country||"gb").toLowerCase(),platform:q.platform||"mobile"},checkin:String(q.checkin),checkout:String(q.checkout),accommodations:ids,guests:{number_of_adults:Number(q.adults||2),number_of_rooms:Number(q.rooms||1)}};
  if(q.currency) payload.currency=String(q.currency).toUpperCase();
  try{
    const r=await fetch(`${cleanUrl(process.env.BOOKING_COM_API_BASE || "https://demandapi.booking.com/3.2")}/accommodations/availability`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"X-Affiliate-Id":String(affiliate),"Content-Type":"application/json",Accept:"application/json","x-chinago-client":"chinago-v8"},body:JSON.stringify(payload)});
    const raw=await r.text(); let data; try{data=JSON.parse(raw)}catch{data={raw}};
    if(!r.ok) return {configured:true,provider:"booking_com",error:`Booking.com returned ${r.status}`,provider_status:r.status,details:data};
    return {configured:true,provider:"booking_com",provider_status:r.status,data:Array.isArray(data?.data)?data.data:[],request_id:data?.request_id||null};
  }catch(e){return {configured:true,provider:"booking_com",error:e.message||"Booking.com availability failed"};}
}


// V9: Booking.com destination autocomplete (Beta) and accommodation details (stable v3.2).
export async function bookingComAutocomplete(q={}){
  const key=process.env.BOOKING_COM_API_KEY, affiliate=process.env.BOOKING_COM_AFFILIATE_ID;
  if(!key || !affiliate) return {configured:false,items:[],provider:"booking_com",message:"Booking.com Demand API is not configured."};
  const query=String(q.query||"").trim();
  if(query.length<3) return {configured:true,items:[],provider:"booking_com",error:"query must be at least 3 characters"};
  const payload={query,country:String(q.country||"cn").toLowerCase(),language:String(q.language||"en-gb")};
  if(q.types?.length) payload.filters={types:q.types}; else payload.filters={types:["city"]};
  try{
    const r=await fetch(`${cleanUrl(process.env.BOOKING_COM_API_BASE || "https://demandapi.booking.com/3.2")}/common/autocomplete`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"X-Affiliate-Id":String(affiliate),"Content-Type":"application/json",Accept:"application/json","x-chinago-client":"chinago-v9"},body:JSON.stringify(payload)});
    const raw=await r.text(); let data; try{data=JSON.parse(raw)}catch{data={raw}};
    if(!r.ok) return {configured:true,items:[],provider:"booking_com",error:`Booking.com returned ${r.status}`,provider_status:r.status,details:data};
    const rows=Array.isArray(data?.data)?data.data:[];
    return {configured:true,provider:"booking_com",provider_status:r.status,items:rows.map(x=>({id:String(x?.id||x?.location?.city||""),type:String(x?.type||""),name:typeof x?.name==="string"?x.name:(x?.name?.[payload.language]||Object.values(x?.name||{})[0]||""),city_id:x?.location?.city??x?.id??null,city_name:typeof x?.location?.city_name==="string"?x.location.city_name:(x?.location?.city_name?.[payload.language]||Object.values(x?.location?.city_name||{})[0]||""),country:x?.location?.country||"",country_name:typeof x?.location?.country_name==="string"?x.location.country_name:(x?.location?.country_name?.[payload.language]||Object.values(x?.location?.country_name||{})[0]||""),coordinates:x?.location?.coordinates||null,raw:x})),request_id:data?.request_id||null};
  }catch(e){return {configured:true,items:[],provider:"booking_com",error:e.message||"Booking.com autocomplete failed"};}
}

export async function getBookingComHotelDetails(q={}){
  const key=process.env.BOOKING_COM_API_KEY, affiliate=process.env.BOOKING_COM_AFFILIATE_ID;
  if(!key || !affiliate) return {configured:false,provider:"booking_com",message:"Booking.com Demand API is not configured."};
  const ids=Array.isArray(q.accommodations)?q.accommodations.map(Number).filter(Number.isFinite):[Number(q.accommodation_id)].filter(Number.isFinite);
  if(!ids.length) return {configured:true,provider:"booking_com",error:"accommodation_id(s) required"};
  const payload={accommodations:ids,languages:[String(q.language||"en-gb")],extras:["description","facilities","payment","photos","policies","rooms","refuses_free_cancellation_requests"]};
  try{
    const r=await fetch(`${cleanUrl(process.env.BOOKING_COM_API_BASE || "https://demandapi.booking.com/3.2")}/accommodations/details`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"X-Affiliate-Id":String(affiliate),"Content-Type":"application/json",Accept:"application/json","x-chinago-client":"chinago-v9"},body:JSON.stringify(payload)});
    const raw=await r.text(); let data; try{data=JSON.parse(raw)}catch{data={raw}};
    if(!r.ok) return {configured:true,provider:"booking_com",error:`Booking.com returned ${r.status}`,provider_status:r.status,details:data};
    return {configured:true,provider:"booking_com",provider_status:r.status,data:Array.isArray(data?.data)?data.data:[],metadata:data?.metadata||{},request_id:data?.request_id||null};
  }catch(e){return {configured:true,provider:"booking_com",error:e.message||"Booking.com details failed"};}
}
