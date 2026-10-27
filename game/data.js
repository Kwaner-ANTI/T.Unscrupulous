// All characters, prices and specifications are fictional game values.
export const DEVICE = {
  id: 'atelier-p1', name: 'ATELIER P1', category: '虚构便携数字音频播放器',
  modelPath: null, scale: 1, rotation: [0,0,0],
  inspectionPoints: { screen:[0,.2,.19], body:[.43,-.55,.15], back:[0,0,-.17], headphone:[-.24,.905,0], usb:[0,-.92,0], knob:[.56,.58,0] }
};
export const CUSTOMERS = [
 { id:'lin', name:'林初', role:'搬家整理', initials:'林', color:'#d5a36d',
   description:'一直戴保护套，最近换了桌面系统。这台播放器我每天听，工作正常。', ask:620, minimum:540, accessoriesClaim:'原盒、线材、收纳袋都在。',
   truth:{ wear:'clean', battery:92, hours:7.4, headphone:'good', usb:'good', accessories:'原盒、USB 线、收纳袋齐全', resale:930, refurb:35, summary:'保养良好，功能正常。轻度清洁即可重新上架。' } },
 { id:'chen', name:'陈墨', role:'老随身听爱好者', initials:'陈', color:'#9da98a',
   description:'外壳有磨损，背面我没贴膜。听歌和充电都正常，外观你可以仔细看。', ask:450, minimum:360, accessoriesClaim:'只有线材和布袋，没有盒子。',
   truth:{ wear:'worn', battery:83, hours:6.5, headphone:'good', usb:'good', accessories:'USB 线、布袋；无原盒（与描述一致）', resale:730, refurb:45, summary:'背面划痕、边角磨损明显，功能正常。磨损已反映在模拟转售价中。' } },
 { id:'xu', name:'许禾', role:'通勤换机', initials:'许', color:'#d08b77',
   description:'外观还挺新。最近用得不多，续航没有认真计时，想请你帮忙看看。', ask:680, minimum:450, accessoriesClaim:'原盒和充电线都有。',
   truth:{ wear:'clean', battery:41, hours:2.1, headphone:'good', usb:'good', accessories:'原盒、USB 线齐全', resale:830, refurb:210, summary:'外观整洁，但电池老化。整备预算含更换电池；并非肉眼可判断。' } },
 { id:'zhou', name:'周遥', role:'代朋友整理器材', initials:'周', color:'#a4a2bf',
   description:'朋友说是全套，我还没逐件核对。最近一直用蓝牙听，插线状态我不确定。', ask:520, minimum:300, accessoriesClaim:'据说有盒子和原装线，需要现场核对。',
   truth:{ wear:'port', battery:78, hours:5.8, headphone:'good', usb:'intermittent', accessories:'仅一根替代 USB 线，无原盒；与转述不符', resale:680, refurb:190, summary:'USB 插座有变形且连接间歇中断，包装缺失。需维修后如实说明再上架，不能直接推断卖家动机。' } }
];
export const TOOLS = {
 visual:{name:'放大观察',cost:0,parts:['screen','body','back','headphone','usb','knob']},
 battery:{name:'电池负载仪',cost:12,parts:['screen']},
 headphone:{name:'耳机信号探针',cost:6,parts:['headphone']},
 usb:{name:'USB 连续性仪',cost:6,parts:['usb']},
 accessories:{name:'附件清点',cost:0,parts:['accessories']}
};
export const PARTS = {screen:'屏幕',body:'机身边角',back:'背板',headphone:'耳机接口',usb:'USB 接口',knob:'音量旋钮',accessories:'柜台附件'};
export function observation(customer,tool,part) {
 const t=customer.truth;
 if(tool==='battery')return `模拟负载检测：电池健康 ${t.battery}%，模拟续航 ${t.hours} 小时。${t.battery<60?'建议计入电池更换预算。':'当前读数稳定。'}（游戏工具模拟数据）`;
 if(tool==='headphone')return '耳机探针：左右声道输出稳定，插拔接触正常。（模拟测试）';
 if(tool==='usb')return t.usb==='good'?'USB 连续性测试：充电及数据握手稳定。（模拟测试）':'USB 连续性测试：轻微移动后出现间歇断连，建议检修插座。（模拟测试）';
 if(tool==='accessories')return `现场清点：${t.accessories}。`;
 if(part==='back')return t.wear==='worn'?'背板可见多条划痕，与卖家的磨损描述一致。':'背板涂层平整，未见明显划痕；无法据此判断内部状况。';
 if(part==='body')return t.wear==='worn'?'机身右下角有掉漆，模型上的浅色磨痕可见。':'机身边角未见明显磕碰。外观不代表电池或电路健康。';
 if(part==='usb')return t.wear==='port'?'USB 口边缘略有变形。外观线索需要用连续性仪进一步核对。':'USB 口未见明显变形。是否稳定需运行接口测试。';
 if(part==='screen')return '屏幕显示正常，玻璃未见明显裂纹。电池图标不是健康检测结果。';
 if(part==='knob')return '旋钮纹理完整，外部无明显缺损。';
 return '耳机接口外观干净，内部接触状态需使用信号探针检测。';
}
