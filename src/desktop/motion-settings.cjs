'use strict';

const actions = Object.freeze({greet:'招呼',tap:'点击反馈',happy:'开心',confused:'困惑'});
const intervals = Object.freeze([5000,8500,15000,25000]);
const defaultActions = ['greet','tap','happy'];

function normalizeMotion(data) {
  const items = Array.isArray(data?.actions) ? data.actions : defaultActions;
  return {
    enabled:data?.enabled!==false,
    actions:[...new Set(items.filter(item=>typeof item==='string' && Object.hasOwn(actions,item)))],
    intervalMs:intervals.includes(data?.intervalMs)?data.intervalMs:8500,
    matchPose:data?.matchPose!==false,
    collisions:data?.collisions!==false,
  };
}

function motionMenu(settings, change) {
  return {label:'动作设置',submenu:[
    {label:'随机动作',type:'checkbox',checked:settings.enabled,click:item=>change({enabled:item.checked})},
    {label:'参与随机',submenu:Object.entries(actions).map(([name,label])=>({label,type:'checkbox',
      checked:settings.actions.includes(name),click:item=>change({actions:item.checked?[...settings.actions,name]:
        settings.actions.filter(action=>action!==name)})}))},
    {label:'随机间隔',submenu:intervals.map(intervalMs=>({label:`${intervalMs/1000} 秒`,type:'radio',
      checked:settings.intervalMs===intervalMs,click:()=>change({intervalMs})}))},
    {label:'匹配回待机姿势',type:'checkbox',checked:settings.matchPose,click:item=>change({matchPose:item.checked})},
    {label:'碰撞反馈',type:'checkbox',checked:settings.collisions,click:item=>change({collisions:item.checked})},
  ]};
}

module.exports = { normalizeMotion, motionMenu };
