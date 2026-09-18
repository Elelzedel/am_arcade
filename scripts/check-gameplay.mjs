// Behavioural audit of every game's failure/recovery loop and prize-crane physics.
// Run against a dev server: node scripts/check-gameplay.mjs http://localhost:8093
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM || '/usr/bin/chromium', headless: true,
    args: ['--use-angle=vulkan','--enable-gpu','--ignore-gpu-blocklist','--enable-features=Vulkan','--autoplay-policy=no-user-gesture-required'],
});
try {
    const page = await browser.newPage();
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    page.on('console', m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(`${process.argv[2] || 'http://localhost:8080'}/?nolock&quality=low`);
    await page.waitForFunction(()=>window.arcade?.state==='intro');
    const results=await page.evaluate(()=>{
        const a=arcade;a.renderer.setAnimationLoop(null);
        let seed=151;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
        const results=[];
        const check=(value,message)=>{if(!value)throw Error(message);};
        const game=id=>a.cabinets.find(c=>c.meta.id===id).game;
        const start=g=>{g.setActive(true);g.startGame();g.setVolume(0);};
        const advance=(g,seconds,dt=1/60)=>{for(let t=0;t<seconds-1e-8;t+=dt)g.update(dt);};
        const until=(g,condition,seconds=12,dt=1/60)=>{for(let t=0;t<seconds&&!condition();t+=dt)g.update(dt);check(condition(),`${g.meta.id}: timed out (${g.state}/${g.phase})`);};
        function restart(g) {
            check(g.state==='gameover',`${g.meta.id}: no game over`);
            until(g,()=>g.state==='scores'||g.state==='initials',4);
            if(g.state==='initials') {
                // Submit a real initials entry through the same key path as the user.
                for(let i=0;i<3;i++){g.keyDown('Space',false);g.keyUp('Space');}
                check(g.state==='scores',`${g.meta.id}: initials did not submit`);
            }
            advance(g,7);check(g.state==='title',`${g.meta.id}: no return to title`);
            g.keyDown('Space',false);g.keyUp('Space');
            check(g.state==='playing'&&!g.demo&&g.score===0,`${g.meta.id}: restart failed`);
        }
        for(const c of a.cabinets.filter(c=>!c.broken)) {
            start(c.game);c.game.keyDown('KeyP',false);
            advance(c.game,.5);check(c.game.state==='paused',`${c.meta.id}: pause failed`);
            c.game.keyDown('KeyP',false);check(c.game.state==='playing',`${c.meta.id}: resume failed`);
            c.game.setPaused(true);const clock=c.game.time;c.game.frame(.05);check(c.game.time===clock,`${c.meta.id}: host pause leaked`);c.game.setPaused(false);
        }
        const star=game('star-swarm');
        for(const dt of [1/20,1/60]) {
            start(star);star.phase='wave';star.groupIndex=0;
            // A shot crosses the hull between frames without either endpoint touching.
            star.enemyBullet(star.player.x+15,star.player.y-10,0,20/dt);
            star.update(dt);check(star.lives===2&&!star.player.alive,`Star Swarm: missed swept shot at ${1/dt}Hz`);
            star.enemies=[];until(star,()=>star.player.alive,8,dt);
            check(star.player.invuln>0,'Star Swarm: missing respawn protection');
            star.enemyBullet(star.player.x,star.player.y,0,0);star.update(dt);check(star.lives===2,'Star Swarm: respawn protection failed');
            star.clearEnemyBullets(false);star.player.invuln=0;star.player.shieldTime=12;
            star.enemyBullet(star.player.x,star.player.y,0,0);star.enemyBullet(star.player.x,star.player.y,0,0);
            star.update(dt);check(star.lives===2&&star.player.shieldTime===0&&star.player.invuln>0,'Star Swarm: shield should absorb one impact');
            star.clearEnemyBullets(false);
            while(star.lives>0) {
                if(!star.player.alive){star.enemies=[];until(star,()=>star.player.alive,9,dt);}
                star.player.invuln=0;star.enemyBullet(star.player.x,star.player.y-2,0,50);star.update(dt);
            }
            until(star,()=>star.state==='gameover',4,dt);restart(star);
        }
        start(star);const ram=star.makeEnemy('bee',0,0);
        Object.assign(ram,{state:'diving',x:435,y:star.player.y,px:365,py:star.player.y});star.enemies=[ram];star.updateBullets(.05);
        check(star.lives===2&&!star.player.alive,'Star Swarm: missed swept enemy ram');
        star.enemies=[{state:'diving',minion:false}];
        for(let i=0;i<160;i++)star.updateRespawn(.05);
        check(star.player.alive,'Star Swarm: busy sky blocks respawn indefinitely');
        start(star);star.phase='wave';const enemy=star.makeEnemy('bee',0,0);enemy.state='formation';enemy.x=400;enemy.y=300;star.enemies=[enemy];
        star.playerBullets.push({x:400,y:315,vx:0,vy:-820});star.updateBullets(1/30);
        check(enemy.state==='dead'&&star.score>0,'Star Swarm: bullet kill/scoring failed');
        // Boss shots use the same collision path, and a defeated boss awards once.
        const beforeWave=star.wave;star.enemies=[];star.groupIndex=star.plan.groups.length;star.updatePhase(.05);advance(star,2);
        check(star.wave===beforeWave+1,'Star Swarm: wave progression failed');
        // Natural, unassisted gameplay must also end; no direct damage calls.
        for(let run=0;run<3;run++){start(star);until(star,()=>star.state==='gameover',150);}
        start(star);star.startWave(5);until(star,()=>star.boss?.state==='fight',7);
        const boss=star.boss;
        for(let i=0;i<boss.maxHp;i++){star.playerBullets.push({x:boss.x,y:boss.y,vx:0,vy:-820});star.updateBullets(0);}
        check(boss.hp===0&&boss.state==='dying','Star Swarm: boss cannot be defeated');
        until(star,()=>star.wave===6,6);check(star.score===5000,'Star Swarm: boss score duplicated or missing');
        // Challenge fly-bys intentionally do not hurt the ship.
        start(star);star.startWave(3);star.phase='wave';const flyby=star.makeEnemy('bee',0,0);
        Object.assign(flyby,{state:'entering',challenge:true,x:star.player.x,y:star.player.y,px:star.player.x,py:star.player.y});
        star.enemies=[flyby];star.updateBullets(.05);check(star.lives===3,'Star Swarm: challenge fly-by damaged player');
        results.push('Star Swarm: swept hits, shield, respawn, three-life loss, natural deaths, score, next wave, boss, challenge safety and restart');

        const brick=game('brick-blitz');start(brick);
        const target=[...brick.grid].reverse().find(b=>b?.alive&&b.kind!=='gold'&&b.kind!=='metal');
        const shot=brick.makeBall(target.x+target.w/2,target.y+target.h+12);shot.vx=0;shot.vy=-400;brick.balls=[shot];brick.updateBalls(.05);
        check(!target.alive&&brick.score>0,'Brick Blitz: brick collision/scoring failed');
        // Losing one ball from multiball must keep the life and remaining ball.
        const survivor=brick.makeBall(400,400);survivor.vy=-300;
        const lost=brick.makeBall(100,630);lost.vy=300;brick.balls=[survivor,lost];brick.updatePlay(.05);
        check(brick.lives===3&&brick.balls.length===1,'Brick Blitz: multiball life error');
        for(let n=0;n<3;n++){const b=brick.makeBall(100,630);b.vy=300;brick.balls=[b];brick.update(.05);until(brick,()=>brick.phase!=='dying',3);}
        check(brick.lives===0,'Brick Blitz: life count');restart(brick);
        for(const b of brick.grid.filter(Boolean))if(b.kind!=='gold') {while(b.alive)brick.damageBrick(b,true);}
        brick.update(.05);until(brick,()=>brick.level===2,4);
        check(brick.balls.length>0,'Brick Blitz: next level has no ball');
        results.push('Brick Blitz: brick hits, multiball, three misses, game over, restart, round progression');

        const snake=game('neon-snake');start(snake);snake.beginPlay();
        const head=snake.body[0];const dx=[0,1,0,-1],dy=[-1,0,1,0];
        snake.food={x:head.x+dx[snake.dir],y:head.y+dy[snake.dir],age:0};snake.tick();
        check(snake.score>0&&snake.grow>0,'Neon Snake: eating/scoring failed');
        const dir=snake.dir;snake.queueTurn((dir+2)%4);check(snake.queue.length===0,'Neon Snake: allowed reversal');
        until(snake,()=>snake.state==='gameover',90);check(snake.lives===0,'Neon Snake: wall collisions not fatal');restart(snake);
        // A vacating tail is legal, but the same square is occupied while growing.
        const square=()=>{snake.beginPlay();snake.walls.fill(0);snake.portalMap.fill(-1);snake.food=null;
            snake.body=[{x:5,y:5},{x:5,y:6},{x:6,y:6},{x:6,y:5}];snake.dir=1;snake.occ.fill(0);snake.grow=0;
            for(const p of snake.body)snake.occ[p.y*32+p.x]++;};
        square();snake.tick();check(snake.phase==='play','Neon Snake: vacating tail incorrectly fatal');
        square();snake.grow=1;snake.tick();check(snake.phase==='dying','Neon Snake: missed self collision');
        square();snake.body[0]={x:0,y:5};snake.dir=3;snake.tick();
        check(snake.phase==='dying','Neon Snake: escaped array boundary');
        start(snake);snake.beginPlay();snake.eaten=snake.needed-1;
        const h=snake.body[0];snake.food={x:h.x+dx[snake.dir],y:h.y+dy[snake.dir],age:0};snake.tick();
        until(snake,()=>snake.levelNum===2,6);
        check(snake.food&&snake.body.length>0,'Neon Snake: next level failed');
        results.push('Neon Snake: eating/growth, turn buffering, wall/self collisions, vacating tail, loss, restart and next level');

        const racer=game('neon-racer');start(racer);
        // Closed gate at the ship's current position exercises real obstacle clearance.
        while(!racer.crashed){
            racer.invuln=0;racer.obstacles.addRing(racer.distance,{r:.1});racer.checkPasses();
        }
        check(racer.shields===0,'Neon Racer: shields never deplete');until(racer,()=>racer.state==='gameover',5);restart(racer);
        racer.obstacles.clear();racer.prevDistance=0;racer.distance=10;racer.prevPx=6;racer.px=0;racer.prevPy=racer.py=0;
        const shields=racer.shields;racer.obstacles.addRing(5,{r:2});racer.checkPasses();
        check(racer.shields===shields-1,'Neon Racer: missed collision between steering samples');start(racer);
        const old=racer.score;advance(racer,1);check(racer.distance>0&&racer.score>old,'Neon Racer: distance/scoring failed');
        racer.keys.add('Space');const boost=racer.boost;advance(racer,.2);check(racer.boost<boost,'Neon Racer: boost does not drain');racer.keys.clear();
        results.push('Neon Racer: obstacle collision, shield depletion, crash, restart, distance score and boost');

        const tank=game('tank-artillery');start(tank);until(tank,()=>tank.phase==='aim',4);
        tank.fire(tank.current);check(tank.projectiles.length>0,'Tank Artillery: no projectile');
        const projectile=tank.projectiles[0],enemyTank=tank.tanks[1];
        tank.detonate({type:'tank',x:enemyTank.cx,y:enemyTank.cy,tank:enemyTank},projectile);
        check(enemyTank.hp<100&&tank.score>0,'Tank Artillery: direct hit did not damage/score');
        tank.projectiles=[];
        while(enemyTank.alive)tank.detonate({type:'tank',x:enemyTank.cx,y:enemyTank.cy,tank:enemyTank},projectile);
        tank.resolveTurn();until(tank,()=>tank.stage===2,9);
        check(tank.tanks[0].alive&&tank.tanks[1].alive,'Tank Artillery: next stage failed');
        const playerTank=tank.tanks[0];projectile.owner=tank.tanks[1];
        while(playerTank.alive)tank.detonate({type:'tank',x:playerTank.cx,y:playerTank.cy,tank:playerTank},projectile);
        tank.projectiles=[];tank.resolveTurn();until(tank,()=>tank.state==='gameover',4);restart(tank);
        // Let real timed human turns and CPU ballistic aiming run together.
        let turnChanges=0,lastTurn=tank.turn,shots=0;
        for(let i=0;i<60*240&&tank.state==='playing';i++){
            tank.update(1/60);shots=Math.max(shots,tank.stats.shots);
            if(tank.turn!==lastTurn){turnChanges++;lastTurn=tank.turn;}
            check(tank.tanks.every(t=>Number.isFinite(t.x)&&Number.isFinite(t.y)&&t.hp>=0),'Tank Artillery: non-finite simulation');
            check(tank.phase!=='flight'||tank.phaseTime<19,'Tank Artillery: stuck projectile');
        }
        check(turnChanges>=2&&shots>0,'Tank Artillery: turn/CPU simulation stalled');
        results.push('Tank Artillery: fire, direct damage, scoring, enemy kill, stage progression, player loss, restart and timed CPU turns');

        const claw=a.room.props.find(p=>p.pile), pile=claw.pile;
        const makePile=()=>new pile.constructor({parent:new claw.group.constructor(),bounds:{...pile.bounds},hole:{...pile.hole}});
        for(const hz of [20,60,144]) {
            const sim=makePile();
            const base=sim.spawn(0,0,.1,1.12,-.1),top=sim.spawn(0,0,.1,1.42,-.1);
            for(let i=0;i<hz*8;i++)sim.update(1/hz);
            check(sim.settled,`Claw: pile never sleeps at ${hz}Hz`);
            for(const b of sim.bodies)check(b.pos.y>=sim.bounds.floorY+b.radius-.002&&b.pos.x<=sim.bounds.maxX-b.radius+.002,'Claw: boundary penetration');
            sim.remove(base);for(let i=0;i<hz*3;i++)sim.update(1/hz);
            check(Math.abs(top.pos.y-(sim.bounds.floorY+top.radius))<.004,`Claw: unsupported plush floats at ${hz}Hz`);
            const coincident=sim.spawn(0,0,top.pos.x,top.pos.y,top.pos.z);sim.wakeAll();
            for(let i=0;i<hz*4;i++)sim.update(1/hz);
            check(coincident.pos.distanceTo(top.pos)>(top.radius+coincident.radius)*.85,'Claw: coincident prizes never separate');
            let delivered=0;sim.onFall=b=>{delivered++;sim.remove(b);};
            sim.spawn(0,0,sim.hole.x,1.5,sim.hole.z);
            for(let i=0;i<hz*2;i++)sim.update(1/hz);
            check(delivered===1,`Claw: chute delivered ${delivered} prizes at ${hz}Hz`);
        }
        for(const hz of [20,60]) {
            const station=claw.station;station.setActive(true);
            station.setInput(new Set(['ArrowRight']));for(let i=0;i<hz*.4;i++)claw.update(1/hz,a.camera);
            station.setInput(new Set());for(let i=0;i<hz;i++)claw.update(1/hz,a.camera);
            for(const b of [...pile.bodies])pile.remove(b);
            const [x,,z]=claw.debug().claw;
            pile.spawn(0,0,x,pile.bounds.floorY+.10,z);
            for(let i=0;i<hz;i++)claw.update(1/hz,a.camera);
            const count=claw.prizeCount;const random=Math.random;Math.random=()=>.01;
            station.keyDown('Space',false);claw.update(1/hz,a.camera);
            station.setPaused(true);const frozen=JSON.stringify(claw.debug().claw);claw.update(.1,a.camera);
            check(JSON.stringify(claw.debug().claw)===frozen,'Claw: moves while paused');station.setPaused(false);
            let held=false;
            for(let i=0;i<hz*15;i++){claw.update(1/hz,a.camera);held ||= claw.debug().held;if(claw.prizeCount>count)break;}
            Math.random=random;
            check(held&&claw.prizeCount===count+1,`Claw: aligned grab did not deliver at ${hz}Hz: ${JSON.stringify(claw.debug())}`);
            for(let i=0;i<hz*3;i++)claw.update(1/hz,a.camera);
        }
        results.push('Claw: 20/60/144Hz settling, support removal, glass/floor bounds, chute delivery and complete player-controlled grabs');
        return results;
    });
    assert.deepEqual(errors,[]);
    console.log(results.join('\n'));
} finally { await browser.close(); }
