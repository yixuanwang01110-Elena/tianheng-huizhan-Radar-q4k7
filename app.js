'use strict';
const $=id=>document.getElementById(id), D=window.EVENT_DATA, EVENTS=D.events;
const params=new URLSearchParams(location.search), region=params.get('region')==='taiwan'?'台湾':'中国大陆';
const np=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const TODAY=`${np.year}-${np.month}-${np.day}`;
const HOME_MONTH=np.year==='2026'?Number(np.month)-1:9;
const S={sel:null,month:HOME_MONTH,view:'month',day:null,q:'',saved:false,cities:new Set(),tiers:new Set(),purposes:new Set(),regs:new Set(),dls:new Set()};
let personal={};try{const r=JSON.parse(localStorage.getItem('tianheng-events-2026')||'{}');if(r&&typeof r==='object'&&!Array.isArray(r))personal=r;}catch{}
let lastFocus=null;

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:'#';}catch{return '#';}};
const ext=(label,url,cls='btn')=>`<a class="${cls}" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
const T={'旗舰大会':'flag','行业峰会':'sum','小型交流':'small'}, tcls=e=>'t-'+(T[e.kind]||'small');
const PURPOSE={'学习参会':'去学习','结识人脉':'去结识人脉','办会参考':'去借鉴办会'};
const iso=(m,d)=>`2026-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const md=d=>d?`${Number(d.slice(5,7))}月${Number(d.slice(8,10))}日`:'待确认';
const dayDiff=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/864e5);
const WK=['周日','周一','周二','周三','周四','周五','周六'];
const wk=d=>WK[new Date(d+'T00:00:00Z').getUTCDay()];
const isPast=e=>Boolean(e.start&&e.end<TODAY);
const dates=e=>e.start?(e.start===e.end?`${e.start}（${wk(e.start)}）`:`${e.start} — ${e.end}`):'实际会期待确认';
const state=e=>!e.start?'日期待确认':e.end<TODAY?'已结束':e.start<=TODAY?'进行中':'待举办';
const closed=e=>isPast(e)||(e.regClose&&e.regClose<TODAY&&e.regState!=='开放')||e.regState==='已截止'||/已截止/.test(e.deadline||'');
const ctaLabel=(e,r)=>r.k==='ok'?'去报名':e.registrationUrl?'报名 / 咨询入口':'查看活动页';
const heatTag=e=>e.heat==null?'':e.heat>0?`<span class="tag heat" title="热度按报名数、媒体与社群讨论度综合评 0-5">热度 ${'●'.repeat(e.heat)}${'○'.repeat(5-e.heat)}</span>`:'<span class="tag" title="没有查到可靠的讨论度数据">热度未查到</span>';
const regEvents=EVENTS.filter(e=>e.region===region);

// 报名状态：ok / ask / off
function reg(e){
  if(isPast(e))return{k:'off',t:'已结束'};
  if(closed(e))return{k:'off',t:'报名已截止'};
  if(e.regState==='开放')return{k:'ok',t:'官方页显示可报名'};
  if(e.regState==='需申请')return{k:'ask',t:e.reviewKind==='invite'?'邀请制 · 需受邀':'需申请 · 主办方审核'};
  return{k:'ask',t:'报名状态待确认'};
}
// 截止信息：date / rolling / free / review / unknown / past
const DLK={A:'date',B:'rolling',C:'free',D:'apply',E:'unknown'};
const DL_LABEL={date:'有截止日',rolling:'滚动报名·无截止',free:'免费入场·无需报名',apply:'申请制·填表等通过',invite:'邀请制·需受邀',unknown:'未查到截止信息'};
function dl(e){
  if(isPast(e))return{k:'past',t:'已结束'};
  let k=DLK[e.regType]||(e.regClose?'date':(e.regState==='需申请'?'apply':'unknown'));
  if(e.reviewKind==='invite'&&k!=='date')k='invite';
  if(k==='date'&&!e.regClose)k='unknown';
  if(k==='date'){const n=dayDiff(TODAY,e.regClose);return{k,t:`截止 ${md(e.regClose)}${n>=0?(n===0?' · 今天':` · ${n}天后`):' · 已过'}`,urgent:n>=0&&n<=3};}
  return{k,t:DL_LABEL[k],note:e.regNote};
}
function fee(e){
  const p=String(e.price||'');
  if(!p||/^未公开|^未核实/.test(p))return{k:'unk',t:'价格未公开'};
  const paid=/(CNY|TWD|NT\$|¥)\s*[1-9]/.test(p),free=/免费|(CNY|TWD|NT\$)\s*0\b/.test(p);
  if(paid&&free)return{k:'part',t:'部分免费 / 分档'};
  if(paid)return{k:'paid',t:'收费'};
  if(free)return{k:'free',t:'免费'};
  return{k:'unk',t:'价格未公开'};
}

function pass(e){
  if(S.cities.size&&!S.cities.has(e.city))return false;
  if(S.tiers.size&&!S.tiers.has(e.kind))return false;
  if(S.purposes.size&&!S.purposes.has(e.purpose))return false;
  if(S.regs.size&&!S.regs.has(reg(e).k))return false;
  if(S.dls.size&&!S.dls.has(dl(e).k))return false;
  if(S.saved&&!personal[e.id])return false;
  if(S.q&&![e.name,e.summary,e.organizer,e.city,e.relevance,e.venue].join(' ').toLowerCase().includes(S.q))return false;
  return true;
}
const filtered=()=>regEvents.filter(pass);
const onDate=(e,d)=>Boolean(e.start&&e.start<=d&&e.end>=d);
const inMonth=(e,m)=>e.start&&e.start<=iso(m,new Date(2026,m+1,0).getDate())&&e.end>=iso(m,1);

/* ---------- chips ---------- */
function chipGroup(id,items,set,cls=()=>''){
  $(id).innerHTML=items.map(([v,l,n])=>`<button class="chip ${cls(v)}" data-f="${id}" data-v="${esc(v)}" aria-pressed="${set.has(v)}">${esc(l)}${n!=null?`<i>${n}</i>`:''}</button>`).join('');
}
function renderChips(){
  const pref=region==='中国大陆'?['上海','杭州','南京','苏州']:['台北','台中','高雄'];
  const count=c=>regEvents.filter(e=>e.city===c).length;
  const all=[...new Set([...pref,...regEvents.map(e=>e.city)])].sort((a,b)=>(pref.includes(b)-pref.includes(a))||count(b)-count(a));
  chipGroup('cities',all.map(c=>[c,c,count(c)]),S.cities);
  chipGroup('tiers',['旗舰大会','行业峰会','小型交流'].map(v=>[v,v,regEvents.filter(e=>e.kind===v).length]),S.tiers,v=>'t-'+T[v]);
  chipGroup('purposes',Object.entries(PURPOSE).map(([v,l])=>[v,l,regEvents.filter(e=>e.purpose===v).length]),S.purposes);
  chipGroup('regs',[['ok','可报名'],['ask','需申请 / 待确认'],['off','已结束 / 已截止']].map(([v,l])=>[v,l,regEvents.filter(e=>reg(e).k===v).length]),S.regs);
  chipGroup('dls',['date','rolling','free','apply','invite','unknown'].map(k=>[k,DL_LABEL[k],regEvents.filter(e=>dl(e).k===k).length]),S.dls);
}
function renderStats(){
  const up=regEvents.filter(e=>e.start&&e.end>=TODAY);
  const items=[[regEvents.filter(e=>e.start).length,'已定会期'],[up.filter(e=>e.start<=TODAY||dayDiff(TODAY,e.start)<=30).length,'30天内'],[regEvents.filter(isPast).length,'往期参考'],[regEvents.filter(e=>!e.start).length,'待确认线索']];
  $('stats').innerHTML=items.map(([n,l])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
}

/* ---------- countdown ---------- */
function renderSoon(es){
  const rows=es.filter(e=>dl(e).k==='date'&&e.regClose>=TODAY&&(!e.end||e.end>=TODAY)).sort((a,b)=>a.regClose.localeCompare(b.regClose)).slice(0,8);
  $('soon').innerHTML=rows.length?rows.map(e=>{const n=dayDiff(TODAY,e.regClose);return `<button class="sc ${tcls(e)}" data-open="${esc(e.id)}"><span class="days ${n<=3?'urgent':''}">${n===0?'今天':n}<small>${n===0?'截止':'天后截止'}</small></span><b>${esc(e.name)}</b><span class="meta">${esc(e.city)} · ${esc((e.regCloseLabel||'报名截止').split('（')[0])} · ${md(e.regClose)}</span></button>`}).join(''):'<div class="empty">当前筛选下没有「页面写明截止日」的活动。</div>';
  const up=es.filter(e=>!isPast(e)),c=k=>up.filter(e=>dl(e).k===k).length;
  $('dlSummary').innerHTML=`未结束的 ${up.length} 场活动里：<b>${c('date')}</b> 场写明了截止日 · <b>${c('rolling')}</b> 场滚动报名无截止 · <b>${c('free')}</b> 场免费入场 · <b>${c('apply')}</b> 场需填表申请（通过即可）· <b>${c('invite')}</b> 场邀请制 · <b>${c('unknown')}</b> 场没查到（官方页读不到，<u>不代表没有截止</u>，报名前请到原页确认）。`;
}

/* ---------- calendar ---------- */
function defaultDay(es){
  if(S.month===HOME_MONTH&&np.year==='2026')return TODAY;
  const first=es.filter(e=>inMonth(e,S.month)).map(e=>e.start<iso(S.month,1)?iso(S.month,1):e.start).sort()[0];
  return first||iso(S.month,1);
}
function evChip(e,d){
  const r=reg(e),cont=e.start!==d;
  return `<div class="ev ${tcls(e)} ${isPast(e)?'past':''} ${cont?'cont':''}" title="${esc(e.name)} · ${esc(e.city)}"><i class="dot ${r.k}"></i><span class="n"><b>${esc(e.city)}</b>${esc(e.name)}</span></div>`;
}
function renderCalendar(es){
  $('monthTitle').textContent=S.view==='year'?'2026 年全览':`2026 年 ${S.month+1} 月`;
  $('prev').disabled=S.view==='year'||S.month===0;$('next').disabled=S.view==='year'||S.month===11;
  $('monthView').hidden=S.view!=='month';$('yearView').hidden=S.view!=='year';$('monthRail').hidden=S.view!=='month';
  document.querySelectorAll('#viewSeg button').forEach(b=>b.classList.toggle('on',b.dataset.view===S.view));
  $('monthRail').innerHTML=Array.from({length:12},(_,m)=>{const n=es.filter(e=>inMonth(e,m)).length;return `<button data-month="${m}" class="${m===S.month?'on':''}" aria-label="${m+1}月，${n}场">${m+1}月<i>${n||'·'}</i></button>`}).join('');
  const first=(new Date(2026,S.month,1).getDay()+6)%7,days=new Date(2026,S.month+1,0).getDate(),cells=Math.ceil((first+days)/7)*7;
  const weeks=[];
  for(let w=0;w<cells/7;w++){const ds=[];for(let c=0;c<7;c++){const n=w*7+c-first+1;ds.push(n>0&&n<=days?iso(S.month,n):null);}weeks.push(ds);}
  $('calendar').innerHTML=weeks.map(ds=>{
    const valid=ds.map((x,i)=>x?i:-1).filter(i=>i>=0);
    const multi=es.filter(e=>e.start&&e.end>e.start).map(e=>{const idx=valid.filter(i=>ds[i]>=e.start&&ds[i]<=e.end);return idx.length?{e,s:idx[0],t:idx[idx.length-1]}:null;}).filter(Boolean).sort((p,q)=>p.s-q.s||(q.t-q.s)-(p.t-p.s)||p.e.name.localeCompare(q.e.name,'zh'));
    const laneEnd=[];multi.forEach(m=>{let l=laneEnd.findIndex(x=>x<m.s);if(l<0){l=laneEnd.length;laneEnd.push(-1);}laneEnd[l]=m.t;m.l=l;});
    const L=laneEnd.length;
    const cellHtml=ds.map((d,c)=>{
      if(!d)return '<div class="day out"></div>';
      const all=dayEvents(es,d),singles=all.filter(e=>e.start===e.end),we=c>=5;
      return `<div class="day ${we?'we':''} ${d===S.day?'sel':''}" data-day="${d}" tabindex="0" role="button" aria-label="查看${d}，${all.length}场活动"><div class="dh">${all.length?`<span class="cnt">${all.length} 场</span>`:'<span></span>'}<span class="dn ${d===TODAY?'today':''}">${Number(d.slice(8))}</span></div><div class="spacer" style="height:calc(${L}*var(--bh))"></div>${singles.map(e=>evChip(e,d)).join('')}</div>`;
    }).join('');
    const barHtml=multi.map(m=>{
      const e=m.e,r=reg(e),cl=e.start<ds[m.s],cr=e.end>ds[m.t];
      const left=`calc(${m.s}/7*100% + ${cl?0:3}px)`,width=`calc(${m.t-m.s+1}/7*100% - ${(cl?0:3)+(cr?0:3)}px)`;
      return `<div class="span ${tcls(e)} ${isPast(e)?'past':''} ${cl?'cl':''} ${cr?'cr':''}" style="left:${left};width:${width};top:calc(var(--hh) + ${m.l}*var(--bh))" title="${esc(e.name)} · ${esc(e.city)} · ${dates(e)}"><i class="dot ${r.k}"></i><span class="n"><b>${esc(e.city)}</b>${esc(e.name)}</span></div>`;
    }).join('');
    return `<div class="week">${cellHtml}${barHtml}</div>`;
  }).join('');
  $('yearView').innerHTML=Array.from({length:12},(_,m)=>{
    const off=(new Date(2026,m,1).getDay()+6)%7,total=new Date(2026,m+1,0).getDate();
    return `<button class="mm" data-month="${m}" aria-label="查看${m+1}月"><div class="mm-t">${m+1}月<small>${es.filter(e=>inMonth(e,m)).length} 场</small></div><div class="mg">${['一','二','三','四','五','六','日'].map(x=>`<span class="w">${x}</span>`).join('')}${'<span></span>'.repeat(off)}${Array.from({length:total},(_,i)=>{const date=iso(m,i+1),hit=es.filter(e=>onDate(e,date)),top=hit.find(e=>e.kind==='旗舰大会')||hit.find(e=>e.kind==='行业峰会')||hit[0];return `<span class="md ${top?'h-'+T[top.kind]:''} ${date===TODAY?'today':''}">${i+1}</span>`}).join('')}</div></button>`}).join('');
  const count=es.filter(e=>S.view==='year'?e.start:inMonth(e,S.month)).length,pend=es.filter(e=>!e.start).length;
  $('calendarCaption').textContent=`${S.view==='year'?'全年':`${S.month+1}月`} ${count} 场已定会期 · 点任意一天，旁边面板显示当天活动的详细信息 · 另有 ${pend} 条会期待确认的线索未排入日历 · 时间均为 UTC+8`;
}

/* ---------- day panel ---------- */
function dayEvents(es,d){return es.filter(e=>onDate(e,d)).sort((a,b)=>(a.kind===b.kind?0:a.kind==='旗舰大会'?-1:b.kind==='旗舰大会'?1:0)||a.name.localeCompare(b.name,'zh'));}
function dpDetail(e){
  const r=reg(e),d=dl(e),f=fee(e),past=isPast(e);
  const cta=!past&&e.registrationUrl&&r.k!=='off'?ext(ctaLabel(e,r),e.registrationUrl,'btn main'):ext(isPast(e)?'活动原页':'查看活动页',e.url,'btn');
  return `<div class="dp-detail"><div class="row"><em>地点</em><span>${esc(e.city)} · ${esc(e.venue)}</span></div><div class="row"><em>时间</em><span>${esc(dates(e))}</span></div><div class="row"><em>主办</em><span>${esc(e.organizer)}</span></div>
  <p class="why">${esc(e.summary)}</p>
  <div class="tags">${heatTag(e)}<span class="tag"><i class="dot ${r.k}" style="margin-right:5px"></i>${esc(r.t)}</span>${past?'':`<span class="tag dl-${d.k}">${esc(d.t)}</span><span class="tag">${esc(f.t)}</span>`}</div>
  <div class="dp-acts">${cta}<button class="btn" data-open="${esc(e.id)}">完整档案</button></div></div>`;
}
function renderDayPanel(es){
  const d=S.day, evs=dayEvents(es,d);
  if(!evs.some(e=>e.id===S.sel))S.sel=evs[0]?.id||null;
  const nxt=es.filter(e=>e.start&&e.start>d).sort((a,b)=>a.start.localeCompare(b.start))[0];
  $('dayPanel').innerHTML=`<div class="dp-head"><div class="dp-date"><strong>${Number(d.slice(8))}</strong><span>${Number(d.slice(5,7))}月 · ${wk(d)}${d===TODAY?' · 今天':''}</span></div><div class="dp-count">${evs.length?`共 <b>${evs.length}</b> 场`:'无活动'}</div></div>
  ${evs.length?`<div class="dp-list">${evs.map(e=>{const r=reg(e);return `<div class="dp-item open ${tcls(e)} ${isPast(e)?'past':''}"><div class="dp-row"><i class="bar"></i><span class="dp-main"><span class="dp-name">${esc(e.name)}</span><span class="dp-meta"><i class="dot ${r.k}"></i>${esc(e.city)} · ${esc(e.kind)} · ${esc(r.t)}</span></span></div>${dpDetail(e)}</div>`}).join('')}</div>`:`<div class="dp-none">这天没有收录的活动，空白只表示尚未收录。${nxt?`<br>下一场：<button class="link" data-day="${nxt.start}">${md(nxt.start)} · ${esc(nxt.name)}</button>`:''}</div>`}`;
}

/* ---------- list ---------- */
function card(e){
  const r=reg(e),d=dl(e),f=fee(e),past=isPast(e);
  const cta=past?ext('活动原页',e.url):e.registrationUrl&&r.k!=='off'?ext(ctaLabel(e,r),e.registrationUrl,'btn main'):ext(past?'活动原页':'查看活动页',e.url,'btn dark');
  return `<article class="card glass ${tcls(e)} ${past?'past':''}"><div class="dblk"><strong>${e.start?e.start.slice(8):'—'}</strong><span>${e.start?`${Number(e.start.slice(5,7))}月 · ${wk(e.start)}`:'日期待确认'}</span><span>${e.start&&e.start!==e.end?'至 '+md(e.end):''}</span></div>
  <div><div class="tags"><span class="tag tier">${esc(e.kind)}</span>${heatTag(e)}<span class="tag">${esc(e.cadence)}</span><span class="tag">${esc(PURPOSE[e.purpose]||e.purpose)}</span>${e.priority==='优先'?'<span class="tag prio">优先</span>':''}<span class="tag ${!e.start?'warn':''}">${state(e)}</span>${/佐证|平台|未能复核|待核|相关度|滚动|展览|冲突|审核制|钟点/.test(e.verification||'')?`<span class="tag warn">${esc(e.verification)}</span>`:''}${personal[e.id]?`<span class="tag">我的${esc(personal[e.id])}</span>`:''}</div>
  <h3><button data-open="${esc(e.id)}">${esc(e.name)}</button></h3><div class="meta">${esc(e.city)} · ${esc(e.venue)} · ${esc(e.organizer)}</div><p class="sumline">${esc(e.relevance.replace(/^研究判断：/,''))}</p>
  <div class="regline"><i class="dot ${r.k}"></i>${esc(r.t)}${past?'':`<span class="tag dl-${d.k}${d.urgent?' dl-date':''}">${esc(d.t)}</span><span class="tag">${esc(f.t)}</span>`}</div></div>
  <div class="acts">${cta}<button class="btn" data-open="${esc(e.id)}">查看档案</button><button class="btn" data-save="${esc(e.id)}">${personal[e.id]?'已关注 · 取消':'加入关注'}</button></div></article>`;
}
function renderList(es){
  const filtering=Boolean(S.cities.size||S.tiers.size||S.purposes.size||S.regs.size||S.dls.size||S.q||S.saved);
  let scope=$('listScope').value;
  const auto=filtering&&scope==='month';
  if(auto)scope='year';
  const rows=es.filter(e=>scope==='pending'?!e.start:scope==='past'?isPast(e):scope==='upcoming'?e.start&&e.end>=TODAY:scope==='year'?e.start:inMonth(e,S.month));
  rows.sort((a,b)=>(a.start||'9999').localeCompare(b.start||'9999')||a.name.localeCompare(b.name,'zh'));
  $('listTitle').textContent=auto?'筛选结果 · 全年已定会期':{pending:'待确认活动线索',past:'往期回顾',upcoming:'今天起的全部活动',year:'2026 · 全年活动',month:`${S.month+1}月 · 全部活动`}[scope];
  $('listCaption').textContent=`${rows.length} 条符合当前筛选。${scope==='pending'?'以下是线索，不是可直接安排出行的会期。':'往期仅供回顾，不表示团队曾参加。'}`;
  $('eventList').innerHTML=rows.length?rows.map(card).join(''):`<div class="empty">这里没有匹配的活动；空白只表示尚未收录，不表示没有活动。<br><button class="pill" id="showUp">看今天起全部</button><button class="pill" id="resetEmpty">清除筛选</button></div>`;
}
function render(){
  const es=filtered();
  if(!S.day||!S.day.startsWith(iso(S.month,1).slice(0,7)))S.day=defaultDay(es);
  renderChips();renderSoon(es);renderCalendar(es);renderDayPanel(es);renderList(es);placeThumbs();
}

/* ---------- toast / persist ---------- */
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>$('toast').classList.remove('show'),2600);}
function persist(){try{localStorage.setItem('tianheng-events-2026',JSON.stringify(personal));return true;}catch{toast('浏览器未允许保存，本次变更仅在当前页面有效。');return false;}}
function toggleSave(id){if(personal[id])delete personal[id];else personal[id]='关注';const ok=persist();render();if(ok)toast(personal[id]?'已加入本机关注；未提交报名。':'已取消关注。');}

/* ---------- detail ---------- */
const fact=(l,v)=>`<div class="fact"><span>${esc(l)}</span>${esc(v||'未公开')}</div>`;
function openDetail(id){
  const e=EVENTS.find(x=>x.id===id);if(!e)return;const dlg=$('detailDialog');if(!dlg.open)lastFocus=document.activeElement;
  const r=reg(e),d=dl(e),past=isPast(e);
  $('dialogContent').innerHTML=`<div class="${tcls(e)}"><div class="tags"><span class="tag tier">${esc(e.kind)}</span><span class="tag">${esc(e.cadence)}</span><span class="tag">${esc(PURPOSE[e.purpose]||e.purpose)}</span><span class="tag">${state(e)}</span>${past?'':`<span class="tag dl-${d.k}">${esc(d.t)}</span>`}</div></div>
  <h2 class="d-title">${esc(e.name)}</h2>
  <div class="dbtn">${past?'':e.registrationUrl&&r.k!=='off'?ext(ctaLabel(e,r),e.registrationUrl,'btn main'):''}${ext(past?'活动原页':'查看活动页',e.url,e.registrationUrl&&!past&&r.k!=='off'?'btn':'btn dark')}${e.start&&!past?'<button class="btn" id="exportIcs">加入日历提醒</button>':''}</div>
  <div class="notice ${r.k==='ok'?'ok':r.k==='off'?'off':''}"><b><i class="dot ${r.k}"></i>${esc(r.t)}${past?'':' · '+esc(d.t)}</b><br>${esc(e.registrationStatus)}${e.regNote?`<br>截止依据：${esc(e.regNote)}`:''}<br>截止（原记录）：${esc(e.deadline)}${e.regClose&&!past?`（${esc(e.regCloseLabel||'')} ${md(e.regClose)}）`:''}${region==='台湾'?'<br>报名成功不等于具备赴台资格；证件与手续请行前自行核对。':''}</div>
  <div class="facts">${fact('活动日期 · UTC+8',dates(e))}${fact('城市 / 场馆',e.city+' · '+e.venue)}${fact('主办方',e.organizer+(e.organizerType&&e.organizerType!=='待核'?' · '+e.organizerType:''))}${fact('规模（宣传数不等于到场数）',e.scale)}${fact('举办连续性 · '+e.cadence,e.recurrence)}${fact('票价 / 币种',e.price)}</div>
  ${e.gradeWhy?`<div class="sec grade"><h3>为什么是「${esc(e.kind)}」</h3><p>${esc(e.gradeWhy)}</p>${e.heatEvidence?`<p>热度依据：${esc(e.heatEvidence)}</p>`:''}${e.peopleBasis?`<p>人数依据：${esc(e.peopleBasis)}</p>`:''}</div>`:''}<div class="sec"><h3>主要讲什么</h3><p>${esc(e.summary)}</p></div>
  <div class="sec"><h3>为什么值得看 · 研究判断</h3><p>${esc(e.relevance.replace(/^研究判断：/,''))}</p></div>
  <div class="sec"><h3>想借鉴它办活动，看什么</h3><p>${esc(e.observe)}</p></div>
  <div class="mine"><label>我的计划<select id="personalState"><option value="">未关注</option>${['关注','计划参加','已自行报名'].map(s=>`<option ${personal[id]===s?'selected':''}>${s}</option>`).join('')}</select></label><p>只保存在当前浏览器；“已自行报名”是你的手动记录，不代表主办方已审核。</p></div>
  <div class="sec"><h3>信息依据与来源</h3><p>${esc(e.dateEvidence)}</p>${!e.start&&e.dateHint?`<p>线索中的展示日期：${esc(e.dateHint)}；未作为实际会期。</p>`:''}<ul class="srcs">${(e.sources||[]).map(s=>`<li>${ext(s.title,s.url,'')}</li>`).join('')}</ul><div class="snote">${esc(e.verification)} · 核实日期 ${esc(e.checked)} · 不实时更新余位。</div></div>`;
  if(!dlg.open)dlg.showModal();dlg.scrollTop=0;$('closeDialog').focus();
  $('personalState').addEventListener('change',()=>{const v=$('personalState').value;if(v)personal[id]=v;else delete personal[id];persist();render();toast('已更新本机计划；未向主办方提交任何信息。');});
  if($('exportIcs'))$('exportIcs').addEventListener('click',()=>exportIcs(e));
}
function exportIcs(e){
  const clean=t=>String(t||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const end=new Date(e.end+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);const endstr=end.toISOString().slice(0,10).replace(/-/g,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Tianheng//Events 2026//ZH','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${e.id}-2026@tianheng-events.local`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;VALUE=DATE:${e.start.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${endstr}`,`SUMMARY:${clean('[待自行确认] '+e.name)}`,`LOCATION:${clean(e.city+' · '+e.venue)}`,`DESCRIPTION:${clean('仅为活动提醒，非报名凭证。'+e.registrationStatus+' 来源：'+e.url)}`,`URL:${e.url}`,'STATUS:TENTATIVE','TRANSP:TRANSPARENT','END:VEVENT','END:VCALENDAR'];
  const enc=new TextEncoder(),fold=s=>{const parts=[];let cur='',b=0;for(const ch of s){const n=enc.encode(ch).length;if(b+n>73){parts.push(cur);cur=' '+ch;b=1+n;}else{cur+=ch;b+=n;}}parts.push(cur);return parts.join('\r\n');};
  const blob=new Blob([lines.map(fold).join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`${e.id}-2026.ics`;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);toast('已下载日历提醒；这不是报名凭证。');
}

/* ---------- sliding segmented-control thumbs ---------- */
function placeThumb(seg){
  const th=seg.querySelector('.thumb'),on=seg.querySelector('.on');if(!th||!on)return;
  th.style.width=on.offsetWidth+'px';th.style.transform=`translateX(${on.offsetLeft}px)`;
}
function placeThumbs(){document.querySelectorAll('.seg').forEach(placeThumb);}
addEventListener('resize',placeThumbs);

/* ---------- events ---------- */
function resetAll(){['cities','tiers','purposes','regs','dls'].forEach(k=>S[k].clear());S.q='';S.saved=false;S.day=null;$('search').value='';$('onlySaved').checked=false;$('listScope').value='month';render();}
const sets={cities:S.cities,tiers:S.tiers,purposes:S.purposes,regs:S.regs,dls:S.dls};
document.addEventListener('click',ev=>{
  const t=ev.target, f=t.closest('[data-f]'), open=t.closest('[data-open]'), save=t.closest('[data-save]'), mo=t.closest('[data-month]'), day=t.closest('[data-day]'), v=t.closest('#viewSeg [data-view]');
  const sel=t.closest('[data-sel]');
  if(sel){S.sel=sel.dataset.sel;renderDayPanel(filtered());return;}
  if(f){const m=sets[f.dataset.f],val=f.dataset.v;m.has(val)?m.delete(val):m.add(val);render();}
  else if(open)openDetail(open.dataset.open);
  else if(save)toggleSave(save.dataset.save);
  else if(mo){S.month=Number(mo.dataset.month);S.view='month';S.day=null;$('listScope').value='month';render();}
  else if(day){const d=day.dataset.day;S.month=Number(d.slice(5,7))-1;S.day=d;render();if(matchMedia('(max-width:1180px)').matches)$('dayPanel').scrollIntoView({behavior:'smooth',block:'start'});}
  else if(v){S.view=v.dataset.view;S.day=null;$('listScope').value=S.view==='year'?'year':'month';render();}
  else if(t.id==='showUp'){$('listScope').value='upcoming';render();}
  else if(t.id==='resetEmpty')resetAll();
});
document.addEventListener('keydown',ev=>{if(ev.key!=='Enter'&&ev.key!==' ')return;const el=ev.target.closest&&ev.target.closest('.day,.g-row');if(el&&el===ev.target){ev.preventDefault();el.click();}});
$('search').addEventListener('input',()=>{S.q=$('search').value.trim().toLowerCase();render();});
$('onlySaved').addEventListener('input',()=>{S.saved=$('onlySaved').checked;render();});
$('reset').addEventListener('click',resetAll);
$('listScope').addEventListener('change',render);
$('prev').addEventListener('click',()=>{if(S.month>0)S.month--;S.day=null;$('listScope').value='month';render();});
$('next').addEventListener('click',()=>{if(S.month<11)S.month++;S.day=null;$('listScope').value='month';render();});
$('today').addEventListener('click',()=>{S.month=HOME_MONTH;S.view='month';S.day=null;$('listScope').value='month';render();});
$('closeDialog').addEventListener('click',()=>$('detailDialog').close());
$('detailDialog').addEventListener('click',ev=>{if(ev.target===$('detailDialog'))$('detailDialog').close();});
$('detailDialog').addEventListener('close',()=>{lastFocus?.isConnected&&lastFocus.focus();});

document.querySelectorAll('#regionSeg [data-region]').forEach(a=>a.classList.toggle('on',a.dataset.region===region));
$('regionLabel').textContent=region;
document.querySelector('.brand').href=region==='台湾'?'?region=taiwan':'?region=mainland';
$('asof').textContent='资料截至 '+D.asOf.replace(/-/g,'.');
renderStats();render();
document.fonts?.ready.then(placeThumbs);
