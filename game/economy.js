import { CUSTOMERS } from './data.js';
export const SAVE_KEY='hifi-shop-simulator-v01';
export const freshState=()=>({version:1,started:false,index:0,cash:5000,reputation:50,inventory:[],inspectionCost:0,realized:0,completed:0,history:[],tests:{},records:[],settlement:null,muted:false});
export function readSave(){
 try { const raw=localStorage.getItem(SAVE_KEY);if(!raw)return {state:freshState()};const s=JSON.parse(raw);
 if(s.version!==1 || !Number.isInteger(s.index)||s.index<0||s.index>CUSTOMERS.length||!Number.isFinite(s.cash)||s.cash<0||!Array.isArray(s.inventory)||!Array.isArray(s.history)||!Array.isArray(s.records)||!s.tests||!Number.isFinite(s.reputation)||!Number.isFinite(s.inspectionCost)||!Number.isFinite(s.realized)||!Number.isInteger(s.completed)) throw Error('存档格式无法识别');
 return {state:s}; }catch(e){return {state:freshState(),error:'本地存档无法读取，原内容未清除。可重新开始营业。'};}
}
export function settle(state,decision,quote){
 if(state.settlement)return {error:'这笔交易已经结算。'};
 const c=CUSTOMERS[state.index];if(!c)return {error:'本轮已结束。'};
 if(decision==='buy'&&(!Number.isFinite(quote)||quote<0||!Number.isInteger(quote)))return {error:'请输入非负整数报价。'};
 if(decision==='buy'&&quote>state.cash)return {error:'现金不足。可调整报价或谨慎拒收。'};
 if(decision==='buy'&&quote<c.minimum)return {error:`顾客暂不接受 ${quote} 模拟币。你可以继续检测、提高报价或拒收。`};
 const inspections=Object.keys(state.tests).filter(key=>!key.startsWith('visual:'));
 const criticalMissing=['battery:screen','headphone:headphone','usb:usb'].filter(key=>!state.tests[key]);
 let reputation=0,reason='谨慎拒收也是合理选择，声誉不扣分。';
 if(decision==='buy'){
  const issue=(c.truth.battery<60&&!state.tests['battery:screen'])||(c.truth.usb!=='good'&&!state.tests['usb:usb']);
  reputation=issue?-1:2;reason=issue?'收下了尚未检测出的功能隐患，需完成整备并在上架时披露。':'收购依据与检测相符；可维修的问题机同样有经营空间。';
  state.cash-=quote;state.inventory.push({device:c.id,name:'ATELIER P1',purchase:quote,resale:c.truth.resale,refurbBudget:c.truth.refurb,sold:false});
 }
 const cost=Object.values(state.tests).reduce((sum,r)=>sum+r.cost,0);
 const report={customer:c.name,decision,quote:decision==='buy'?quote:0,value:c.truth.resale,refurb:c.truth.refurb,cost,
 estimated:decision==='buy'?c.truth.resale-quote-c.truth.refurb-cost:null,realized:-cost,reputation,reason,summary:c.truth.summary,
 missing:criticalMissing.map(key=>({'battery:screen':'电池负载','headphone:headphone':'耳机信号','usb:usb':'USB 连续性'})[key]),inspections:inspections.length};
 state.reputation=Math.max(0,Math.min(100,state.reputation+reputation));state.completed++;state.history.push(report);state.settlement=report;return {report};
}
