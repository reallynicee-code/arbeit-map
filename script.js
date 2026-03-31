let map;
let circle;
let radius=1000;
let locked=false;
let lockedCenter=null;
let centerMarker=null;
let activeInfoWindow=null;
let markers=[];

let jobs = [];

fetch("jobs.json")
  .then(response => response.json())
  .then(data => {
    jobs = data;
    initMap();
  });

function formatRadius(r){
  return r<1000 ? r+" m" : (r/1000)+" km";
}

function initMap(){

  map=new google.maps.Map(document.getElementById("map"),{
    center:{lat:35.681236,lng:139.767125},
    zoom:14,
    streetViewControl:false,
    mapTypeControl:false,
    fullscreenControl:false,
    mapId:"ed7852573fd62be93ad25879"
  });

  const locations = groupJobsByLocation(jobs);

  /* 未固定時は常に中央更新 */
  map.addListener("center_changed", () => {
    if (!locked) {
      updateCircle(map.getCenter());
    }
  });

  map.addListener("zoom_changed", () => {
  if (!locked) {
    updateCircle(map.getCenter());
  }
});
  
  /* 検索 Autocomplete */
  const input=document.getElementById("searchInput");
  const autocomplete=new google.maps.places.Autocomplete(input);
  autocomplete.bindTo("bounds",map);

  autocomplete.addListener("place_changed",()=>{
    const place=autocomplete.getPlace();
    if(!place.geometry) return;
    map.panTo(place.geometry.location);
    map.setZoom(15);
    lockCircle(place.geometry.location);
  });

  /* Enter検索 */
  input.addEventListener("keydown",e=>{
    if(e.key==="Enter"){
      const geocoder=new google.maps.Geocoder();
      geocoder.geocode({address:input.value},(results,status)=>{
        if(status==="OK"){
          map.panTo(results[0].geometry.location);
          map.setZoom(15);
          lockCircle(results[0].geometry.location);
        }
      });
    }
  });

  /* スライダー */
  document.getElementById("radiusSlider").addEventListener("input",e=>{
  
    let value=parseInt(e.target.value);
  
    // 1000以上は表示だけ丸める
    if(value>=1000){
      value=Math.round(value/1000)*1000;
    }
  
    radius=value;
    e.target.value=value;
  
    document.getElementById("radiusLabel").innerText=
      "半径 "+formatRadius(radius);
  
    updateCircle(locked?lockedCenter:map.getCenter());
  });

  /* 固定ボタン */
  document.getElementById("lockBtn").addEventListener("click",()=>{
    if(locked){
      locked=false;
      lockedCenter=null;
    if(centerMarker){
      centerMarker.setMap(null);
      centerMarker = null;
     }
      document.getElementById("crosshair").style.display="block";
      document.getElementById("lockBtn").classList.remove("active");
      document.getElementById("lockBtn").innerText="円の位置を固定";
    }else{
      lockCircle(map.getCenter());
    }
  });

  document.getElementById("radiusLabel").innerText="半径 "+formatRadius(radius);
}
  
/* 同座標の求人をまとめる */
function groupJobsByLocation(jobs){

  const map = new Map();

  jobs.forEach(job=>{

    const key = job.lat + "," + job.lng;

    if(!map.has(key)){
      map.set(key,{
        lat:job.lat,
        lng:job.lng,
        jobs:[]
      });
    }

    map.get(key).jobs.push(job);

  });

  return Array.from(map.values());

}
  
/* 固定処理 */
function lockCircle(center){
  locked=true;
  lockedCenter=center;

  document.getElementById("crosshair").style.display="none";

  /* 既存があれば削除 */
if (centerMarker) {
  centerMarker.setMap(null);
  centerMarker = null;
}

/* 新しく作成して保持 */
centerMarker = createCenterMarker(center);

  document.getElementById("lockBtn").classList.add("active");
  document.getElementById("lockBtn").innerText="固定中（クリックで解除）";

  updateCircle(center);
}

/* 円中心固定マーカー（黒縁白円＋中央黒点） */

function createCenterMarker(position){

  return new google.maps.Marker({
    map,
    position,
    icon:{
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
          <circle cx="14" cy="14" r="12"
            fill="white"
            stroke="black"
            stroke-width="2"/>
          <circle cx="14" cy="14" r="4"
            fill="black"/>
        </svg>
      `),
      scaledSize: new google.maps.Size(28,28),
      anchor: new google.maps.Point(14,14)
    }
  });
}
  
/* 円更新 */
function updateCircle(center){

  if(!circle){
    circle = new google.maps.Circle({
      map,
      center,
      radius,
      strokeColor:"#ff4da6",
      strokeWeight:2,
      fillColor:"#ff4da6",
      fillOpacity:0.15
    });
  } else {
    circle.setCenter(center);
    circle.setRadius(radius);
  }

  if(locked && centerMarker){
    centerMarker.position = center;
  }

  showNearby(center.lat(), center.lng());
}
  
/* 青ピン */
function createJobMarker(job){

  const pin=new google.maps.marker.PinElement({
    background:"#1e90ff",
    borderColor:"#1e90ff",
    glyphColor:"white",
    glyph:"求"
  });

  const marker=new google.maps.marker.AdvancedMarkerElement({
    map,
    position:{lat:job.lat,lng:job.lng},
    content:pin.element
  });

  /* 吹き出し */
  const info=new google.maps.InfoWindow({
    content: `
      <div style="width:240px">
        <img src="${job.image}" style="width:100%;border-radius:8px;">
        <h3 style="margin:8px 0 4px 0;">${job.title}</h3>
        <div>${job.days}</div>
        <div>${job.wage}</div>
      </div>
    `
  });

  let hoverOpen=false;

   /* ホバー表示（DOMに直接イベント） */
  marker.element.addEventListener("mouseenter",()=>{
    if(activeInfoWindow!==info){
      info.open(map,marker);
      hoverOpen=true;
    }
  });
  
  marker.element.addEventListener("mouseleave",()=>{
    if(hoverOpen){
      info.close();
      hoverOpen=false;
    }
  });

  /* クリックで常時表示（1つのみ） */
  marker.addListener("click",()=>{
  
    if(activeInfoWindow && activeInfoWindow!==info){
      activeInfoWindow.close();
    }
  
    info.open(map,marker);
    activeInfoWindow=info;
    hoverOpen=false;
  
    openDetail(job);
  });

  markers.push(marker);
}

function createMultiJobMarker(loc){

  const pin=new google.maps.marker.PinElement({
    background:"#ff6b6b",
    borderColor:"#ff6b6b",
    glyphColor:"white",
    glyph:String(loc.jobs.length)
  });

  const marker=new google.maps.marker.AdvancedMarkerElement({
    map,
    position:{lat:loc.lat,lng:loc.lng},
    content:pin.element
  });

  marker.addListener("click",()=>{
    console.log(loc.jobs);
  });

  markers.push(marker);

}

function openDetail(job){

  document.getElementById("detailPanel").classList.add("active");

  document.getElementById("detailContent").innerHTML = `
    <img src="${job.image}" style="width:100%;border-radius:8px">

    <h2 style="margin-top:10px">${job.title}</h2>

    <div style="margin-top:6px">
      ${job.days}
    </div>

    <div style="margin-top:4px;font-weight:bold">
      ${job.wage}
    </div>

    <a href="${job.link}" target="_blank"
      style="
        display:block;
        margin-top:16px;
        padding:10px;
        text-align:center;
        background:#ff4da6;
        color:white;
        text-decoration:none;
        border-radius:8px;
        font-weight:bold;
      ">
      求人サイトで応募する
    </a>
  `;
}
  
function showNearby(lat,lng){

  markers.forEach(m=>m.map=null);
  markers=[];

  let count=0;

const locations = groupJobsByLocation(jobs);

locations.forEach(loc=>{

  const d=getDistance(lat,lng,loc.lat,loc.lng);

  if(d<=radius){

    if(loc.jobs.length===1){
      createJobMarker(loc.jobs[0]);
    }else{
      createMultiJobMarker(loc);
    }

    count++;

  }

});

  document.getElementById("jobCount").innerText=
    "求人 "+count+" 件";
}

function getDistance(lat1,lng1,lat2,lng2){
  const R=6371000;
  const toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1);
  const dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2+
    Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*
    Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

document.getElementById("closeDetail").addEventListener("click",()=>{
  document.getElementById("detailPanel").classList.remove("active");
});
