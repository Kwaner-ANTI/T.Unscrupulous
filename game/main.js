import { CUSTOMERS, TOOLS, PARTS, observation } from './data.js';
import { freshState, readSave, settle, SAVE_KEY } from './economy.js';
import { createShop } from './scene.js';
const $=selector=>document.querySelector(selector);
const money=value=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0}).format(value);
const loaded=readSave();let state=loaded.state,shop=null,tool='visual',pendingObservation=null,busy=false,audio=null,timer=null,destroyed=false;
function text(tag,value,className=''){const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;}
function hint(message){$('#hint').textContent=message;}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));$('#save-status').textContent='进度已自动保存在此浏览器 · 所有金额均为模拟币';}catch(e){$('#save-status').textContent='本地保存失败，请保持页面打开。浏览器存储可能被禁用或已满。';}}
function tone(type='tap'){
 if(state.muted)return;
 try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(type==='done'?660:390,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(type==='done'?880:480,audio.currentTime+.09);gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.16);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.17);}catch(e){/* Sound is optional; game remains playable. */}
}
function updateLedger(){
 $('#cash').textContent=money(state.cash);$('#stock').textContent=state.inventory.length;$('#cost').textContent=money(state.inspectionCost);$('#realized').textContent=money(state.realized);$('#reputation').textContent=state.reputation;$('#completed').textContent=`${state.completed} / ${CUSTOMERS.length}`;
 $('#mute').textContent=state.muted?'声音：关':'声音：开';$('#mute').setAttribute('aria-pressed',String(state.muted));
 const inventory=$('#inventory');inventory.replaceChildren();if(!state.inventory.length)inventory.append(text('p','收购的设备会陈列在这里。'));
 state.inventory.forEach(item=>{const card=text('article','', 'inventory-item');card.append(text('strong',item.name),text('p',`购入 ${money(item.purchase)} · 未售出`),text('p',`整备预算 ${money(item.refurbBudget)} · 预计转售价 ${money(item.resale)}`));inventory.append(card);});
}
function updateRecords(){const host=$('#records');host.replaceChildren();if(!state.records.length)host.append(text('li','尚无检测记录。'));state.records.forEach(key=>{const r=state.tests[key];if(r)host.append(text('li',`${r.title}：${r.text}`));});}
function setTool(value,audible=true){tool=value;shop?.setTool(value);document.querySelectorAll('[data-tool]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tool===value)));$('#tool-indicator').textContent=TOOLS[value].name;const targets=TOOLS[value].parts.map(p=>PARTS[p]).join(' / ');hint(`已选 ${TOOLS[value].name}，请点击${targets}。`);if(audible)tone();}
function showObservation(key){pendingObservation=key;const r=state.tests[key];$('#observation').hidden=false;$('#observation-title').textContent=r.title;$('#observation-text').textContent=r.text;$('#record').disabled=state.records.includes(key);$('#record').textContent=state.records.includes(key)?'已记入记录':'加入检测记录';}
async function inspect(requestedTool,part){
 if(!state.started){hint('先点击“开始营业”。');return;}
 if(busy||state.settlement||state.index>=CUSTOMERS.length){hint(busy?'仪器正在工作，请稍候。':'这位顾客已结算，点击“接待下一位”继续。');return;}
 const selectedTool=TOOLS[requestedTool];if(!selectedTool.parts.includes(part)){hint(`${selectedTool.name}应对准${selectedTool.parts.map(p=>PARTS[p]).join(' / ')}，当前选择的是${PARTS[part]}。`);tone();return;}
 const key=`${requestedTool}:${part}`;shop.select(part);if(state.tests[key]){showObservation(key);hint('已读取本次检测结果，不重复收费。');return;}
 if(selectedTool.cost>state.cash){hint('现金不足以支付本次测试。免费观察仍可使用，也可以谨慎拒收。');return;}
 busy=true;$('#buy').disabled=$('#reject').disabled=true;const progress=$('#test-progress');progress.hidden=false;progress.value=0;hint(`${selectedTool.name}检测中…`);
 const duration=selectedTool.cost?850:180,start=performance.now();
 await new Promise(resolve=>{timer=setInterval(()=>{progress.value=Math.min(100,(performance.now()-start)/duration*100);if(performance.now()-start>=duration){clearInterval(timer);timer=null;resolve();}},40);});
 if(destroyed)return;
 state.cash-=selectedTool.cost;state.inspectionCost+=selectedTool.cost;state.realized-=selectedTool.cost;
 state.tests[key]={title:`${selectedTool.name} / ${PARTS[part]}`,text:observation(CUSTOMERS[state.index],requestedTool,part),cost:selectedTool.cost};
 busy=false;$('#buy').disabled=$('#reject').disabled=false;progress.hidden=true;showObservation(key);updateLedger();save();tone('done');hint('检测完成。可加入记录，或继续检查其他部位。');
}
function renderReport(report){
 const host=$('#settlement');host.replaceChildren();host.hidden=false;host.append(text('p','本次交易结算','kicker'),text('h2',report.decision==='buy'?'设备已收入库存':'已礼貌谢绝收购'),text('p',report.summary));
 const facts=document.createElement('dl');facts.className='report-facts';
 for(const [name,value] of [ ['收购支出',report.quote],['检测实际支出',report.cost],['整备预算（尚未支出）',report.decision==='buy'?report.refurb:'未收购'],['预计转售价值',report.value],['预计净收益（若完成整备并售出）',report.estimated??'未收购'],['本笔已实现损益',report.realized],['声誉变化',`${report.reputation>=0?'+':''}${report.reputation}`] ]){facts.append(text('dt',name),text('dd',typeof value==='number'?`${money(value)} 模拟币`:value));}
 host.append(facts,text('p','库存尚未售出，预计净收益不计入现金或已实现损益。','micro'),text('p',report.reason,'micro'),text('p',report.missing.length?`未做的功能检测：${report.missing.join('、')}。`:'三项功能检测均已完成。','micro'));
 const button=text('button',state.index===CUSTOMERS.length-1?'查看本轮总结':'接待下一位','primary');button.id='next';button.addEventListener('click',()=>{state.index++;state.tests={};state.records=[];state.settlement=null;pendingObservation=null;state.quote=null;save();renderCustomer();tone();});host.append(button);
}
function renderSummary(){
 const host=$('#round-summary');host.hidden=false;host.replaceChildren(text('p','本轮营业结束','kicker'),text('h2','四段故事，新的声音。'),text('p',`处理 ${state.completed} 位顾客，收购 ${state.inventory.length} 台设备，现金余 ${money(state.cash)} 模拟币。`),text('p',`已实现损益 ${money(state.realized)} 模拟币（检测支出）。库存购入成本是资产投入，未按利润计入。`,'micro'));
 const potential=state.inventory.reduce((sum,item)=>sum+item.resale-item.purchase-item.refurbBudget,0)-state.inspectionCost;
 host.append(text('p',`若全部按预计价值售出并完成整备：预计总净收益 ${money(potential)} 模拟币。此数值尚未实现。`,'micro'),text('p','检测帮助你承担可解释的风险；谨慎拒收同样合理。没有唯一的标准答案。','micro'));
 state.history.forEach(r=>host.append(text('p',`${r.customer} · ${r.decision==='buy'?'收购':'拒收'} · 声誉 ${r.reputation>=0?'+':''}${r.reputation}`,'micro')));
}
function renderCustomer(){
 updateLedger();updateRecords();$('#welcome').hidden=state.started;$('#customer').hidden=!state.started||state.index>=CUSTOMERS.length;$('#decision').hidden=!state.started||!!state.settlement||state.index>=CUSTOMERS.length;$('#settlement').hidden=!state.settlement;$('#round-summary').hidden=state.index<CUSTOMERS.length;$('#observation').hidden=true;$('#test-progress').hidden=true;
 document.querySelectorAll('[data-tool],[data-part]').forEach(button=>button.disabled=!state.started||state.index>=CUSTOMERS.length||!!state.settlement);
 if(state.index>=CUSTOMERS.length){renderSummary();hint('本轮已完成，可查看库存或重新开始营业。');return;}
 const c=CUSTOMERS[state.index];shop?.load(c.truth);setTool('visual',false);$('#customer-number').textContent=`顾客 ${state.index+1} / ${CUSTOMERS.length}`;$('#customer-name').textContent=c.name;$('#customer-role').textContent=c.role;$('#customer-description').textContent=c.description;$('#avatar').textContent=c.initials;$('#avatar').style.background=c.color;$('#asking').textContent=money(c.ask);$('#accessory-claim').textContent=`附件自述：${c.accessoriesClaim}`;$('#quote').value=state.quote??c.ask;$('#quote-slider').value=state.quote??c.ask;$('#deal-message').textContent='';
 if(state.settlement)renderReport(state.settlement);else hint(state.started?'先旋转设备观察，再选工具并点击对应部位。工具检测后记入记录。':'点击“开始营业”，迎接第一位顾客。');
}
function decide(action){if(busy||!state.started||state.settlement)return;const result=settle(state,action,Number($('#quote').value));if(result.error){$('#deal-message').textContent=result.error;tone();return;}save();renderCustomer();tone('done');$('#settlement').scrollIntoView({behavior:'smooth',block:'nearest'});}
$('#start').addEventListener('click',()=>{state.started=true;save();renderCustomer();tone('done');});
$('#mute').addEventListener('click',()=>{state.muted=!state.muted;if(state.muted)audio?.suspend();else tone();save();updateLedger();});
$('#record').addEventListener('click',()=>{if(!pendingObservation||state.records.includes(pendingObservation))return;state.records.push(pendingObservation);updateRecords();showObservation(pendingObservation);save();tone();});
$('#buy').addEventListener('click',()=>decide('buy'));$('#reject').addEventListener('click',()=>decide('reject'));
$('#restart').addEventListener('click',()=>{if(busy){hint('请等待当前检测完成再重新开始。');return;}if(state.started&&!confirm('重新开始会清除本轮游戏进度和库存，确定重新营业吗？'))return;const muted=state.muted;state=freshState();state.muted=muted;save();renderCustomer();window.scrollTo({top:0,behavior:'smooth'});});
$('#quote').addEventListener('input',()=>{state.quote=Number($('#quote').value);$('#quote-slider').value=state.quote;save();});$('#quote-slider').addEventListener('input',()=>{state.quote=Number($('#quote-slider').value);$('#quote').value=state.quote;save();});$('#ask-price').addEventListener('click',()=>{if(!CUSTOMERS[state.index])return;state.quote=CUSTOMERS[state.index].ask;$('#quote').value=state.quote;$('#quote-slider').value=state.quote;save();});
 document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>setTool(button.dataset.tool)));
 document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{shop?.setView(button.dataset.view);tone();}));
 document.querySelectorAll('[data-part]').forEach(button=>button.addEventListener('click',()=>{const p=button.dataset.part;if(p==='back')shop?.setView('back');if(p==='usb')shop?.setView('ports');if(p==='headphone')shop?.setView('top');if(p==='screen')shop?.setView('front');inspect(tool,p);}));
 $('#zoom-in').addEventListener('click',()=>shop?.zoom(-.35));$('#zoom-out').addEventListener('click',()=>shop?.zoom(.35));
try {shop=createShop($('#scene'),inspect,hint);$('#scene-loading').hidden=true;renderCustomer();if(loaded.error)$('#save-status').textContent=loaded.error;else $('#save-status').textContent=state.started?'已恢复上次营业进度。':'点击开始营业，游戏进度将自动保存。';}
catch(e){$('#scene-loading').hidden=true;$('#scene-error').hidden=false;$('#scene-error').textContent=e.message;$('#start').disabled=true;$('#save-status').textContent='3D 引擎未启动，游戏没有开始。';}
// Inspectable runtime facts for local verification; no real identities or market data.
window.HifiGame={diagnostics:()=>shop?.diagnostics(),pointFor:part=>shop?.pointFor(part),snapshot:()=>structuredClone(state)};
window.addEventListener('pagehide',event=>{if(!event.persisted){destroyed=true;if(timer)clearInterval(timer);audio?.close();shop?.dispose();}else audio?.suspend();});
