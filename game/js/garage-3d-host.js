/* Opt-in visual adapter. Account credentials and all game actions stay here. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('garage3d') === '0') return;
  let frame, ready=false, visualReady=false, loadFailed=false, busy=false, enabled=true, lastRequest=0,departureId=0,pendingDeparture=0,departureReady=false,loadingTimer=0;
  window.requestGarage3DExit=()=>{
    if(!frame||!ready||!visualReady||loadFailed||!enabled||scene!=='garage')return false;
    if(pendingDeparture)return true;
    pendingDeparture=++departureId;toggle.disabled=true;if(departureReady)send({type:'depart',id:pendingDeparture});return true;
  };
  const allowed={asics:'g-asics',workshop:'g-shop',collect:'g-take',blow:'g-blow',exit:'g-exit'};
  const style=document.createElement('style');
  style.textContent='#garage-3d-frame{position:fixed;left:0;right:0;width:100%;border:0;z-index:4;background:#080c10}#garage-3d-toggle{position:fixed;right:18px;z-index:19;background:#142327;color:#eee;border:1px solid #65746d;border-radius:4px;padding:7px 10px;font:12px Segoe UI}.garage-3d-active #garage-fab{display:none}@media(max-width:650px){.garage-3d-active #quests{display:none}}';
  document.head.append(style);
  style.textContent+='.garage-3d-active #city{visibility:hidden}';
  style.textContent+='#garage-3d-loading{position:fixed;inset:0;z-index:2147483647;background:#080d11;color:#edeae0;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:Segoe UI,Arial,sans-serif}#garage-3d-loading[hidden]{display:none}#garage-3d-loading h1{font-size:clamp(28px,5vw,42px);margin:0 0 44px;letter-spacing:-1.4px}#garage-3d-loading b{color:#e6ba63}#garage-3d-loading progress{width:min(380px,80vw);height:3px;accent-color:#e6ba63}#garage-3d-loading span{margin-top:18px;color:#e6c68b;font-variant-numeric:tabular-nums}#garage-3d-loading button{margin-top:22px;background:#182025;border:1px solid #8a744b;color:#f0d9af;padding:11px 24px;border-radius:4px;cursor:pointer}';
  const loading=document.createElement('div');loading.id='garage-3d-loading';loading.hidden=true;
  const loadingBrand=document.createElement('h1');loadingBrand.innerHTML='MINING <b>GANGS</b>';
  const loadingBar=document.createElement('progress');loadingBar.max=100;loadingBar.value=0;loadingBar.setAttribute('aria-label','Загрузка игры');
  const loadingPercent=document.createElement('span');loadingPercent.textContent='0%';
  const loadingRetry=document.createElement('button');loadingRetry.textContent='Попробовать снова';loadingRetry.hidden=true;
  loading.append(loadingBrand,loadingBar,loadingPercent,loadingRetry);document.body.append(loading);
  function loadingError(){clearTimeout(loadingTimer);loadFailed=true;ready=false;visualReady=false;departureReady=false;pendingDeparture=0;toggle.disabled=false;loadingBar.hidden=true;loadingPercent.textContent='Не удалось загрузить игру';loadingRetry.hidden=false;tick();}
  function resetFrame(){clearTimeout(loadingTimer);frame?.remove();frame=null;ready=false;visualReady=false;loadFailed=false;lastRequest=0;departureReady=false;pendingDeparture=0;toggle.disabled=false;}
  loadingRetry.onclick=()=>{resetFrame();tick();};
  const toggle=document.createElement('button');toggle.id='garage-3d-toggle';toggle.textContent='2D';toggle.title='Обычный вид гаража';toggle.hidden=true;document.body.append(toggle);
  toggle.onclick=()=>{enabled=!enabled;toggle.textContent=enabled?'2D':'3D';tick();};
  function send(payload){frame?.contentWindow?.postMessage({channel:'mining-garage-v1',...payload},location.origin);}
  // A confirmed purchase updates the shelf in the same UI turn. The periodic
  // tick remains a safety net for inventory changes received from the server.
  window.refreshGarage3DInventory=()=>{if(ready&&frame&&!loadFailed)send(snapshot());};
  function accountReady(){return SERVER_AUTH?remoteProfile():Boolean(ACC.name);}
  function snapshot(){
    const connected=accountReady();
    return {type:'state',connected,owner:connected?{id:ACC.id,name:ACC.name}:null,active:scene==='garage'&&enabled,
      rigs:connected?RIG_TYPES.map(r=>({id:r.id,name:r.name,th:r.th,count:Number(gar.rigInv[r.id]||0)})):[],
      hash:connected?gar.hash:null,dust:connected?gar.dust:null,available:connected?gar.store:null,
      busy:busy||garageActionBusy||!!pendingDeparture};
  }
  function tick(){
    if(typeof scene==='undefined'||typeof gar==='undefined')return;
    const active=scene==='garage';toggle.hidden=!active;
    if(active&&enabled&&!frame){
      visualReady=false;loadingBar.hidden=false;loadingBar.value=0;loadingPercent.textContent='0%';loadingRetry.hidden=true;
      loadingTimer=setTimeout(loadingError,200000);
      frame=document.createElement('iframe');frame.id='garage-3d-frame';frame.title='Мой гараж 3D';
      const localPreview=location.pathname.startsWith('/game/');
      frame.src=new URL('garage3d/dist/garage.html?embedded=1#workshop',location.href).href;
      document.body.append(frame);
    }
    if(!frame){window.garage3DVisible=false;document.body.classList.toggle('garage-3d-active',false);return;}
    loading.hidden=!active||!enabled||visualReady;
    frame.hidden=!active||!enabled;
    window.garage3DVisible=ready&&active&&enabled;
    document.body.classList.toggle('garage-3d-active',window.garage3DVisible);
    const hud=document.getElementById('ghud'),bottom=Math.max(92,(hud?.getBoundingClientRect().height||72)+40);
    const top=Math.ceil(document.getElementById('top').getBoundingClientRect().bottom);
    frame.style.top=`${top}px`;toggle.style.top=`${top+4}px`;
    frame.style.height=`${Math.max(120,innerHeight-top-bottom)}px`;
    if(ready)send(snapshot());
  }
  window.addEventListener('message',async event=>{
    if(!frame||event.source!==frame.contentWindow||event.origin!==location.origin)return;
    const m=event.data;if(!m||m.channel!=='mining-garage-v1')return;
    // Once a load failed, only an explicit retry creates a new valid session.
    // Delayed messages from the failed frame cannot reveal it or start actions.
    if(loadFailed)return;
    if(m.type==='loading-progress'&&Number.isFinite(m.progress)){if(visualReady)return;const progress=Math.max(loadingBar.value,Math.min(99,Math.max(0,m.progress)));loadingBar.value=progress;loadingPercent.textContent=`${Math.floor(progress)}%`;return;}
    if(m.type==='scene-ready'){visualReady=true;loadingBar.value=100;loadingPercent.textContent='100%';clearTimeout(loadingTimer);tick();return;}
    if(m.type==='loading-error'){clearTimeout(loadingTimer);loadingError();return;}
    if(m.type==='departure-ready'){departureReady=true;if(pendingDeparture)send({type:'depart',id:pendingDeparture});return;}
    if(m.type==='departure-complete'&&pendingDeparture&&m.id===pendingDeparture){exitGarage(true);resetFrame();loading.hidden=true;tick();return;}
    if(m.type==='ready'){ready=true;tick();return;}
    if(m.type!=='action'||!Number.isSafeInteger(m.id)||m.id<=lastRequest||!Object.hasOwn(allowed,m.action))return;
    lastRequest=m.id;
    if(pendingDeparture||busy||garageActionBusy||scene!=='garage'||!enabled||!accountReady()){
      send({type:'result',id:m.id,error:'Действие недоступно'});return;
    }
    const button=document.getElementById(allowed[m.action]);
    if(!button||button.disabled){send({type:'result',id:m.id,error:'Действие недоступно'});return;}
    const requestFrame=frame;
    const result=payload=>{if(frame===requestFrame&&!loadFailed)send({type:'result',id:m.id,...payload});};
    busy=true;send(snapshot());
    try {
      // Existing handlers own server requests, confirmation toasts and mutations.
      await button.onclick.call(button);
      result({});
    } catch(error){result({error:String(error.message||'Ошибка действия')});}
    finally{busy=false;tick();}
  });
  setInterval(tick,500);
})();
