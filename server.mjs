import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { providerStatus, providerConfig, healthProvider, searchHotels, searchTrains, searchTickets, searchTransfers, searchExperiences, bookingComConfig, searchBookingComHotels, searchBookingComSmartHotels, getBookingComAvailability, bookingComAutocomplete, getBookingComHotelDetails, healthBookingCom } from "./src/providers.mjs";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const aiModel = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const publicSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  : null;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
const rateBuckets = new Map();
function rateLimit(max=30, windowMs=60000) {
  return (req,res,next)=>{
    const key=(req.ip||"unknown")+":"+req.path;
    const now=Date.now();
    const b=rateBuckets.get(key);
    if(!b || now-b.start>windowMs){ rateBuckets.set(key,{start:now,count:1}); return next(); }
    b.count++;
    if(b.count>max) return res.status(429).json({error:"Too many requests. Please try again shortly."});
    next();
  };
}
app.use("/api/plan", rateLimit(12));
app.use("/api/chat", rateLimit(30));
app.use("/api/live-search", rateLimit(20));
app.use("/api/providers", rateLimit(30));
app.use("/api/booking", rateLimit(20));
app.use("/api/orders", rateLimit(20));
app.use("/api/v7", rateLimit(20));
app.use("/api/v8", rateLimit(30));
app.use("/api/v9", rateLimit(40));

app.use(express.static("public"));

const citiesFallback = [
  {slug:"beijing",name_en:"Beijing",name_zh:"北京",tagline:"Imperial history, modern China",tags:["history","food","first-trip"]},
  {slug:"xian",name_en:"Xi'an",name_zh:"西安",tagline:"Terracotta Warriors & Silk Road history",tags:["history","food","culture"]},
  {slug:"luoyang",name_en:"Luoyang",name_zh:"洛阳",tagline:"Grottoes, temples & ancient capitals",tags:["history","culture","food"]},
  {slug:"dengfeng",name_en:"Dengfeng",name_zh:"登封",tagline:"Shaolin & Chinese martial arts",tags:["kung-fu","culture","nature"]},
  {slug:"kaifeng",name_en:"Kaifeng",name_zh:"开封",tagline:"Song culture & night food",tags:["history","food"]},
  {slug:"zhengzhou",name_en:"Zhengzhou",name_zh:"郑州",tagline:"Gateway to Henan",tags:["gateway","food"]}
];

const survival = [
  {icon:"💳",title:"Paying in China",body:"Alipay and WeChat Pay are the two apps you should learn first. Link a supported international card before your trip and keep a backup payment method."},
  {icon:"🚄",title:"High-speed rail",body:"China's high-speed rail network is extensive. Keep your passport details consistent across your booking and travel documents."},
  {icon:"🚕",title:"Getting around",body:"Use official ride-hailing, taxi or metro options. Keep your destination in Chinese characters ready for drivers."},
  {icon:"🍜",title:"Ordering food",body:"Use photo menus or a translation tool. ChinaGo focuses on explaining dishes, spice level, ingredients and ordering phrases."},
  {icon:"📶",title:"Connectivity",body:"Check eSIM/roaming availability before departure. Some international services may be inaccessible from mainland China."},
  {icon:"🗣️",title:"Useful Chinese",body:"A few phrases go a long way: 你好 (hello), 谢谢 (thank you), 多少钱 (how much), 不辣 (not spicy)."}
];

const itinerarySchema = {
  type:"object",
  additionalProperties:false,
  properties:{
    title:{type:"string"},
    summary:{type:"string"},
    estimated_budget:{type:"string"},
    practical_notes:{type:"array",items:{type:"string"}},
    days:{
      type:"array",
      items:{
        type:"object",additionalProperties:false,
        properties:{
          day:{type:"integer"},city:{type:"string"},morning:{type:"string"},
          lunch:{type:"string"},afternoon:{type:"string"},evening:{type:"string"},
          transport:{type:"string"},tips:{type:"array",items:{type:"string"}}
        },
        required:["day","city","morning","lunch","afternoon","evening","transport","tips"]
      }
    }
  },
  required:["title","summary","estimated_budget","practical_notes","days"]
};


async function getUserFromBearer(req) {
  if (!publicSupabase) return null;
  const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!token) return null;
  const {data:{user},error}=await publicSupabase.auth.getUser(token);
  return error ? null : user;
}

function requireAI(res) {
  if (!openai) {
    res.status(503).json({error:"AI is not configured. Add OPENAI_API_KEY to .env.", code:"AI_NOT_CONFIGURED"});
    return false;
  }
  return true;
}

function buildFallbackItinerary({days=7,budget="mid-range",cities=[],interests=[],notes="",travelerCountry="",startDate=""}={}) {
  const requested = Array.isArray(cities) ? cities.filter(Boolean) : [];
  const route = requested.length ? requested : ["Beijing","Xi'an","Luoyang","Dengfeng"];
  const focus = interests.length ? interests.join(", ") : "history, food and culture";
  const dayTemplates = [
    ["City orientation and a major landmark","Local Chinese lunch","Historic district or museum","Easy neighborhood dinner and evening walk","Use metro or official ride-hailing; keep the destination in Chinese."],
    ["Signature attraction and photo stops","Try a regional specialty","Second major attraction","Night market or relaxed local area","Avoid overpacking the day; allow time for queues."],
    ["Morning cultural site","Casual local restaurant","Neighborhood exploration","Free evening or optional show","Check attraction opening hours and tickets live."],
    ["Slow morning and coffee","Regional food experience","Scenic or cultural activity","Pack for the next transfer","Confirm train/flight times live before departure."],
  ];
  const itineraryDays = Array.from({length: Math.max(1,Math.min(Number(days)||7,21))}, (_,i)=>{
    const city=route[i % route.length];
    const t=dayTemplates[i % dayTemplates.length];
    return {day:i+1,city,morning:t[0],lunch:t[1],afternoon:t[2],evening:t[3],transport:t[4],tips:[`Focus: ${focus}`, budget === "luxury" ? "Leave extra time for private transfers or upgraded experiences." : "Reserve extra time for transport and queues."]};
  });
  return {
    title:`${itineraryDays.length}-day China trip`,
    summary:`A practical starter route based on ${travelerCountry||"your trip"}, your selected cities and interests (${focus}). This is a fallback plan because live AI planning is not currently available.`,
    estimated_budget:budget,
    practical_notes:["This starter itinerary does not claim live prices, opening hours, ticket availability or train schedules.","Check live transport, tickets and opening hours before each activity.", notes ? `Special needs to consider: ${notes}` : "Keep passport details consistent across transport and hotel bookings."],
    days:itineraryDays
  };
}

function aiStatus() {
  return {configured:!!openai, model:aiModel, mode:openai?"ai":"fallback"};
}

async function getCities() {
  if (!supabase) return citiesFallback;
  const {data,error} = await supabase.from("cities").select("*").order("name_en");
  return error || !data?.length ? citiesFallback : data;
}

app.get("/api/health", (req,res)=>res.json({
 ok:true,
  service:"ChinaGo",
  version:"10.0.0",
  ai:aiStatus(),
  database:!!supabase,
  providers:providerStatus(),
  providerConfig:providerConfig(),
  bookingCom:bookingComConfig()
}));

app.get("/api/config", (req,res)=>res.json({
  supabase:{url:process.env.SUPABASE_URL||"", anonKey:process.env.SUPABASE_ANON_KEY||""},
  version:"10.0.0",
  features:{ai:!!openai,database:!!supabase,liveSearch:!!openai,bookingCom:bookingComConfig().configured},
  ai:aiStatus()
}));

app.get("/api/cities", async (req,res)=>res.json(await getCities()));

app.get("/api/survival", (req,res)=>res.json(survival));

app.get("/api/pois", async (req,res)=>{
  if (!supabase) return res.json([
    {name_en:"Shaolin Temple",name_zh:"少林寺",type:"attraction",city:"Dengfeng",tags:["kung-fu","culture"],foreigner_friendly:true},
    {name_en:"Longmen Grottoes",name_zh:"龙门石窟",type:"attraction",city:"Luoyang",tags:["history","art"],foreigner_friendly:true},
    {name_en:"Terracotta Army",name_zh:"秦始皇帝陵博物院",type:"attraction",city:"Xi'an",tags:["history","museum"],foreigner_friendly:true}
  ]);
  let q=supabase.from("pois").select("*,cities(name_en,name_zh,slug)").limit(100);
  if(req.query.city) q=q.eq("cities.slug",req.query.city);
  const {data,error}=await q;
  if(error) return res.status(500).json({error:error.message});
  res.json(data||[]);
});

app.post("/api/plan", async (req,res)=>{
  const {days=7,budget="mid-range",cities=[],interests=[],notes="",travelerCountry="",startDate=""}=req.body||{};
  const safeDays=Math.max(1,Math.min(Number(days)||7,21));
  const payload={days:safeDays,budget,cities,interests,notes,travelerCountry,startDate};
  if(!openai) return res.json({...buildFallbackItinerary(payload),_meta:{mode:"fallback",reason:"AI_NOT_CONFIGURED"}});
  const prompt = `You are ChinaGo, a practical English-language travel planner for foreigners visiting mainland China.
Create a realistic itinerary using the user's constraints.
Never invent live opening hours, live ticket availability, train schedules or current prices. If something depends on today's data, say it must be checked live.
Prefer logical geographic routing and reasonable daily pacing.
Explain Chinese food and transport in plain English.
User:
country=${travelerCountry}
startDate=${startDate}
days=${safeDays}
budget=${budget}
cities=${JSON.stringify(cities)}
interests=${JSON.stringify(interests)}
notes=${notes}`;

  try {
    const response=await Promise.race([
      openai.responses.create({
        model:aiModel,
        store:false,
        input:prompt,
        text:{format:{type:"json_schema",name:"chinago_itinerary",strict:true,schema:itinerarySchema}}
      }),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error("AI request timed out")),30000))
    ]);
    if(!response?.output_text) throw new Error("AI returned an empty itinerary");
    res.json({...JSON.parse(response.output_text),_meta:{mode:"ai",model:aiModel}});
  } catch(e) {
    console.error("/api/plan AI error:",e);
    res.json({...buildFallbackItinerary(payload),_meta:{mode:"fallback",reason:"AI_REQUEST_FAILED",error:e.message||"AI planning failed"}});
  }
});

app.post("/api/chat", async (req,res)=>{
  if(!openai){
    const {message="",context={}}=req.body||{};
    const q=String(message).trim().toLowerCase();
    let answer="ChinaGo Starter Assistant: I can give general China travel guidance, but live/current information and AI answers require an OpenAI API key. For current prices, schedules, opening hours or rules, please verify with the official provider.";
    if(q.includes("pay")||q.includes("alipay")||q.includes("wechat")) answer="For payments in China, prepare Alipay or WeChat Pay with a supported international card, and keep a backup payment method. Exact card support and limits can change, so verify in the app before travel.";
    else if(q.includes("train")||q.includes("rail")) answer="For high-speed rail, keep your passport details consistent with the booking. Check the current timetable and station information before departure.";
    else if(q.includes("visa")) answer="China entry rules depend on nationality, passport and travel purpose. Check the current Chinese embassy/consulate guidance for your passport before booking non-refundable travel.";
    else if(q.includes("hotel")) answer="For hotels, ChinaGo can use Booking.com live inventory once the Booking.com partner credentials are connected. Until then, compare the hotel's location, cancellation terms, payment method and foreign-guest acceptance.";
    res.json({answer,mode:"starter",live:false});
    return;
  }
  const {message="",context={}}=req.body||{};
  try {
    const response=await openai.responses.create({
      model:aiModel,
      store:false,
      input:`You are ChinaGo, a concise foreigner-first China travel assistant.
Answer in clear English. Give concrete next steps. For current facts, explicitly recommend live verification.
Do not claim to have booked anything.
Trip context: ${JSON.stringify(context)}
User: ${message}`
    });
    res.json({answer:response.output_text});
  } catch(e) {
    res.status(500).json({error:e.message||"Chat failed"});
  }
});

app.post("/api/live-search", async (req,res)=>{
  if(!openai){
    const {query=""}=req.body||{};
    if(!String(query).trim()) return res.status(400).json({error:"query required"});
    res.json({answer:"Live search is not connected yet. ChinaGo can still provide general travel guidance, but current prices, schedules, opening hours and rules should be checked on the relevant official website or app.",searchedAt:null,mode:"starter",live:false});
    return;
  }
  const {query="",location=""}=req.body||{};
  if(!query.trim()) return res.status(400).json({error:"query required"});
  try {
    const response=await openai.responses.create({
      model:aiModel,
      store:false,
      tools:[{type:"web_search"}],
      input:`Search the web for current China travel information.
Location: ${location}
Question: ${query}
Answer in concise English. Prefer official sources for opening hours, transport rules, ticketing and government notices. Clearly separate verified facts from uncertainty.`
    });
    res.json({answer:response.output_text, searchedAt:new Date().toISOString()});
  } catch(e) {
    res.status(500).json({error:e.message||"Live search failed"});
  }
});

app.post("/api/providers/hotels", async (req,res)=>res.json(await searchHotels(req.body||{})));
app.post("/api/providers/trains", async (req,res)=>res.json(await searchTrains(req.body||{})));
app.post("/api/providers/tickets", async (req,res)=>providerProxy(req,res,"ticket",searchTickets));
app.post("/api/providers/transfers", async (req,res)=>providerProxy(req,res,"transfer",searchTransfers));
app.post("/api/providers/experiences", async (req,res)=>providerProxy(req,res,"experience",searchExperiences));


app.get("/api/v7/providers", async (req,res)=>{
  const user=await getUserFromBearer(req); if(!isAdmin(user)) return res.status(403).json({error:"Admin access required"});
  res.json({booking_com:bookingComConfig(), generic:providerConfig()});
});

app.post("/api/v7/hotels/booking-com/search", async (req,res)=>{
  const result=await cachedProviderSearch("booking_com_hotel",searchBookingComHotels,req.body||{});
  if(supabase){ const user=await getUserFromBearer(req); await supabase.from("provider_requests").insert({provider:"booking_com",category:"hotel",user_id:user?.id||null,request_json:req.body||{},response_status:result.provider_status||null,success:Boolean(result.configured&& !result.error),latency_ms:null}); }
  res.json(result);
});

app.post("/api/v8/hotels/booking-com/smart-search", async (req,res)=>{
  const result=await cachedProviderSearch("booking_com_hotel_smart",searchBookingComSmartHotels,req.body||{});
  if(supabase){ const user=await getUserFromBearer(req); await supabase.from("provider_requests").insert({provider:"booking_com",category:"hotel_smart",user_id:user?.id||null,request_json:req.body||{},response_status:result.provider_status||null,success:Boolean(result.configured&& !result.error),latency_ms:null}); }
  res.json(result);
});

app.post("/api/v9/hotels/booking-com/autocomplete", async (req,res)=>{
  const result=await bookingComAutocomplete(req.body||{});
  if(supabase){ const user=await getUserFromBearer(req); await supabase.from("provider_requests").insert({provider:"booking_com",category:"hotel_autocomplete",user_id:user?.id||null,request_json:req.body||{},response_status:result.provider_status||null,success:Boolean(result.configured&& !result.error),latency_ms:null}); }
  res.json(result);
});

app.post("/api/v9/hotels/booking-com/details", async (req,res)=>{
  const result=await getBookingComHotelDetails(req.body||{});
  if(supabase){ const user=await getUserFromBearer(req); await supabase.from("provider_requests").insert({provider:"booking_com",category:"hotel_details",user_id:user?.id||null,request_json:req.body||{},response_status:result.provider_status||null,success:Boolean(result.configured&& !result.error),latency_ms:null}); }
  res.json(result);
});

app.post("/api/v8/hotels/booking-com/availability", async (req,res)=>{
  const result=await getBookingComAvailability(req.body||{});
  if(supabase){ const user=await getUserFromBearer(req); await supabase.from("provider_requests").insert({provider:"booking_com",category:"hotel_availability",user_id:user?.id||null,request_json:req.body||{},response_status:result.provider_status||null,success:Boolean(result.configured&& !result.error),latency_ms:null}); }
  res.json(result);
});

app.get("/api/v7/providers/health", async (req,res)=>{
  const user=await getUserFromBearer(req); if(!isAdmin(user)) return res.status(403).json({error:"Admin access required"});
  res.json({booking_com:await healthBookingCom()});
});

app.get("/api/providers/config", async (req,res)=>{
  const user=await getUserFromBearer(req);
  if(!isAdmin(user)) return res.status(403).json({error:"Admin access required"});
  res.json(providerConfig());
});

app.get("/api/providers/health", async (req,res)=>{
  const user=await getUserFromBearer(req);
  if(!isAdmin(user)) return res.status(403).json({error:"Admin access required"});
  const names=["HOTEL","TRAIN","TICKET","TRANSFER","EXPERIENCE"];
  const rows=await Promise.all(names.map(healthProvider));
  res.json(rows);
});

function stableSearchKey(category, payload){
  const canonical=(v)=>{
    if(Array.isArray(v)) return v.map(canonical);
    if(v && typeof v === "object") return Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{});
    return v;
  };
  return Buffer.from(JSON.stringify(canonical({category,payload}))).toString("base64url").slice(0,180);
}

async function cachedProviderSearch(category, fn, payload){
  if(!supabase) return fn(payload);
  const ttl=Number(process.env.QUOTE_CACHE_SECONDS||300);
  const key=stableSearchKey(category,payload||{});
  const now=new Date().toISOString();
  const hit=await supabase.from("provider_quotes").select("response_json,expires_at").eq("category",category).eq("search_key",key).gt("expires_at",now).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(hit.data?.response_json) return {...hit.data.response_json,cached:true,expires_at:hit.data.expires_at};
  const result=await fn(payload);
  if(result?.configured && !result?.error){
    await supabase.from("provider_quotes").insert({provider:result.provider||category,category,search_key:key,response_json:result,expires_at:new Date(Date.now()+ttl*1000).toISOString()});
  }
  return result;
}

app.post("/api/v6/search/:category", async (req,res)=>{
  const map={hotel:["hotel",searchHotels],train:["train",searchTrains],ticket:["ticket",searchTickets],transfer:["transfer",searchTransfers],experience:["experience",searchExperiences]};
  const pair=map[String(req.params.category||"").toLowerCase()];
  if(!pair) return res.status(400).json({error:"Unsupported provider category"});
  const result=await cachedProviderSearch(pair[0],pair[1],req.body||{});
  res.json(result);
});

async function providerProxy(req,res,category,fn){
  const started=Date.now();
  const result=await fn(req.body||{});
  if(supabase){
    const user=await getUserFromBearer(req);
    await supabase.from("provider_requests").insert({provider:category,category,user_id:user?.id||null,request_json:req.body||{},response_status:result.provider_status||null,success:Boolean(result.configured&& !result.error),latency_ms:Date.now()-started});
  }
  res.json(result);
}

app.post("/api/booking-leads", async (req,res)=>{
  const body=req.body||{}; const user=await getUserFromBearer(req);
  if(!supabase) return res.json({ok:true,mode:"demo",message:"Lead captured in demo mode."});
  const lead={user_id:user?.id||null,offer_id:body.offer_id||null,category:String(body.category||"unknown").slice(0,40),status:"new",customer_name:String(body.customer_name||"").slice(0,100),customer_email:String(body.customer_email||"").slice(0,160),customer_phone:String(body.customer_phone||"").slice(0,50),travel_date:body.travel_date||null,party_size:body.party_size?Number(body.party_size):null,request_json:body.request_json||{},source:"chinago"};
  const {data,error}=await supabase.from("booking_leads").insert(lead).select().single();
  if(error) return res.status(500).json({error:error.message});
  res.json({ok:true,lead_id:data.id});
});

app.get("/api/booking-leads", async (req,res)=>{
  if(!supabase) return res.json([]);
  const user=await getUserFromBearer(req); if(!user) return res.status(401).json({error:"Sign in required"});
  const {data,error}=await supabase.from("booking_leads").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
  if(error) return res.status(500).json({error:error.message}); res.json(data||[]);
});

function isAdmin(user){
  const list=String(process.env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  return Boolean(user?.email && list.includes(user.email.toLowerCase()));
}

app.get("/api/admin/summary", async (req,res)=>{
  const user=await getUserFromBearer(req);
  if(!isAdmin(user)) return res.status(403).json({error:"Admin access required"});
  if(!supabase) return res.json({configured:false,providers:providerStatus(),leads:{new:0,total:0},events:{bookings:0,searches:0}});
  const [leads,bookings,searches,providers,sales]=await Promise.all([
    supabase.from("booking_leads").select("id,status",{count:"exact",head:false}).limit(1000),
    supabase.from("booking_events").select("id",{count:"exact",head:true}),
    supabase.from("search_events").select("id",{count:"exact",head:true}),
    supabase.from("admin_provider_summary").select("*"),
    supabase.from("v6_sales_summary").select("*")
  ]);
  const rows=leads.data||[]; res.json({configured:true,providers:providerStatus(),leads:{total:leads.count||rows.length,new:rows.filter(x=>x.status==="new").length},events:{bookings:bookings.count||0,searches:searches.count||0},providerSummary:providers.data||[],salesSummary:sales.data||[]});
});

app.get("/api/admin/leads", async (req,res)=>{
  const user=await getUserFromBearer(req); if(!isAdmin(user)) return res.status(403).json({error:"Admin access required"});
  if(!supabase) return res.json([]);
  const {data,error}=await supabase.from("booking_leads").select("*").order("created_at",{ascending:false}).limit(100);
  if(error) return res.status(500).json({error:error.message}); res.json(data||[]);
});


app.post("/api/orders", async (req,res)=>{
  if(!supabase) return res.status(503).json({error:"Database not configured"});
  const user=await getUserFromBearer(req);
  const b=req.body||{};
  const allowed=["requested","confirmed","paid","cancelled","completed","refunded"];
  const status=allowed.includes(String(b.status))?String(b.status):"requested";
  const {data,error}=await supabase.from("orders").insert({user_id:user?.id||null,lead_id:b.lead_id||null,offer_id:b.offer_id||null,category:String(b.category||"unknown").slice(0,40),provider:String(b.provider||"").slice(0,80),external_order_id:String(b.external_order_id||"").slice(0,120)||null,status,currency:String(b.currency||"CNY").slice(0,8),amount:b.amount==null?null:Number(b.amount),commission_amount:b.commission_amount==null?null:Number(b.commission_amount),customer_email:String(b.customer_email||user?.email||"").slice(0,160)||null,request_json:b.request_json||{}}).select().single();
  if(error) return res.status(500).json({error:error.message});
  res.status(201).json(data);
});

app.get("/api/orders", async (req,res)=>{
  if(!supabase) return res.json([]);
  const user=await getUserFromBearer(req);
  if(!user) return res.status(401).json({error:"Sign in required"});
  const {data,error}=await supabase.from("orders").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
  if(error) return res.status(500).json({error:error.message});
  res.json(data||[]);
});

app.post("/api/webhooks/:provider", async (req,res)=>{
  if(!supabase) return res.status(503).json({error:"Database not configured"});
  const provider=String(req.params.provider||"").slice(0,80);
  const secret=process.env.WEBHOOK_SECRET;
  if(secret && req.headers["x-chinago-webhook-secret"]!==secret) return res.status(401).json({error:"Invalid webhook secret"});
  const eventType=String(req.headers["x-event-type"]||req.body?.event_type||"unknown").slice(0,80);
  const externalId=String(req.headers["x-event-id"]||req.body?.event_id||"").slice(0,160)||null;
  const {data,error}=await supabase.from("webhook_events").insert({provider,event_type:eventType,external_event_id:externalId,payload:req.body||{}}).select().single();
  if(error && error.code==="23505") return res.json({ok:true,duplicate:true});
  if(error) return res.status(500).json({error:error.message});
  const orderId=req.body?.order_id||req.body?.external_order_id;
  const status=req.body?.status;
  if(orderId && status){
    await supabase.from("orders").update({status:String(status).slice(0,30),external_order_id:String(orderId).slice(0,120),updated_at:new Date().toISOString()}).eq("external_order_id",String(orderId));
  }
  await supabase.from("webhook_events").update({processed:true}).eq("id",data.id);
  res.json({ok:true,event_id:data.id});
});

app.patch("/api/admin/leads/:id", async (req,res)=>{
  const user=await getUserFromBearer(req); if(!isAdmin(user)) return res.status(403).json({error:"Admin access required"});
  if(!supabase) return res.status(503).json({error:"Database not configured"});
  const status=String(req.body?.status||"new").slice(0,30);
  const {data,error}=await supabase.from("booking_leads").update({status,updated_at:new Date().toISOString()}).eq("id",req.params.id).select().single();
  if(error) return res.status(500).json({error:error.message});
  await supabase.from("admin_audit").insert({admin_email:user.email,action:"update_lead",entity_type:"booking_lead",entity_id:req.params.id,metadata:{status}});
  res.json(data);
});


app.get("/api/experiences", async (req,res)=>{
  if(!supabase) return res.json([
    {id:"shaolin-private",title:"Shaolin Temple & Kung Fu Day",city:"Dengfeng",duration:"Full day",language:"English",provider_name:"ChinaGo request desk",booking_url:"#"},
    {id:"luoyang-grottoes",title:"Longmen Grottoes Cultural Day",city:"Luoyang",duration:"Full day",language:"English",provider_name:"ChinaGo request desk",booking_url:"#"},
    {id:"zhengzhou-food",title:"Henan Food Discovery",city:"Zhengzhou",duration:"3–4 hours",language:"English",provider_name:"ChinaGo request desk",booking_url:"#"}
  ]);
  let q=supabase.from("experiences").select("*,cities(name_en,name_zh,slug)").eq("active",true).order("created_at",{ascending:false}).limit(100);
  if(req.query.city) q=q.eq("cities.slug",req.query.city);
  const {data,error}=await q;
  if(error) return res.status(500).json({error:error.message});
  res.json(data||[]);
});

app.get("/api/booking-links", async (req,res)=>res.json({
  note:"Commercial provider links are configurable and must be verified before launch.",
  categories:[
    {type:"hotel",label:"Hotels",configured:Boolean(process.env.HOTEL_PROVIDER_URL)},
    {type:"ticket",label:"Attraction tickets",configured:Boolean(process.env.TICKET_PROVIDER_URL)},
    {type:"train",label:"Rail / transport",configured:Boolean(process.env.TRAIN_PROVIDER_URL)},
    {type:"transfer",label:"Airport transfers",configured:false},
    {type:"experience",label:"Local experiences",configured:true}
  ]
}));


app.get("/api/me", async (req,res)=>{
  const user=await getUserFromBearer(req);
  if(!user) return res.status(401).json({error:"Not signed in"});
  res.json({id:user.id,email:user.email,metadata:user.user_metadata||{}});
});

app.put("/api/profile", async (req,res)=>{
  const user=await getUserFromBearer(req);
  if(!user || !supabase) return res.status(401).json({error:"Sign in required"});
  const body=req.body||{};
  const {data,error}=await supabase.from("profiles").upsert({
    id:user.id,
    display_name:String(body.display_name||"").slice(0,80),
    home_country:String(body.home_country||"").slice(0,80),
    preferred_language:String(body.preferred_language||"en").slice(0,20)
  }).select().single();
  if(error) return res.status(500).json({error:error.message});
  res.json(data);
});

app.post("/api/events/booking", async (req,res)=>{
  if(!supabase) return res.json({ok:true});
  const user=await getUserFromBearer(req);
  const {offer_id=null,category="unknown",external_url="",event_type="click",metadata={}}=req.body||{};
  const {error}=await supabase.from("booking_events").insert({user_id:user?.id||null,offer_id,category,external_url,event_type,metadata});
  if(error) return res.status(500).json({error:error.message});
  res.json({ok:true});
});

app.post("/api/events/search", async (req,res)=>{
  if(!supabase) return res.json({ok:true});
  const user=await getUserFromBearer(req);
  if(!user) return res.json({ok:true});
  const {query="",location=""}=req.body||{};
  if(!query) return res.json({ok:true});
  const {error}=await supabase.from("search_events").insert({user_id:user.id,query,location});
  if(error) return res.status(500).json({error:error.message});
  res.json({ok:true});
});

app.get("/api/offers", async (req,res)=>{
  if(!supabase) return res.json([
    {id:"airport-transfer",category:"Airport transfer",title:"Private airport pickup",price_from:null,currency:"CNY",provider_name:"ChinaGo request desk",booking_url:"#"},
    {id:"private-driver",category:"Private driver",title:"Private driver for a China day trip",price_from:null,currency:"CNY",provider_name:"ChinaGo request desk",booking_url:"#"},
    {id:"custom-trip",category:"Custom trip",title:"English-language China trip planning",price_from:null,currency:"CNY",provider_name:"ChinaGo request desk",booking_url:"#"}
  ]);
  let q=supabase.from("offers").select("*").eq("active",true).order("updated_at",{ascending:false}).limit(100);
  if(req.query.category) q=q.eq("category",req.query.category);
  const {data,error}=await q;
  if(error) return res.status(500).json({error:error.message});
  res.json(data||[]);
});

app.get("/api/trips", async (req,res)=>{
  if(!supabase || !publicSupabase) return res.json([]);
  const auth=req.headers.authorization||"";
  const token=auth.replace(/^Bearer\s+/i,"");
  if(!token) return res.status(401).json({error:"Sign in required"});
  const {data:{user},error:userError}=await publicSupabase.auth.getUser(token);
  if(userError || !user) return res.status(401).json({error:"Invalid session"});
  const {data,error}=await supabase.from("saved_trips").select("*").eq("user_id",user.id).order("created_at",{ascending:false});
  if(error) return res.status(500).json({error:error.message});
  res.json(data||[]);
});

app.post("/api/trips", async (req,res)=>{
  if(!supabase || !publicSupabase) return res.status(503).json({error:"Database not configured"});
  const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  const {data:{user},error:userError}=await publicSupabase.auth.getUser(token);
  if(userError || !user) return res.status(401).json({error:"Sign in required"});
  const {title,payload}=req.body||{};
  const {data,error}=await supabase.from("saved_trips").insert({user_id:user.id,title:title||"China trip",payload:payload||{}}).select().single();
  if(error) return res.status(500).json({error:error.message});
  res.json(data);
});


app.put("/api/trips/:id", async (req,res)=>{
  if(!supabase) return res.status(503).json({error:"Database not configured"});
  const user=await getUserFromBearer(req);
  if(!user) return res.status(401).json({error:"Sign in required"});
  const {title,payload}=req.body||{};
  const {data,error}=await supabase.from("saved_trips").update({
    title:title||"China trip",payload:payload||{},updated_at:new Date().toISOString()
  }).eq("id",req.params.id).eq("user_id",user.id).select().single();
  if(error) return res.status(500).json({error:error.message});
  res.json(data);
});

app.get("/api/favorites", async (req,res)=>{
  if(!supabase) return res.json([]);
  const user=await getUserFromBearer(req);
  if(!user) return res.status(401).json({error:"Sign in required"});
  const {data,error}=await supabase.from("favorites").select("*,pois(*,cities(name_en,name_zh,slug))").eq("user_id",user.id);
  if(error) return res.status(500).json({error:error.message});
  res.json(data||[]);
});

app.post("/api/favorites", async (req,res)=>{
  if(!supabase) return res.status(503).json({error:"Database not configured"});
  const user=await getUserFromBearer(req);
  if(!user) return res.status(401).json({error:"Sign in required"});
  const {poi_id}=req.body||{};
  const {data,error}=await supabase.from("favorites").upsert({user_id:user.id,poi_id},{onConflict:"user_id,poi_id"}).select().single();
  if(error) return res.status(500).json({error:error.message});
  res.json(data);
});

app.get("/api/hotel-favorites", async (req,res)=>{
  if(!supabase) return res.json([]);
  const user=await getUserFromBearer(req); if(!user) return res.status(401).json({error:"Sign in required"});
  const {data,error}=await supabase.from("hotel_favorites").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);
  if(error) return res.status(500).json({error:error.message}); res.json(data||[]);
});
app.post("/api/hotel-favorites", async (req,res)=>{
  if(!supabase) return res.status(503).json({error:"Database not configured"});
  const user=await getUserFromBearer(req); if(!user) return res.status(401).json({error:"Sign in required"});
  const b=req.body||{}; if(!b.accommodation_id) return res.status(400).json({error:"accommodation_id required"});
  const {data,error}=await supabase.from("hotel_favorites").upsert({user_id:user.id,accommodation_id:String(b.accommodation_id),title:String(b.title||"").slice(0,200),city_name:String(b.city_name||"").slice(0,120),payload:b.payload||{}},{onConflict:"user_id,accommodation_id"}).select().single();
  if(error) return res.status(500).json({error:error.message}); res.json(data);
});
app.delete("/api/hotel-favorites/:id", async (req,res)=>{
  if(!supabase) return res.status(503).json({error:"Database not configured"});
  const user=await getUserFromBearer(req); if(!user) return res.status(401).json({error:"Sign in required"});
  const {error}=await supabase.from("hotel_favorites").delete().eq("user_id",user.id).eq("accommodation_id",String(req.params.id));
  if(error) return res.status(500).json({error:error.message}); res.json({ok:true});
});

app.delete("/api/favorites/:poiId", async (req,res)=>{
  if(!supabase) return res.status(503).json({error:"Database not configured"});
  const user=await getUserFromBearer(req);
  if(!user) return res.status(401).json({error:"Sign in required"});
  const {error}=await supabase.from("favorites").delete().eq("user_id",user.id).eq("poi_id",req.params.poiId);
  if(error) return res.status(500).json({error:error.message});
  res.json({ok:true});
});

app.delete("/api/trips/:id", async (req,res)=>{
  if(!supabase || !publicSupabase) return res.status(503).json({error:"Database not configured"});
  const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  const {data:{user},error:userError}=await publicSupabase.auth.getUser(token);
  if(userError || !user) return res.status(401).json({error:"Sign in required"});
  const {error}=await supabase.from("saved_trips").delete().eq("id",req.params.id).eq("user_id",user.id);
  if(error) return res.status(500).json({error:error.message});
  res.json({ok:true});
});

app.get("/{*splat}",(req,res)=>res.sendFile("index.html",{root:"public"}));

app.listen(PORT,"0.0.0.0",()=>console.log(`ChinaGo listening on 0.0.0.0:${PORT}`));
