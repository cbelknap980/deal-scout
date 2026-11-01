/* Deal Scout standalone dashboard smoke tests (no network dependencies). */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname,"..");
const html = fs.readFileSync(path.join(root,"index.html"),"utf8");
const js = fs.readFileSync(path.join(root,"assets","app.js"),"utf8");
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
const nodes=Object.fromEntries(ids.map(id=>[id,{value:"",innerHTML:"",textContent:"",checked:false,dataset:{},addEventListener(){},onclick:null,onchange:null,oninput:null}]));
const storage=new Map();
const ctx={
 document:{
  currentScript:{src:"https://cbelknap980.github.io/deal-scout/assets/app.js"},
  getElementById:id=>nodes[id]||null,
  querySelectorAll:()=>[]
 },
 localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
 location:{hash:""},
 fetch:async url=>{
  const name=new URL(url).pathname.replace(/^\/deal-scout\//,"");
  const full=path.resolve(root,name);
  if(!full.startsWith(root+path.sep))throw Error("Bad test path");
  return {ok:true,json:async()=>JSON.parse(fs.readFileSync(full,"utf8"))};
 },
 URL,Blob,Date,Math,Number,String,Array,Object,JSON,Map,Set,
 setTimeout(){},prompt(){return null},confirm(){return false},console
};
vm.createContext(ctx);
vm.runInContext(js+"\n;globalThis.__test={load,render,renderListings,searchMatch,searchRecords,getSearch,qualifies,all,referencePrice,resetTableFilters};",ctx,{filename:"assets/app.js"});
(async()=>{
 const app=ctx.__test;
 await app.load();
 const leadRows=(nodes.listingRows.innerHTML.match(/<tr>/g)||[]).length;
 assert.equal(leadRows,5,"All historical leads must render");
 assert.equal((nodes.sourceCards.innerHTML.match(/class="source-card"/g)||[]).length,10,"All major sources must appear");
 assert.match(nodes.collectionNotice.textContent,/0 live feeds/,"No false claim of live collection");
 for(const city of ["Mariposa","Vista","Citrus Heights","Norwood","Jacksonville"])assert.ok(nodes.listingRows.innerHTML.includes(city),city);
 const search=app.getSearch();
 assert.equal(search.minYear,2011);
 assert.equal(search.maxYear,2017);
 assert.equal(search.maxPrice,"");
 assert.equal(app.searchRecords(search).length,5);
 assert.equal(app.searchRecords(search).filter(x=>app.qualifies(x,search)).length,0,"Blank ceiling must disable deal flag");
 search.maxPrice=8000;
 assert.equal(app.searchRecords(search).length,5,"Ceiling is a deal rule, not a filter hiding market comparables");
 assert.equal(app.searchRecords(search).filter(x=>app.qualifies(x,search)).length,3,"Both price rules must be satisfied");
 search.maxMiles=14000;
 assert.equal(app.searchRecords(search).length,2,"Mileage filter excludes missing miles and too-high mileage");
 search.maxMiles="";
 search.excludeWords="track-oriented";
 assert.equal(app.searchRecords(search).length,4);
 search.excludeWords="";
 nodes.sourceFilter.value="craigslist";app.renderListings();
 assert.equal((nodes.listingRows.innerHTML.match(/<tr>/g)||[]).length,1,"Source table filter");
 app.resetTableFilters();
 nodes.minYearFilter.value="2015";app.renderListings();
 assert.equal((nodes.listingRows.innerHTML.match(/<tr>/g)||[]).length,2,"Minimum year table filter");
 app.resetTableFilters();
 ctx.fetch=async()=>{throw Error("simulated offline")};
 await app.load();
 assert.equal((nodes.listingRows.innerHTML.match(/<tr>/g)||[]).length,5,"Fallback shows historical leads when JSON unavailable");
 assert.match(nodes.collectionNotice.textContent,/failed to load/);
 const missing=[...js.matchAll(/\$\("([^"]+)"\)/g)].map(m=>m[1]).filter(id=>!ids.includes(id)&&!["viewAllSources","clearEmpty"].includes(id));
 assert.deepEqual([...new Set(missing)],[],"Every static JS ID must exist in HTML");
 console.log("PASS: 12 dashboard audit groups; listings, priority sources, original search fields, scoring, filters, JSON fallback, DOM integrity");
})().catch(e=>{console.error(e);process.exitCode=1});
