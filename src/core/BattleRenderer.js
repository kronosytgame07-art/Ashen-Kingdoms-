export class BattleRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  viewport() { return { width: this.canvas.clientWidth, height: this.canvas.clientHeight }; }

  ground(time) {
    const c = this.ctx;
    const vp = this.viewport();
    const grad = c.createRadialGradient(vp.width*.5,vp.height*.48,20,vp.width*.5,vp.height*.5,vp.width*.7);
    grad.addColorStop(0,'#35283e'); grad.addColorStop(.55,'#211925'); grad.addColorStop(1,'#0d0a10');
    c.fillStyle=grad; c.fillRect(0,0,vp.width,vp.height);
    c.save(); c.globalAlpha=.22;
    for(let i=0;i<70;i++){
      const x=(i*137+time*.012*(i%4+1))%vp.width;
      const y=(i*71)%vp.height;
      c.fillStyle=i%5?'#8f728f':'#c57bff';
      c.fillRect(x,y,1.4,1.4);
    }
    c.restore();
    c.strokeStyle='rgba(146,104,164,.16)'; c.lineWidth=1;
    for(let x=40;x<vp.width;x+=64){c.beginPath();c.moveTo(x,0);c.lineTo(x-120,vp.height);c.stroke();}
    for(let y=40;y<vp.height;y+=50){c.beginPath();c.moveTo(0,y);c.lineTo(vp.width,y+120);c.stroke();}
  }

  drawBuilding(b) {
    const c=this.ctx;
    const hp=Math.max(0,b.hp/b.maxHp);
    c.save(); c.translate(b.x,b.y);
    c.beginPath(); c.ellipse(0,b.radius*.55,b.radius*1.15,b.radius*.48,0,0,Math.PI*2);
    c.fillStyle='rgba(0,0,0,.45)'; c.fill();
    const body=b.type==='runeTower'?'#30243a':b.type==='townHall'?'#241b2c':'#3a2d35';
    const accent=b.type==='runeTower'?'#b982ff':b.type==='townHall'?'#d083ff':'#b65a69';
    c.fillStyle=body; c.strokeStyle='#0d0a10'; c.lineWidth=3;
    c.fillRect(-b.radius*.72,-b.radius,b.radius*1.44,b.radius*1.35);
    c.strokeRect(-b.radius*.72,-b.radius,b.radius*1.44,b.radius*1.35);
    c.shadowColor=accent; c.shadowBlur=12;
    c.fillStyle=accent; c.fillRect(-b.radius*.18,-b.radius*.55,b.radius*.36,b.radius*.4); c.shadowBlur=0;
    c.fillStyle='rgba(0,0,0,.72)'; c.fillRect(-b.radius,-b.radius-14,b.radius*2,6);
    c.fillStyle=hp>.5?'#79dc9e':hp>.25?'#e1b65b':'#d85461';
    c.fillRect(-b.radius,-b.radius-14,b.radius*2*hp,6);
    c.restore();
  }

  drawUnit(u) {
    const c=this.ctx;
    const hp=Math.max(0,u.hp/u.maxHp);
    c.save(); c.translate(u.x,u.y); c.globalAlpha=u.dead?.25:1;
    c.beginPath();
    c.arc(0,0,u.type==='ghoul'?12:u.type==='necromancer'?10:9,0,Math.PI*2);
    c.fillStyle=u.type==='ghoul'?'#806e58':u.type==='necromancer'?'#9c6dde':'#d2ced7';
    c.fill(); c.strokeStyle='#17121b'; c.lineWidth=2; c.stroke();
    c.fillStyle='rgba(0,0,0,.7)'; c.fillRect(-12,-18,24,4);
    c.fillStyle='#6fd69a'; c.fillRect(-12,-18,24*hp,4);
    c.restore();
  }

  drawEffects(effects) {
    const c=this.ctx;
    for(const fx of effects){
      c.save(); c.globalAlpha=Math.max(0,fx.life/.35);
      c.strokeStyle=fx.kind==='shot'?'#c88cff':'#ff9b7a'; c.lineWidth=3;
      c.beginPath(); c.arc(fx.x,fx.y,18*(1-fx.life/.35)+4,0,Math.PI*2); c.stroke();
      c.restore();
    }
  }

  render(battle, time) {
    this.ground(time);
    battle.buildings.filter(b=>b.hp>0).forEach(b=>this.drawBuilding(b));
    battle.deployed.forEach(u=>this.drawUnit(u));
    this.drawEffects(battle.effects);
  }
}
