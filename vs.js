class VSGame {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.mode = 'vs';
        this.LOGIC_W = 2000;
        this.LOGIC_H = 1000;
        this.SCALE = 0.56; 

        this.canvas.width = this.LOGIC_W * this.SCALE;
        this.canvas.height = this.LOGIC_H * this.SCALE;

        this.initPhysics();

        this.fruits = [];
        this.particles = [];
        this.scoreP1 = 0;
        this.scoreP2 = 0;
        this.gameOver = false;
        this.loserPlayer = null;

        this.PLAYER_Y = 93; // cloud bottom aligns just above back frame (backTopY=170)

        // Match Pygame bounds: 100 to 814, 1186 to 1900
        this.P1_MIN_X = 100;
        this.P1_MAX_X = 814;
        this.p1X = (this.P1_MIN_X + this.P1_MAX_X) / 2;
        this.p1Progress = 100;
        this.p1NextIdx = Math.floor(Math.random() * 5);
        this.p1NextNextIdx = Math.floor(Math.random() * 5);
        this.p1LastDrop = 0;

        // P2 setup
        this.P2_MIN_X = 1186;
        this.P2_MAX_X = 1900;
        this.p2X = (this.P2_MIN_X + this.P2_MAX_X) / 2;
        this.p2Progress = 100;
        this.p2NextIdx = Math.floor(Math.random() * 5);
        this.p2NextNextIdx = Math.floor(Math.random() * 5);
        this.p2LastDrop = 0;

        this.INDICATOR_Y = 960; // Bottom of the screen
        this.PLAYER_SPEED = 500; // units per second

        this.keys = {};

        this.startTime = Date.now();
        this.gameDuration = 300; // 5 minutes

        this.createBoundaries();
        this.setupEvents();
    }

    initPhysics() {
        this.engine = Engine.create({
            positionIterations: 12,
            velocityIterations: 8
        });
        this.world = this.engine.world;
        this.fruitGroup = Body.nextGroup(true);
        this.engine.world.gravity.y = 2;
    }

    createBoundaries() {
        const floorY = 950;
        const topY = -200; // Start walls much higher to prevent falling out above visible box
        const w = 200; // Thicker walls to prevent tunneling
        const options = { isStatic: true, friction: 1.0, restitution: 0.05 };

        // Floor P1
        Composite.add(this.world, Bodies.rectangle(
            this.P1_MIN_X + (this.P1_MAX_X - this.P1_MIN_X)/2, 
            floorY + w/2, 
            this.P1_MAX_X - this.P1_MIN_X + w*2, 
            w, 
            options
        ));
        // P1 Left wall
        Composite.add(this.world, Bodies.rectangle(
            this.P1_MIN_X - w/2,
            topY + (floorY - topY)/2,
            w,
            floorY - topY + 500,
            options
        ));
        // P1 Right wall
        Composite.add(this.world, Bodies.rectangle(
            this.P1_MAX_X + w/2,
            topY + (floorY - topY)/2,
            w,
            floorY - topY + 500,
            options
        ));

        // Floor P2
        Composite.add(this.world, Bodies.rectangle(
            this.P2_MIN_X + (this.P2_MAX_X - this.P2_MIN_X)/2, 
            floorY + w/2, 
            this.P2_MAX_X - this.P2_MIN_X + w*2, 
            w, 
            options
        ));
        // P2 Left wall
        Composite.add(this.world, Bodies.rectangle(
            this.P2_MIN_X - w/2,
            topY + (floorY - topY)/2,
            w,
            floorY - topY + 500,
            options
        ));
        // P2 Right wall
        Composite.add(this.world, Bodies.rectangle(
            this.P2_MAX_X + w/2,
            topY + (floorY - topY)/2,
            w,
            floorY - topY + 500,
            options
        ));
    }

    setupEvents() {
        this.handleKeyDown = (e) => { this.keys[e.key.toLowerCase()] = true; };
        this.handleKeyUp = (e) => { this.keys[e.key.toLowerCase()] = false; };

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        Events.on(this.engine, 'collisionStart', (event) => {
            const pairs = event.pairs;
            for (let i = 0; i < pairs.length; i++) {
                const bodyA = pairs[i].bodyA;
                const bodyB = pairs[i].bodyB;

                if (bodyA.fruitIdx !== undefined && bodyA.fruitIdx === bodyB.fruitIdx && !bodyA.merged && !bodyB.merged) {
                    bodyA.merged = true;
                    bodyB.merged = true;

                    const nx = (bodyA.position.x + bodyB.position.x) / 2;
                    const ny = (bodyA.position.y + bodyB.position.y) / 2;
                    const nextIdx = bodyA.fruitIdx + 1;

                    const gained = FRUITS[bodyA.fruitIdx].score * 2;
                    if(nx < 1000) {
                        this.scoreP1 += gained;
                    } else {
                        this.scoreP2 += gained;
                    }

                    Composite.remove(this.world, [bodyA, bodyB]);
                    SoundManager.playSE('fusion');

                    if (nextIdx < FRUITS.length) {
                        this.spawnFruitBody(nx, ny, nextIdx);
                    }
                    
                    for(let p=0; p<10; p++) {
                        this.particles.push({
                            x: nx, y: ny,
                            vx: (Math.random() - 0.5) * 10,
                            vy: (Math.random() - 0.5) * 10,
                            life: 1.0
                        });
                    }
                }
            }
        });
    }

    dropFruit(playerNum) {
        const now = Date.now();
        if(playerNum === 1) {
            if(now - this.p1LastDrop < 800) return;
            this.p1LastDrop = now;
            this.p1Progress = 100;
            SoundManager.playSE('drop');
            // Spawn exactly at the carry fruit visual position
            const dropX = this.p1X - 45;
            const dropY = this.PLAYER_Y + 40;
            this.spawnFruitBody(dropX, dropY, this.p1NextIdx, true, 1);
            this.p1NextIdx = this.p1NextNextIdx;
            this.p1NextNextIdx = Math.floor(Math.random() * 5);
        } else {
            if(now - this.p2LastDrop < 800) return;
            this.p2LastDrop = now;
            this.p2Progress = 100;
            SoundManager.playSE('drop');
            // Spawn exactly at the carry fruit visual position
            const dropX = this.p2X - 45;
            const dropY = this.PLAYER_Y + 40;
            this.spawnFruitBody(dropX, dropY, this.p2NextIdx, true, 2);
            this.p2NextIdx = this.p2NextNextIdx;
            this.p2NextNextIdx = Math.floor(Math.random() * 5);
        }
    }

    spawnFruitBody(x, y, fruitIdx, isDrop=false) {
        const fruitData = FRUITS[fruitIdx];
        const img = ASSETS[fruitData.src];
        const padRatios = [0.879, 0.938, 0.973, 0.964, 0.962, 0.962, 0.983, 0.915, 0.989, 0.886, 0.983];
        const padRatio = padRatios[fruitIdx] || 0.95;
        const radius = Math.max(img.width, img.height) / 4 * padRatio;

        const body = Bodies.circle(x, y, radius, {
            restitution: 0.05, friction: 0.8, density: 0.01
        });
        body.fruitIdx = fruitIdx;
        body.radius = radius;
        body.merged = false;

        if (isDrop) {
            Body.setVelocity(body, { x: 0, y: 15 });
        }

        Composite.add(this.world, body);
        return body;
    }

    processInput(dt) {
        if(this.gameOver) return;

        if(this.keys['a']) this.p1X -= this.PLAYER_SPEED * dt;
        if(this.keys['s']) this.p1X += this.PLAYER_SPEED * dt;
        this.p1X = Math.max(this.P1_MIN_X + 95, Math.min(this.P1_MAX_X - 5, this.p1X));

        if(this.keys['l']) this.p2X -= this.PLAYER_SPEED * dt;
        if(this.keys[';'] || this.keys[':']) this.p2X += this.PLAYER_SPEED * dt;
        this.p2X = Math.max(this.P2_MIN_X + 95, Math.min(this.P2_MAX_X - 5, this.p2X));

        let elapsed = (Date.now() - this.startTime) / 1000;
        let speed;
        if (elapsed < 60) speed = 100 / 30; // 30 seconds to empty
        else if (elapsed < 120) speed = 100 / 20; // 20 seconds
        else if (elapsed < 180) speed = 100 / 10; // 10 seconds
        else if (elapsed < 240) speed = 100 / 5; // 5 seconds
        else speed = 100 / 3; // 3 seconds
        
        const prevP1 = this.p1Progress;
        const prevP2 = this.p2Progress;
        this.p1Progress -= speed * dt;
        this.p2Progress -= speed * dt;

        if (prevP1 > 0 && this.p1Progress <= 0) SoundManager.playSE('fusion');
        if (prevP2 > 0 && this.p2Progress <= 0) SoundManager.playSE('fusion');

        if(this.keys['v'] || this.p1Progress <= 0) this.dropFruit(1);
        if(this.keys['n'] || this.p2Progress <= 0) this.dropFruit(2);
    }

    checkGameOver() {
        const bodies = Composite.allBodies(this.world);
        for(let body of bodies) {
            if(body.fruitIdx !== undefined) {
                if(body.position.y - body.radius < 250 && body.speed < 0.5) {
                    if(!body.timeAboveLine) body.timeAboveLine = 0;
                    body.timeAboveLine += 1000/60; 
                    
                    if(body.timeAboveLine > 1000) { 
                        this.loserPlayer = body.position.x < 1000 ? 1 : 2;
                        this.setGameOver();
                        break;
                    }
                } else {
                    body.timeAboveLine = 0;
                }
            }
        }
    }

    setGameOver() {
        if(this.gameOver) return;
        this.gameOver = true;
        SoundManager.stopBGM();
        SoundManager.playSE('gameover');
        UI.gameOverPanel.classList.remove('hidden');
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }

    start() {
        this.runner = Runner.create();
        Runner.run(this.runner, this.engine);
        this.lastTime = Date.now();
        this.startTime = Date.now();
        this.animationFrame = requestAnimationFrame(() => this.update());
        UI.scoreVal.innerText = "";
    }

    stop() {
        if(this.runner) Runner.stop(this.runner);
        if(this.animationFrame) cancelAnimationFrame(this.animationFrame);
        Engine.clear(this.engine);
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }

    update() {
        const now = Date.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        
        if(this.startTime) {
            const elapsed = (now - this.startTime) / 1000;
            this.remaining = Math.max(0, 300 - elapsed);
            
            if (this.remaining <= 60 && this.remaining > 0 && !this.gameOver) {
                if (!this.lastHeartBeatTime) this.lastHeartBeatTime = 0;
                if (now - this.lastHeartBeatTime >= 1000) {
                    SoundManager.playSE('heart');
                    this.lastHeartBeatTime = now;
                }
            }
            
            if (this.remaining <= 60 && !this.alert60) {
                this.alert60 = true;
                this.alertImage = ASSETS["img/60second.png"];
                this.alertStartTime = now;
            }
            if (this.remaining <= 30 && !this.alert30) {
                this.alert30 = true;
                this.alertImage = ASSETS["img/30second.png"];
                this.alertStartTime = now;
            }

            if(this.remaining <= 0 && !this.gameOver) {
                this.loserPlayer = this.scoreP1 < this.scoreP2 ? 1 : 2;
                this.setGameOver();
            }
        }

        this.processInput(dt);

        if(!this.gameOver) {
            this.checkGameOver();
        }

        this.draw();
        if(this.runner) {
            this.animationFrame = requestAnimationFrame(() => this.update());
        }
    }

    draw() {
        const ctx = this.ctx;
        ctx.save();
        ctx.scale(this.SCALE, this.SCALE);

        const bg = ASSETS["img/background2.png"];
        if(bg) ctx.drawImage(bg, 0, 0, this.LOGIC_W, this.LOGIC_H);

        const draw3DBox = (minX, maxX, topY, floorY) => {
            const depthX = 40;
            const depthY = 80;
            const backMinX = minX + depthX;
            const backMaxX = maxX - depthX;
            const backTopY = topY - depthY;
            const backFloorY = floorY - depthY;

            ctx.lineJoin = "miter";
            ctx.lineCap = "round";

            // Back face
            ctx.strokeStyle = "rgba(243, 213, 127, 0.5)"; 
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(backMinX, backTopY);
            ctx.lineTo(backMinX, backFloorY - 15);
            ctx.lineTo(backMinX + 15, backFloorY);
            ctx.lineTo(backMaxX - 15, backFloorY);
            ctx.lineTo(backMaxX, backFloorY - 15);
            ctx.lineTo(backMaxX, backTopY);
            ctx.closePath();
            ctx.stroke();

            // Connecting lines
            ctx.strokeStyle = "rgba(243, 213, 127, 0.6)"; 
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(minX, topY); ctx.lineTo(backMinX, backTopY);
            ctx.moveTo(maxX, topY); ctx.lineTo(backMaxX, backTopY);
            ctx.moveTo(minX + 20, floorY); ctx.lineTo(backMinX + 15, backFloorY);
            ctx.moveTo(maxX - 20, floorY); ctx.lineTo(backMaxX - 15, backFloorY);
            ctx.stroke();

            // Front face fill
            ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
            ctx.beginPath();
            ctx.moveTo(minX, topY);
            ctx.lineTo(minX, floorY - 20);
            ctx.lineTo(minX + 20, floorY);
            ctx.lineTo(maxX - 20, floorY);
            ctx.lineTo(maxX, floorY - 20);
            ctx.lineTo(maxX, topY);
            ctx.fill();
            
            // Bottom translucent base 
            ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
            ctx.beginPath();
            ctx.moveTo(minX + 20, floorY);
            ctx.lineTo(backMinX + 15, backFloorY);
            ctx.lineTo(backMaxX - 15, backFloorY);
            ctx.lineTo(maxX - 20, floorY);
            ctx.fill();
            
            // Front face outline
            ctx.strokeStyle = "rgba(243, 213, 127, 1)";
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(minX, topY);
            ctx.lineTo(minX, floorY - 20);
            ctx.lineTo(minX + 20, floorY);
            ctx.lineTo(maxX - 20, floorY);
            ctx.lineTo(maxX, floorY - 20);
            ctx.lineTo(maxX, topY);
            ctx.stroke();
        };

        draw3DBox(this.P1_MIN_X, this.P1_MAX_X, 250, 950);
        draw3DBox(this.P2_MIN_X, this.P2_MAX_X, 250, 950);

        this.drawUI(ctx);

        const p1Img = ASSETS["img/player1.png"];
        const p2Img = ASSETS["img/player2.png"];
        // Available height below box: 950 to 1000 = 50px
        const keyAreaH = 45;
        if(p1Img) {
            const scale1 = keyAreaH / p1Img.height;
            const dw1 = p1Img.width * scale1;
            const dh1 = p1Img.height * scale1;
            const p1AreaCenterX = (this.P1_MIN_X + this.P1_MAX_X) / 2;
            ctx.drawImage(p1Img, p1AreaCenterX - dw1/2, 953, dw1, dh1);
        }
        if(p2Img) {
            const scale2 = keyAreaH / p2Img.height;
            const dw2 = p2Img.width * scale2;
            const dh2 = p2Img.height * scale2;
            const p2AreaCenterX = (this.P2_MIN_X + this.P2_MAX_X) / 2;
            ctx.drawImage(p2Img, p2AreaCenterX - dw2/2, 953, dw2, dh2);
        }

        const cloudImg = ASSETS["img/00cloud.png"];
        if(cloudImg) {
            // Align cloud bottom just above back frame top (backTopY = topY-depthY = 250-80 = 170)
            const cloudY = 170 - cloudImg.height - 10;
            ctx.drawImage(cloudImg, this.p1X - cloudImg.width/2, cloudY);
            ctx.drawImage(cloudImg, this.p2X - cloudImg.width/2, cloudY);
        }

        const p1Carry = ASSETS[FRUITS[this.p1NextIdx].src];
        if(p1Carry) {
            const dw = p1Carry.width / 4;
            const dh = p1Carry.height / 4;
            const dropX = this.p1X - 45;
            const dropY = this.PLAYER_Y + 40;
            
            if (window.guideEnabled && this.p1Progress > 0) {
                ctx.beginPath();
                ctx.moveTo(dropX, dropY + dh/2);
                ctx.lineTo(dropX, 950);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            ctx.drawImage(p1Carry, dropX - dw/2, dropY - dh/2, dw, dh);
        }
        
        const p2Carry = ASSETS[FRUITS[this.p2NextIdx].src];
        if(p2Carry) {
            const dw = p2Carry.width / 4;
            const dh = p2Carry.height / 4;
            const dropX = this.p2X - 45;
            const dropY = this.PLAYER_Y + 40;
            
            if (window.guideEnabled && this.p2Progress > 0) {
                ctx.beginPath();
                ctx.moveTo(dropX, dropY + dh/2);
                ctx.lineTo(dropX, 950);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            ctx.drawImage(p2Carry, dropX - dw/2, dropY - dh/2, dw, dh);
        }

        // Draw Alerts
        if (this.alertImage && (Date.now() - this.alertStartTime <= 3000)) {
            const img = this.alertImage;
            const dw = img.width / 2;
            const dh = img.height / 2;
            ctx.drawImage(img, this.LOGIC_W/2 - dw/2, 350 - dh/2, dw, dh);
        }

        const bodies = Composite.allBodies(this.world);
        for(let body of bodies) {
            if(body.fruitIdx !== undefined) {
                const img = ASSETS[FRUITS[body.fruitIdx].src];
                const padRatios = [0.879, 0.938, 0.973, 0.964, 0.962, 0.962, 0.983, 0.915, 0.989, 0.886, 0.983];
                const pr = padRatios[body.fruitIdx] || 0.95;
                // Draw slightly larger than physics radius to visually close Matter.js separation gaps
                const drawW = img.width / 2 * pr * 1.06;
                const drawH = img.height / 2 * pr * 1.06;
                ctx.save();
                ctx.translate(body.position.x, body.position.y);
                ctx.rotate(body.angle);
                ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
                ctx.restore();
            }
        }

        // Redraw front frame top edge OVER fruits
        ctx.lineJoin = "miter";
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(243, 213, 127, 1)";
        ctx.lineWidth = 10;
        const drawFrontTop = (minX, topY) => {
            ctx.beginPath();
            ctx.moveTo(minX, topY);
            ctx.lineTo(minX + 40, topY);
            ctx.stroke();
            const maxX = minX === this.P1_MIN_X ? this.P1_MAX_X : this.P2_MAX_X;
            ctx.beginPath();
            ctx.moveTo(maxX - 40, topY);
            ctx.lineTo(maxX, topY);
            ctx.stroke();
        };
        // Draw horizontal top line across full front width
        const drawFrontTopFull = (minX, maxX, topY) => {
            ctx.beginPath();
            ctx.moveTo(minX, topY);
            ctx.lineTo(maxX, topY);
            ctx.stroke();
        };
        drawFrontTopFull(this.P1_MIN_X, this.P1_MAX_X, 250);
        drawFrontTopFull(this.P2_MIN_X, this.P2_MAX_X, 250);

        const drawRainbowArc = (x, y, progress) => {
            const colors = [
                "rgb(255,0,0)", "rgb(255,127,0)", "rgb(255,255,0)", "rgb(0,255,0)",
                "rgb(0,0,255)", "rgb(75,0,130)", "rgb(148,0,211)"
            ];
            const maxR = 45;
            const minR = 30;
            const w = (maxR - minR) / colors.length;
            const midR = (maxR + minR) / 2;
            const thickness = maxR - minR;
            
            const startAngle = -120 * Math.PI / 180; 
            const fullEndAngle = startAngle + (60 * Math.PI / 180);
            const endAngle = startAngle + (progress / 100) * (60 * Math.PI / 180);

            ctx.save();
            
            // 1. Draw thick white background/outline (using lineCap="round")
            ctx.beginPath();
            ctx.arc(x, y, midR, startAngle, fullEndAngle);
            ctx.strokeStyle = "white";
            ctx.lineWidth = thickness + 6; // 3px border
            ctx.lineCap = "round";
            ctx.stroke();

            // 2. Create clipping path for the INNER rainbow area
            ctx.beginPath();
            ctx.arc(x, y, maxR, startAngle, fullEndAngle);
            ctx.arc(x + Math.cos(fullEndAngle)*midR, y + Math.sin(fullEndAngle)*midR, thickness/2, fullEndAngle, fullEndAngle + Math.PI);
            ctx.arc(x, y, minR, fullEndAngle, startAngle, true);
            ctx.arc(x + Math.cos(startAngle)*midR, y + Math.sin(startAngle)*midR, thickness/2, startAngle + Math.PI, startAngle + Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            // 3. Draw the rainbow colors
            ctx.lineCap = "butt";
            for (let i = 0; i < colors.length; i++) {
                ctx.beginPath();
                const r = maxR - (i + 0.5) * w;
                // Extend the drawing angle slightly to cover the rounded cap area
                ctx.arc(x, y, r, startAngle - 0.4, endAngle);
                ctx.strokeStyle = colors[i];
                ctx.lineWidth = w + 0.5; // slight overlap to prevent gaps
                ctx.stroke();
            }
            
            ctx.restore();
        };
        if(cloudImg) {
            drawRainbowArc(this.p1X + 65, this.PLAYER_Y + 70, 100 - this.p1Progress);
            drawRainbowArc(this.p2X + 65, this.PLAYER_Y + 70, 100 - this.p2Progress);
        }

        const partImg = ASSETS["img/twinkle.png"];
        for(let i = this.particles.length-1; i>=0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            if(p.life <= 0) {
                this.particles.splice(i, 1);
            } else {
                ctx.globalAlpha = p.life;
                if(partImg) {
                    ctx.drawImage(partImg, p.x - partImg.width/4, p.y - partImg.height/4, partImg.width/2, partImg.height/2);
                }
                ctx.globalAlpha = 1.0;
            }
        }

        // Game Over overlay
        if(this.gameOver && this.loserPlayer) {
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            let winCenterX = 0;
            if(this.loserPlayer === 1) {
                ctx.fillRect(0, 0, this.LOGIC_W/2, this.LOGIC_H);
                winCenterX = 3*this.LOGIC_W/4;
                const loseImg = ASSETS["img/lose.png"];
                if(loseImg) ctx.drawImage(loseImg, this.LOGIC_W/4 - loseImg.width/2, this.LOGIC_H/2 - loseImg.height/2);
            } else {
                ctx.fillRect(this.LOGIC_W/2, 0, this.LOGIC_W/2, this.LOGIC_H);
                winCenterX = this.LOGIC_W/4;
                const loseImg = ASSETS["img/lose.png"];
                if(loseImg) ctx.drawImage(loseImg, 3*this.LOGIC_W/4 - loseImg.width/2, this.LOGIC_H/2 - loseImg.height/2);
            }
            
            // Searchlights
            const t = Date.now() / 1000;
            const drawSearchLight = (originX, targetX) => {
                ctx.beginPath();
                ctx.moveTo(originX, 0);
                ctx.lineTo(targetX - 250, this.LOGIC_H);
                ctx.lineTo(targetX + 250, this.LOGIC_H);
                ctx.closePath();
                const grad = ctx.createLinearGradient(0, 0, 0, this.LOGIC_H);
                grad.addColorStop(0, 'rgba(255, 255, 100, 0.8)');
                grad.addColorStop(1, 'rgba(255, 255, 100, 0.0)');
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.fillStyle = "#FFD700";
                ctx.beginPath();
                ctx.arc(originX, 0, 30, 0, Math.PI);
                ctx.fill();
            };
            drawSearchLight(winCenterX - 180, winCenterX + Math.sin(t * 2) * 200);
            drawSearchLight(winCenterX + 180, winCenterX + Math.sin(t * 2.5 + Math.PI) * 200);
            
            // Confetti
            if (!this.confetti) {
                this.confetti = [];
                const colors = ["#ff0", "#f00", "#0f0", "#00f", "#f0f", "#0ff", "#fff"];
                for (let i = 0; i < 100; i++) {
                    this.confetti.push({
                        x: winCenterX - 350 + Math.random() * 700,
                        y: -Math.random() * 800,
                        vx: (Math.random() - 0.5) * 4,
                        vy: Math.random() * 3 + 3,
                        size: Math.random() * 8 + 6,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        angle: Math.random() * Math.PI * 2,
                        spin: (Math.random() - 0.5) * 0.2
                    });
                }
            }
            for (let i = 0; i < this.confetti.length; i++) {
                let c = this.confetti[i];
                c.x += c.vx;
                c.y += c.vy;
                c.angle += c.spin;
                if (c.y > this.LOGIC_H) {
                    c.y = -50;
                    c.x = winCenterX - 350 + Math.random() * 700;
                }
                ctx.save();
                ctx.translate(c.x, c.y);
                ctx.rotate(c.angle);
                ctx.fillStyle = c.color;
                ctx.fillRect(-c.size/2, -c.size/2, c.size, c.size);
                ctx.restore();
            }
            
            // WIN image
            const winImg = ASSETS["img/win.png"];
            if(winImg) ctx.drawImage(winImg, winCenterX - winImg.width/2, this.LOGIC_H/2 - winImg.height/2);
        }

        ctx.restore();
        ctx.restore();
    }

    drawUI(ctx) {
        // Timer Background (Brown Pill)
        const timerW = 280;
        const timerH = 75;
        const timerX = this.LOGIC_W / 2;
        const timerY = 15; // Shifted up so top is cut off
        
        ctx.fillStyle = "#4A3B2C";
        ctx.beginPath();
        ctx.roundRect(timerX - timerW/2, 0, timerW, timerH, [0, 0, 35, 35]);
        ctx.fill();
        
        ctx.strokeStyle = "#D2A26F";
        ctx.lineWidth = 10;
        ctx.stroke();

        ctx.strokeStyle = "#4A3222";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(timerX - timerW/2 - 5, 0, timerW + 10, timerH + 5, [0, 0, 40, 40]);
        ctx.stroke();

        // Timer Text
        if (this.remaining !== undefined) {
            ctx.font = "bold 44px Meiryo, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const isLow = this.remaining <= 30;
            ctx.fillStyle = isLow ? "#F08080" : "#F4DC73";
            const timerText = "🕒 " + Math.floor(this.remaining / 60).toString().padStart(2, '0') + ":" + Math.floor(this.remaining % 60).toString().padStart(2, '0');
            
            ctx.lineWidth = 5;
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
            ctx.strokeText(timerText, timerX, 35);
            ctx.fillText(timerText, timerX, 35);
        }

        // Sway animation
        const elapsedSway = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
        const offsetY1 = 6 * Math.sin(3 * elapsedSway);
        const offsetY2 = 6 * Math.sin(3 * elapsedSway + Math.PI);

        // Score Bubbles
        const scoreBaloon = ASSETS["img/scorebaloon.png"];
        const drawScore = (x, y, color, score) => {
            const scale = 2.4;
            const bw = scoreBaloon ? scoreBaloon.width / scale : 140;
            const bh = scoreBaloon ? scoreBaloon.height / scale : 140;
            
            // Draw colored background behind balloon if needed
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, bw/2 * 0.9, 0, Math.PI*2);
            ctx.fill();
            
            if(scoreBaloon) {
                ctx.drawImage(scoreBaloon, x - bw/2, y - bh/2, bw, bh);
            } else {
                ctx.strokeStyle = "rgba(255,255,255,0.6)";
                ctx.lineWidth = 4;
                ctx.stroke();
            }
            
            ctx.fillStyle = "white";
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.lineWidth = 4;
            ctx.font = "bold 26px Meiryo, sans-serif";
            
            

            ctx.font = "bold 38px Meiryo, sans-serif";
            ctx.strokeText(score, x, y + 15);
            ctx.fillText(score, x, y + 15);
        };

        drawScore(this.LOGIC_W / 2 - 120, 180 + offsetY1, "rgba(255, 120, 120, 0.4)", this.scoreP1);
        drawScore(this.LOGIC_W / 2 + 120, 180 + offsetY2, "rgba(120, 150, 255, 0.4)", this.scoreP2);

        // Next Fruit Bubbles
        const nextBaloon = ASSETS["img/nextbaloon.png"];
        const nextP1Img = this.p1NextNextIdx !== undefined ? ASSETS[FRUITS[this.p1NextNextIdx].src] : null;
        const nextP2Img = this.p2NextNextIdx !== undefined ? ASSETS[FRUITS[this.p2NextNextIdx].src] : null;
        
        const drawNext = (x, y, img) => {
            const scale = 2.4;
            const bw = nextBaloon ? nextBaloon.width / scale : 140;
            const bh = nextBaloon ? nextBaloon.height / scale : 140;
            
            if(nextBaloon) {
                ctx.drawImage(nextBaloon, x - bw/2, y - bh/2, bw, bh);
            }
            if(img) {
                const drawW = img.width / 4;
                const drawH = img.height / 4;
                ctx.drawImage(img, x - drawW/2, y + 5 - drawH/2, drawW, drawH);
            }
            
            ctx.fillStyle = "white";
            ctx.strokeStyle = "rgba(100,50,0,0.5)";
            ctx.lineWidth = 4;
            ctx.font = "bold 24px Meiryo, sans-serif";
            
            
        };
        
        drawNext(this.LOGIC_W / 2 - 120, 360 + offsetY1, nextP1Img);
        drawNext(this.LOGIC_W / 2 + 120, 360 + offsetY2, nextP2Img);

        this.drawEvolutionRing(ctx);
    }

    drawEvolutionRing(ctx) {
        const ringX = this.LOGIC_W / 2;
        const ringY = 750;
        const rInner = 100;
        const rOuter = 170;

        ctx.save();
        ctx.beginPath();
        const arrowInnerAngle = -Math.PI/2 - 0.7 + Math.PI*2; // Base of arrow
        const arrowTipAngle = -Math.PI/2 - 0.5 + Math.PI*2;   // Tip of arrow (further clockwise)
        
        ctx.arc(ringX, ringY, rOuter, -Math.PI/2 + 0.3, arrowInnerAngle);
        
        ctx.lineTo(ringX + Math.cos(arrowInnerAngle) * (rOuter + 30), ringY + Math.sin(arrowInnerAngle) * (rOuter + 30));
        ctx.lineTo(ringX + Math.cos(arrowTipAngle) * ((rInner+rOuter)/2), ringY + Math.sin(arrowTipAngle) * ((rInner+rOuter)/2));
        ctx.lineTo(ringX + Math.cos(arrowInnerAngle) * (rInner - 30), ringY + Math.sin(arrowInnerAngle) * (rInner - 30));
        ctx.lineTo(ringX + Math.cos(arrowInnerAngle) * rInner, ringY + Math.sin(arrowInnerAngle) * rInner);
        
        ctx.arc(ringX, ringY, rInner, arrowInnerAngle, -Math.PI/2 + 0.3, true);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(ringX + rOuter, ringY, ringX - rOuter, ringY);
        gradient.addColorStop(0, "rgba(255, 230, 150, 0.7)"); 
        gradient.addColorStop(0.5, "rgba(255, 255, 150, 0.7)"); 
        gradient.addColorStop(1, "rgba(180, 255, 150, 0.8)"); 
        
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 5;
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.restore();

        const totalFruits = 11;
        const startAngle = -Math.PI / 2 + 0.4; 
        const endAngle = arrowTipAngle;
        
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#8B5A2B";
        ctx.font = "bold 30px Meiryo, sans-serif";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 6;
        ctx.strokeText("シンカの輪", ringX, ringY - rOuter - 25);
        ctx.fillText("シンカの輪", ringX, ringY - rOuter - 25);

        for (let i = 0; i < totalFruits; i++) {
            const angle = startAngle + (i / (totalFruits - 1)) * (endAngle - startAngle);
            const rMid = (rInner + rOuter) / 2;
            const x = ringX + Math.cos(angle) * rMid;
            const y = ringY + Math.sin(angle) * rMid;

            const img = ASSETS[FRUITS[i].src];
            if (img) {
                const scale = (rOuter - rInner) * 0.7 / (img.width / 4);
                const drawW = (img.width / 4) * scale;
                const drawH = (img.height / 4) * scale;
                ctx.drawImage(img, x - drawW/2, y - drawH/2, drawW, drawH);
            }
        }
    }

}