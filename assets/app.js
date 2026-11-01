"use strict";
const $=id=>document.getElementById(id);
const ROOT=new URL("../",document.currentScript.src);
const STORE_KEY="deal-scout-local-v2";
const SOURCES=[
 {id:"fbmarketplace",name:"Facebook Marketplace",method:"Saved-search notifications / authorized provider",priority:true},
 {id:"craigslist",name:"Craigslist",method:"Saved-search emails / authorized collection",priority:true},
 {id:"offerup",name:"OfferUp",method:"Authorized alerts / listing imports"},
 {id:"cycletrader",name:"Cycle Trader",method:"Saved-search emails / authorized data feeds"},
 {id:"ebay",name:"eBay Motors",method:"Official Browse API (credentials pending)"},
 {id:"autotrader",name:"Autotrader Motorcycles",method:"Permitted public results / authorized feeds"},
 {id:"powersports",name:"PowerSports.com",method:"Permitted public pages / authorized feeds"},
 {id:"motohunt",name:"MotoHunt",method:"Permitted results / authorized feeds"},
 {id:"revtero",name:"Revtero",method:"Permitted results / authorized feeds"},
 {id:"pages",name:"Owners' forums & extra pages",method:"Authorized RSS / public forum feeds"}
];
const defaults=()=>({
 id:"daytona-675r",name:"Triumph Daytona 675R",keywords:"Daytona 675R, 675R",
 excludeWords:"",category:"motorcycles",maxPrice:"",marketPrice:10995,dealPct:15,
 minYear:2011,maxYear:2017,maxMiles:"",zip:"",radiusMi:"",areas:"",
 extraUrls:"",sources:SOURCES.map(x=>x.id),alerts:"deals",active:true,
 notes:"R trim only; 2011–2017. Nationwide until ZIP and radius are configured."
});
const seedFallback=[
 {id:"offerup-vista-2012",searchId:"daytona-675r",source:"offerup",title:"2012 Triumph Daytona 675R — track-oriented",year:2012,price:3200,miles:null,location:"Vista, CA",sellerType:"private",url:"https://offerup.com/item/detail/7fa1ae1a-6ce6-366c-a031-feb4d4225fac",foundAt:"2026-10-31",verification:"Historical — unconfirmed",discoveredBy:"ChatGPT",notes:"Track bike, registration and title require verification"},
 {id:"craigslist-mariposa-2012",searchId:"daytona-675r",source:"craigslist",title:"2012 Triumph Daytona 675R",year:2012,price:6500,miles:13500,location:"Mariposa, CA",sellerType:"private",url:"https://www.craigslist.org/view/d/mariposa-2012-triumph-daytona-675r/r1JvJzod2vTyRigvdgG4Sc",foundAt:"2026-10-31",verification:"Historical — unconfirmed",discoveredBy:"ChatGPT",notes:"Reported cosmetic and check-engine/gauge issues"},
 {id:"offerup-citrus-2014",searchId:"daytona-675r",source:"offerup",title:"2014 Triumph Daytona 675R",year:2014,price:7200,miles:null,location:"Citrus Heights, CA",sellerType:"private",url:"https://offerup.com/item/detail/a3aeac1e-02f2-3216-a79c-aa4860dc0ea3",foundAt:"2026-10-31",verification:"Historical — unconfirmed",discoveredBy:"ChatGPT"},
 {id:"offerup-norwood-2015",searchId:"daytona-675r",source:"offerup",title:"2015 Triumph Daytona 675R",year:2015,price:8500,miles:13000,location:"Norwood, MA",sellerType:"private",url:"https://offerup.com/item/detail/d5329550-40c1-363c-8842-3a7078d9f130",foundAt:"2026-10-31",verification:"Historical — unconfirmed",discoveredBy:"ChatGPT"},
 {id:"motohunt-jax-2016",searchId:"daytona-675r",source:"motohunt",title:"2016 Triumph Daytona 675R ABS",year:2016,price:8991,miles:17430,location:"Jacksonville, FL",sellerType:"dealer",url:"https://motohunt.com/l/13488440/2016-Triumph-Daytona-675-R-ABS",foundAt:"2026-10-31",verification:"Historical — unconfirmed",discoveredBy:"ChatGPT"}
];
function readLocal(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||"{}")}catch{return {}}}
const local=readLocal();
local.records=Array.isArray(local.records)?local.records:[];
local.status=local.status&&typeof local.status==="object"?local.status:{};
local.searches=Array.isArray(local.searches)&&local.searches.length?local.searches:[defaults()];
local.searches=local.searches.map(x=>{
 const init=defaults(),merged={...init,...x};
 if(x.maxPrice===undefined&&local.rules&&local.rules.ceiling!=="")merged.maxPrice=local.rules.ceiling;
 if(x.marketPrice===undefined&&local.rules&&local.rules.reference)merged.marketPrice=local.rules.reference;
 if(x.dealPct===undefined&&local.rules&&local.rules.threshold!==undefined)merged.dealPct=local.rules.threshold;
 if(!Array.isArray(merged.sources))merged.sources=SOURCES.map(y=>y.id);
 return merged;
});
let seed=[],runs=[],meta={},activeTab="listings",dataSource="loading";
function save(){try{localStorage.setItem(STORE_KEY,JSON.stringify(local));return true}catch{return false}}
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const currency=v=>v===null||v===undefined||v===""||!Number.isFinite(Number(v))?"—":"$"+Math.round(Number(v)).toLocaleString("en-US");
const isNum=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
const nameOf=id=>SOURCES.find(s=>s.id===id)?.name||id;
function canonicalSource(raw){
 const slug=String(raw||"other").toLowerCase().replace(/[^a-z0-9]/g,"");
 const lookup={facebook:"fbmarketplace",facebookmarketplace:"fbmarketplace",fbmarketplace:"fbmarketplace",ebaymotors:"ebay",ebay:"ebay",autotradermotorcycles:"autotrader",ownersforums:"pages",forum:"pages",other:"other"};
 return lookup[slug]||slug;
}
function all(){
 const map=new Map();
 for(const item of [...seed,...local.records]){
  const key=item.url||item.id;
  if(!key)continue;
  const old=map.get(key)||{};
  map.set(key,{...old,...item,source:canonicalSource(item.source)});
 }
 return [...map.values()];
}
function getSearch(){
 const id=$("searchFilter").value;
 return local.searches.find(x=>x.id===id)||local.searches[0];
}
function savedSourceAllowed(item,search){return !Array.isArray(search.sources)||search.sources.includes(canonicalSource(item.source))}
function searchMatch(item,search){
 if(item.searchId!==search.id)return false;
 if(!savedSourceAllowed(item,search))return false;
 const title=String(item.title||"").toLowerCase();
 if(search.id==="daytona-675r"&&!/\b675\s*-?\s*r\b/i.test(item.title||""))return false;
 const keys=String(search.keywords||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(keys.length&&!keys.some(k=>title.includes(k)))return false;
 const excludes=String(search.excludeWords||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(excludes.some(k=>title.includes(k)))return false;
 if(isNum(search.minYear)&&(!isNum(item.year)||Number(item.year)<Number(search.minYear)))return false;
 if(isNum(search.maxYear)&&(!isNum(item.year)||Number(item.year)>Number(search.maxYear)))return false;
 if(isNum(search.maxMiles)&&(!isNum(item.miles)||Number(item.miles)>Number(search.maxMiles)))return false;
 const areas=String(search.areas||"").split(/[;,]/).map(s=>s.trim().toLowerCase()).filter(Boolean).filter(s=>s!=="nationwide"&&s!=="us");
 if(areas.length&&!areas.some(s=>String(item.location||"").toLowerCase().includes(s)))return false;
 return true;
}
function searchRecords(search){return all().filter(x=>searchMatch(x,search))}
function median(numbers){if(!numbers.length)return null;const s=[...numbers].sort((a,b)=>a-b);const i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2}
function referencePrice(search){
 if(isNum(search.marketPrice)&&Number(search.marketPrice)>0)return Number(search.marketPrice);
 return median(all().filter(x=>x.searchId===search.id&&isNum(x.price)).map(x=>Number(x.price)));
}
function discount(x,search){const m=referencePrice(search);return m>0&&isNum(x.price)?100*(m-Number(x.price))/m:null}
function qualifies(x,search){
 const ref=referencePrice(search);
 return isNum(x.price)&&isNum(search.maxPrice)&&Number(search.maxPrice)>0&&ref>0&&Number(x.price)<=Number(search.maxPrice)&&Number(x.price)<=ref*(1-Number(search.dealPct||0)/100);
}
function statusOf(item){return local.status[item.id||item.url]||"new"}
function sellerConfirmed(x){return x.sellerConfirmed===true||/seller.confirmed/i.test(String(x.verification||""))}
function rowStat(label,value,note){return '<div class="stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(note)+'</span></div>'}
function bars(entries,color=""){
 if(!entries.length)return '<p class="small">No records yet.</p>';
 const max=Math.max(1,...entries.map(x=>x[1]));
 return entries.map(([k,v])=>'<div class="barrow"><strong>'+esc(k)+'</strong><div class="bar-track"><div class="bar-fill '+color+'" style="width:'+Math.min(100,100*v/max)+'%"></div></div><b>'+v+'</b></div>').join("");
}
function groups(arr,get){const c=new Map();arr.forEach(x=>{const k=get(x);c.set(k,(c.get(k)||0)+1)});return [...c.entries()].sort((a,b)=>b[1]-a[1])}
const runSources=()=>new Set(runs.filter(x=>x.status==="ok"&&x.completedAt&&Date.now()-Date.parse(x.completedAt)<86400000&&Date.now()-Date.parse(x.completedAt)>=0).map(x=>canonicalSource(x.source)));
function sourceInfo(){return SOURCES.map(s=>{const success=runs.find(x=>canonicalSource(x.source)===s.id&&x.status==="ok"),failure=runs.find(x=>canonicalSource(x.source)===s.id&&x.status!=="ok");return {...s,count:all().filter(x=>canonicalSource(x.source)===s.id).length,success,failure,recentSuccess:!!(success&&success.completedAt&&Date.now()-Date.parse(success.completedAt)>=0&&Date.now()-Date.parse(success.completedAt)<86400000)}})}
function renderSourceStrip(){
 const info=sourceInfo().filter(x=>x.priority);
 $("sourceStrip").innerHTML=info.map(x=>'<div class="priority-source"><span class="prio-label">'+esc(x.name)+'</span><strong>'+x.count+' historical/recorded</strong><span class="'+(x.recentSuccess?"status-good":"status-off")+'">'+(x.recentSuccess?"Checked within 24h":x.success?"Stale source check":"Not connected")+'</span></div>').join("")+'<span class="small" style="align-self:center">Other sources in the <a href="#sources" id="viewAllSources">Sources tab</a></span>';
 const a=$("viewAllSources");if(a)a.onclick=e=>{e.preventDefault();setTab("sources")};
}
function renderSearchChoices(){
 const old=local.selectedSearchId||$("searchFilter").value||local.searches[0].id;
 const options=local.searches.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join("");
 $("searchFilter").innerHTML=options;
 $("searchFilter").value=local.searches.some(x=>x.id===old)?old:local.searches[0].id;
 local.selectedSearchId=$("searchFilter").value;
 $("editSearchSelect").innerHTML=options;
 $("editSearchSelect").value=$("searchFilter").value;
 const oldSource=$("sourceFilter").value;
 $("sourceFilter").innerHTML='<option value="">All sources</option>'+SOURCES.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join("");
 $("sourceFilter").value=oldSource;
}
function applyFilters(records,search){
 const q=$("query").value.trim().toLowerCase(),src=$("sourceFilter").value,seller=$("sellerFilter").value,status=$("statusFilter").value,ver=$("verificationFilter").value;
 const minYear=$("minYearFilter").value,maxYear=$("maxYearFilter").value,maxMiles=$("maxMilesFilter").value,maxPrice=$("maxPriceFilter").value,locationText=$("locationFilter").value.trim().toLowerCase();
 return records.filter(x=>{
  if(q&&![x.title,x.location,x.notes,x.source].join(" ").toLowerCase().includes(q))return false;
  if(src&&canonicalSource(x.source)!==src)return false;
  if(seller&&x.sellerType!==seller)return false;
  if(status&&statusOf(x)!==status)return false;
  if(minYear&&(!isNum(x.year)||Number(x.year)<Number(minYear)))return false;
  if(maxYear&&(!isNum(x.year)||Number(x.year)>Number(maxYear)))return false;
  if(maxMiles&&(!isNum(x.miles)||Number(x.miles)>Number(maxMiles)))return false;
  if(maxPrice&&(!isNum(x.price)||Number(x.price)>Number(maxPrice)))return false;
  if(locationText&&!String(x.location||"").toLowerCase().includes(locationText))return false;
  if(ver==="confirmed"&&!sellerConfirmed(x))return false;
  if(ver==="historical"&&sellerConfirmed(x))return false;
  if($("dealsOnly").checked&&!qualifies(x,search))return false;
  return true;
 });
}
function renderListings(){
 const search=getSearch();if(!search)return;
 const rows=searchRecords(search),qualified=rows.filter(x=>qualifies(x,search));
 const filtered=applyFilters(rows,search);
 const mode=$("sortFilter").value;
 filtered.sort((a,b)=>{
  if(mode==="price")return (isNum(a.price)?Number(a.price):Infinity)-(isNum(b.price)?Number(b.price):Infinity);
  if(mode==="discount")return (discount(b,search)??-Infinity)-(discount(a,search)??-Infinity);
  if(mode==="year")return (Number(b.year)||0)-(Number(a.year)||0);
  if(mode==="miles")return (isNum(a.miles)?Number(a.miles):Infinity)-(isNum(b.miles)?Number(b.miles):Infinity);
  return String(b.foundAt||"").localeCompare(String(a.foundAt||""));
 });
 const ref=referencePrice(search),live=runSources().size;
 $("activeSearchSummary").textContent=(search.minYear||"Any")+"–"+(search.maxYear||"Any")+" · "+(search.zip?"ZIP "+search.zip+" (radius not enforced)":"Nationwide")+" · "+(search.maxPrice?"Ceiling "+currency(search.maxPrice):"Price ceiling not set");
 $("stats").innerHTML=rowStat("Recorded leads",rows.length,"Includes unverified historical")+rowStat("Private-party leads",rows.filter(x=>x.sellerType==="private").length,"Not seller-confirmed")+rowStat("Price-qualified",!isNum(search.maxPrice)?"—":qualified.length,!isNum(search.maxPrice)?"Add a hard price ceiling":"Price only; verify condition")+rowStat("Live source feeds",live,"Connected successful feeds");
 $("resultCount").textContent=filtered.length+" shown · "+rows.length+" saved";
 $("filterHint").textContent=isNum(search.maxPrice)?"Deal = under "+currency(search.maxPrice)+" AND "+search.dealPct+"% below "+currency(ref)+" reference":"Price-qualified deals require a ceiling in Saved Searches";
 $("listingRows").innerHTML=filtered.map(x=>{
  const d=discount(x,search),key=x.id||x.url,confirmed=sellerConfirmed(x);
  const anchor=/^https:\/\//i.test(x.url||"")?'<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">'+esc(x.title)+'</a>':esc(x.title);
  const label=confirmed?'<span class="badge green">Seller-confirmed</span>':'<span class="badge amber">Unverified</span>';
  return '<tr><td>'+anchor+'<div class="sub">'+esc(x.location||"Location unknown")+' · '+esc(x.year||"Year unknown")+' · '+esc(x.sellerType||"Seller unknown")+'</div><div class="sub">'+label+' <span class="note">'+esc(x.notes||x.verification||"Historical lead; availability not confirmed")+'</span></div></td><td class="num">'+currency(x.price)+'</td><td>'+(isNum(x.miles)?Number(x.miles).toLocaleString():"Unknown")+'</td><td>'+esc(nameOf(canonicalSource(x.source)))+'</td><td>'+(d==null?"—":d.toFixed(1)+"%")+'</td><td>'+(qualifies(x,search)?'<span class="badge green">Price qualifies</span>':'<span class="badge amber">Not qualified</span>')+'</td><td><select data-status="'+esc(key)+'">'+["new","watching","contacted","passed"].map(s=>'<option value="'+s+'" '+(statusOf(x)===s?"selected":"")+'>'+s+'</option>').join("")+'</select></td></tr>';
 }).join("")||'<tr><td colspan="7">No listings match these filters. Try <button class="inline-button" id="clearEmpty">Clear table filters</button>, or check the saved search settings.</td></tr>';
 document.querySelectorAll("[data-status]").forEach(e=>e.onchange=()=>{local.status[e.dataset.status]=e.value;save();renderListings()});
 if($("clearEmpty"))$("clearEmpty").onclick=resetTableFilters;
}
function renderMetrics(){
 const records=all(),privateRows=records.filter(x=>x.sellerType==="private"),confirmed=records.filter(sellerConfirmed);
 const active=runSources().size;
 $("metricStats").innerHTML=rowStat("All recorded leads",records.length,"Across saved searches")+rowStat("Private-party",privateRows.length,"Includes unverified records")+rowStat("Seller-confirmed",confirmed.length,"Independent availability confirmation")+rowStat("Connected feeds",active,"Successful source-run logs");
 $("sourceBars").innerHTML=bars(groups(records,x=>nameOf(canonicalSource(x.source))));
 $("privateBars").innerHTML=bars(groups(privateRows,x=>nameOf(canonicalSource(x.source))),"blue");
 $("agentBars").innerHTML=bars(groups(records,x=>x.discoveredBy||"Unknown"));
 $("healthRows").innerHTML=runs.slice(0,25).map(x=>'<tr><td>'+esc(nameOf(canonicalSource(x.source)))+'</td><td>'+esc(String(x.completedAt||x.time||"").replace("T"," ").slice(0,19))+'</td><td>'+esc(x.status||"unknown")+'</td><td>'+esc(x.added??"—")+'</td></tr>').join("")||'<tr><td colspan="4">No successful or failed feed checks logged. The schedule is configured but sources are not.</td></tr>';
 $("metricsNote").textContent="There are "+records.length+" records, "+confirmed.length+" seller-confirmed available and "+active+" sources with successful collector logs. Historical finds and import totals are not evidence of real-time coverage. Price scoring depends on each saved search's reference and ceiling.";
}
function renderSources(){
 $("sourceCards").innerHTML=sourceInfo().map(s=>{
  const status=s.recentSuccess?"Checked within 24h":s.success?"Stale source check":s.failure?"Last run failed":"Not connected";
  return '<div class="source-card"><strong>'+esc(s.name)+'</strong><span class="badge '+(s.recentSuccess?"green":"amber")+'">'+esc(status)+'</span><p>'+s.count+' recorded leads (historical + imported + collected)</p><p>'+esc(s.method)+'</p><p class="small">'+(s.success?"Last success: "+esc(String(s.success.completedAt||"").replace("T"," ").slice(0,19)):"No confirmed successful feed run")+'</p></div>';
 }).join("");
}
function setForm(search){
 for(const field of ["name","category","keywords","excludeWords","minYear","maxYear","maxMiles","maxPrice","marketPrice","dealPct","zip","radiusMi","areas","extraUrls","notes"]){
  const control=$("s_"+field);if(control)control.value=search[field]??"";
 }
 $("s_alerts").value=search.alerts||"deals";$("s_active").value=String(search.active!==false);
 $("searchSources").innerHTML=SOURCES.map(x=>'<label class="source-check"><input type="checkbox" value="'+esc(x.id)+'" '+(search.sources?.includes(x.id)?"checked":"")+'> '+esc(x.name)+'</label>').join("");
}
function renderSettings(){
 const search=local.searches.find(x=>x.id===$("editSearchSelect").value)||getSearch();if(search)setForm(search);
}
function render(){renderSearchChoices();renderSourceStrip();renderListings();renderMetrics();renderSources();renderSettings()}
async function load(){
 try{
  const file=path=>fetch(new URL(path,ROOT),{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error(path+" HTTP "+r.status);return r.json()});
  const response=await Promise.allSettled([file("data/listings.json"),file("data/runs.json"),file("data/collection.json")]);
  if(response[0].status!=="fulfilled")throw response[0].reason;
  seed=Array.isArray(response[0].value)?response[0].value:[];
  runs=response[1].status==="fulfilled"&&Array.isArray(response[1].value)?response[1].value:[];
  meta=response[2].status==="fulfilled"?response[2].value:{};
  dataSource="repository";
  const live=runSources().size;
  $("syncState").textContent=live?live+" source(s) with successful checks":"0 live sources";
  $("collectionNotice").textContent=live?live+" source(s) have a logged successful check. "+all().length+" total records.":"0 live feeds connected. "+all().length+" stored leads (historical/unverified). Facebook and Craigslist are not collecting yet.";
  $("modeBadge").textContent=live?"Feed activity logged":"Historical snapshot";
  $("modeBadge").className="badge "+(live?"green":"amber");
  $("lastUpdated").textContent=meta.lastUpdated?"Repository snapshot "+meta.lastUpdated:"Historical records";
 }catch(err){
  seed=seedFallback;dataSource="fallback";runs=[];meta={};
  $("syncState").textContent="Repository data unavailable";
  $("collectionNotice").textContent="Listings feed failed to load ("+String(err.message||err)+"). Showing five bundled historical leads as an offline fallback; no live collectors confirmed.";
  $("modeBadge").textContent="Offline fallback";
  $("modeBadge").className="badge amber";
  $("lastUpdated").textContent="Offline historical fallback";
 }
 render();
}
const emptyFilters={query:"",sourceFilter:"",sellerFilter:"",statusFilter:"",sortFilter:"newest",minYearFilter:"",maxYearFilter:"",maxMilesFilter:"",maxPriceFilter:"",locationFilter:"",verificationFilter:""};
function resetTableFilters(){for(const [id,value] of Object.entries(emptyFilters))$(id).value=value;$("dealsOnly").checked=false;renderListings()}
function setTab(tab){
 activeTab=tab;document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===tab));
 $("heading").textContent=({listings:"Listing command center",metrics:"Collection performance",sources:"Marketplace coverage",settings:"Saved searches & rules"})[tab];
 $("subtitle").textContent=({listings:"Browse every recorded lead and apply year, price and mileage filters.",metrics:"Measure discovery and source health without inflated claims.",sources:"See which websites have records and which are actually connected.",settings:"Configure a reusable search for any product or category."})[tab];
 if(tab==="settings")renderSettings();
 location.hash=tab;
}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
for(const id of ["query","sourceFilter","sellerFilter","statusFilter","sortFilter","minYearFilter","maxYearFilter","maxMilesFilter","maxPriceFilter","locationFilter","verificationFilter","dealsOnly"]){
 $(id).addEventListener(["query","minYearFilter","maxYearFilter","maxMilesFilter","maxPriceFilter","locationFilter"].includes(id)?"input":"change",renderListings);
}
$("searchFilter").onchange=()=>{local.selectedSearchId=$("searchFilter").value;save();render()};
$("editSearch").onclick=()=>{setTab("settings");$("editSearchSelect").value=$("searchFilter").value;renderSettings()};
$("editSearchSelect").onchange=renderSettings;
$("refresh").onclick=load;
$("resetFilters").onclick=resetTableFilters;
$("addSearch").onclick=()=>{
 const name=prompt("New saved search name (for example: Ford Ranger)");
 if(!name?.trim())return;
 const id="search-"+Date.now();local.searches.push({...defaults(),id,name:name.trim(),keywords:name.trim(),marketPrice:"",minYear:"",maxYear:"",notes:"",maxPrice:""});
 local.selectedSearchId=id;save();render();$("editSearchSelect").value=id;renderSettings();$("settingsMessage").textContent="Created a browser-local search. Edit filters and click Save search.";
};
$("saveSearch").onclick=()=>{
 const id=$("editSearchSelect").value,search=local.searches.find(x=>x.id===id);if(!search)return;
 const numeric=["minYear","maxYear","maxMiles","maxPrice","marketPrice","dealPct","radiusMi"];
 const fields=["name","category","keywords","excludeWords","minYear","maxYear","maxMiles","maxPrice","marketPrice","dealPct","zip","radiusMi","areas","extraUrls","notes"];
 const updated={...search};
 for(const key of fields){const val=$("s_"+key).value.trim();updated[key]=numeric.includes(key)?(val===""?"":Number(val)):val}
 updated.alerts=$("s_alerts").value;updated.active=$("s_active").value==="true";
 updated.sources=[...document.querySelectorAll("#searchSources input:checked")].map(x=>x.value);
 if(!updated.name){$("settingsMessage").textContent="Search name is required.";return}
 if(isNum(updated.minYear)&&isNum(updated.maxYear)&&updated.minYear>updated.maxYear){$("settingsMessage").textContent="Minimum year cannot exceed maximum year.";return}
 if(!isNum(updated.dealPct)||updated.dealPct<0||updated.dealPct>=100){$("settingsMessage").textContent="Discount must be between 0 and 99.";return}
 Object.assign(search,updated);save();local.selectedSearchId=id;$("searchFilter").value=id;render();
 $("settingsMessage").textContent="Search saved in this browser. Remote collector settings are not synchronized.";
};
$("exportSettings").onclick=()=>download("deal-scout-searches.json",JSON.stringify({searches:local.searches,exportedAt:new Date().toISOString()},null,2));
$("resetSearch").onclick=()=>{
 if(!confirm("Restore the initial Daytona 675R search settings in this browser?"))return;
 const id=$("editSearchSelect").value,search=local.searches.find(x=>x.id===id);
 if(id!=="daytona-675r"){ $("settingsMessage").textContent="Only the initial Daytona search can be restored.";return }
 Object.assign(search,defaults());save();render();$("settingsMessage").textContent="Starting search restored.";
};
function download(name,data){const blob=new Blob([data],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$("importButton").onclick=()=>{
 try{
  const raw=$("importText").value.trim();
  if(!raw)throw Error("Paste a JSON record or a JSONL list.");
  const parsed=raw.startsWith("[")?JSON.parse(raw):raw.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  const items=Array.isArray(parsed)?parsed:[parsed];
  if(items.length>1000)throw Error("Import at most 1000 records per batch.");
  const known=new Set(all().map(x=>x.url)),pending=[];
  for(const item of items){
   if(!item||!/^https:\/\//i.test(item.url||"")||!item.title||!item.source||!item.searchId)throw Error("Each listing needs an HTTPS URL, title, source, and searchId.");
   if(item.price!==undefined&&item.price!==null&&!Number.isFinite(Number(item.price)))throw Error("Price must be numeric or omitted.");
   if(!known.has(item.url)){
    pending.push({...item,source:canonicalSource(item.source),verification:item.verification||"Imported — not seller-confirmed",discoveredBy:item.discoveredBy||"Manual import",foundAt:item.foundAt||new Date().toISOString()});
    known.add(item.url);
   }
  }
  local.records.push(...pending);save();render();$("importMessage").textContent="Added "+pending.length+" unique records to this browser; not yet shared across devices.";$("importText").value="";
 }catch(err){$("importMessage").textContent="Import failed: "+err.message}
};
$("clearLocal").onclick=()=>{if(!confirm("Remove browser-only imported listings and tracking statuses?"))return;local.records=[];local.status={};save();render()};
$("exportButton").onclick=()=>download("deal-scout-listings.json",JSON.stringify({listings:all(),savedSearches:local.searches,exportedAt:new Date().toISOString()},null,2));
const hash=location.hash.slice(1);
if(["listings","metrics","sources","settings"].includes(hash))setTab(hash);
load();