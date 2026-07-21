class SinglePlayerGame {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.mode = 'single';
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.runner = null;

        // Configuration
        this.LOGIC_W = 1290; // Background image expected width
        this.LOGIC_H = 1092; // Background image expected height
        this.SCALE = 0.6; // Scale down for display

        this.canvas.width = this.LOGIC_W * this.SCALE;
        this.canvas.height = this.LOGIC_H * this.SCALE;

        // Matter.js settings
        this.engine.positionIterations = 12;
        this.engine.velocityIterations = 8;
        this.engine.world.gravity.y = 2; // Increased gravity

        this.fruits = [];
        this.particles = [];
        this.score = 0;
        this.gameOver = false;
        
        this.playerX = (560 + 1254) / 2;
        this.playerY = 93;  // cloud bottom aligns just above back frame (backTopY=170)
        this.PLAYER_MIN_X = 560;
        this.PLAYER_MAX_X = 1254;

        this.nextFruitIdx = Math.floor(Math.random() * 5);
        this.nextNextFruitIdx = Math.floor(Math.random() * 5);
        
        try {
            this.ranking = JSON.parse(localStorage.getItem('suika_ranking') || '[0,0,0,0,0]');
            if (!Array.isArray(this.ranking) || this.ranking.length !== 5) {
                this.ranking = [0,0,0,0,0];
            }
        } catch (e) {
            this.ranking = [0,0,0,0,0];
        }
        
        this.canDrop = true;
        this.lastDropTime = 0;

        this.createBoundaries();
        this.setupEvents();
    }

    createBoundaries() {
        // Floor inner edge is 1082. width = 200, so center is 1082 + 100 = 1182
        const floorW = 1274 - 540 + 400; // extend width to cover thick walls
        const floorX = 540 + (1274 - 540) / 2;
        const floorY = 1182;
        
        const floor = Bodies.rectangle(floorX, floorY, floorW, 200, { 
            isStatic: true, friction: 1.0, restitution: 0.05 
        });

        // Walls
        const wallH = 1092 + 500;
        // Left wall inner edge is 560. width = 200, center = 560 - 100 = 460
        const leftWall = Bodies.rectangle(460, wallH/2 - 250, 200, wallH, {
            isStatic: true, friction: 1.0, restitution: 0.05
        });
        // Right wall inner edge is 1254. width = 200, center = 1254 + 100 = 1354
        const rightWall = Bodies.rectangle(1354, wallH/2 - 250, 200, wallH, {
            isStatic: true, friction: 1.0, restitution: 0.05
        });

        Composite.add(this.world, [floor, leftWall, rightWall]);
    }

    setupEvents() {
        this.handleMouseMove = (e) => {
            if(this.gameOver) return;
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) / this.SCALE;
            // Bound mouse movement so dropX (mouseX - 45) doesn't hit walls (540, 1274)
            // min: 540 + 35 + 45 = 620
            // max: 1274 - 35 + 45 = 1284
            this.playerX = Math.max(620, Math.min(1284, mouseX));
        };

        this.handleMouseClick = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) / this.SCALE;
            const mouseY = (e.clientY - rect.top) / this.SCALE;

            if(this.gameOver) {
                // Restart button bounds: 730 <= x <= 1115 and 786 <= y <= 886
                if(mouseX >= 730 && mouseX <= 1115 && mouseY >= 786 && mouseY <= 886) {
                    this.stop();
                    SoundManager.playBGM();
                    startGame('single');
                }
                return;
            }
            
            const now = Date.now();
            if(this.canDrop && now - this.lastDropTime > 500) {
                this.dropFruit();
            }
        };

        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseClick);

        // Collision logic
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

                    // Score
                    this.score += FRUITS[bodyA.fruitIdx].score * 2;

                    // Remove old
                    Composite.remove(this.world, [bodyA, bodyB]);

                    SoundManager.playSE('fusion');

                    if (nextIdx < FRUITS.length) {
                        this.spawnFruitBody(nx, ny, nextIdx);
                    }
                    
                    // Particles
                    for(let p=0; p<15; p++) {
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

    dropFruit() {
        this.canDrop = false;
        this.lastDropTime = Date.now();
        SoundManager.playSE('drop');
        
        // Offset Y for dropping
        const dropY = this.playerY + 80;
        const dropX = this.playerX - 45;
        this.spawnFruitBody(dropX, dropY, this.nextFruitIdx, true);

        // Update next fruits
        this.nextFruitIdx = this.nextNextFruitIdx;
        this.nextNextFruitIdx = Math.floor(Math.random() * 5);

        setTimeout(() => {
            this.canDrop = true;
        }, 500);
    }

    spawnFruitBody(x, y, fruitIdx, isDrop=false) {
        const fruitData = FRUITS[fruitIdx];
        const img = ASSETS[fruitData.src];
        // Ratio of actual fruit to image size (accounts for transparent padding)
        const padRatios = [0.879, 0.938, 0.973, 0.964, 0.962, 0.962, 0.983, 0.915, 0.989, 0.886, 0.983];
        const padRatio = padRatios[fruitIdx] || 0.95;
        const radius = Math.max(img.width, img.height) / 4 * padRatio;

        const body = Bodies.circle(x, y, radius, {
            restitution: 0.05,
            friction: 0.8,
            density: 0.01
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

    checkGameOver() {
        const bodies = Composite.allBodies(this.world);
        for(let body of bodies) {
            if(body.fruitIdx !== undefined) {
                // topbar is at y=250 in logic coordinates
                if(body.position.y - body.radius < 250 && body.speed < 0.5) {
                    // It's static and above the top bar
                    if(!body.timeAboveLine) body.timeAboveLine = 0;
                    body.timeAboveLine += 1000/60; // assume 60fps
                    
                    if(body.timeAboveLine > 1000) { // 1 second
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
        this.gameOver = true;
        SoundManager.stopBGM();
        SoundManager.playSE('gameover');
        
        this.ranking.push(this.score);
        this.ranking.sort((a,b) => b - a);
        this.ranking = this.ranking.slice(0, 5);
        localStorage.setItem('suika_ranking', JSON.stringify(this.ranking));

        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        // keep mouse down listener for restart
    }

    start() {
        this.runner = Runner.create();
        Runner.run(this.runner, this.engine);
        this.animationFrame = requestAnimationFrame(() => this.update());
    }

    stop() {
        if(this.runner) Runner.stop(this.runner);
        if(this.animationFrame) cancelAnimationFrame(this.animationFrame);
        Engine.clear(this.engine);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mousedown', this.handleMouseClick);
    }

    update() {
        if(!this.gameOver) {
            this.checkGameOver();
        }
        this.draw();
        if(this.runner) {
            this.animationFrame = requestAnimationFrame(() => this.update());
        }
    }

    drawUI(ctx) {
        const elapsedSway = Date.now() / 1000;
        const offsetY1 = 6 * Math.sin(3 * elapsedSway);
        const offsetY2 = 6 * Math.sin(3 * elapsedSway + Math.PI);

        // Score Bubble
        const scorebaloon = ASSETS["img/scorebaloon.png"];
        const scoreX = 250;
        const scoreY = 280 + offsetY1;
        if(scorebaloon) {
            ctx.drawImage(scorebaloon, scoreX - scorebaloon.width/2, scoreY - scorebaloon.height/2);
            
            ctx.font = "bold 60px Meiryo, sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "white";
            ctx.strokeStyle = "rgba(100,50,0,0.5)";
            ctx.lineWidth = 6;
            ctx.strokeText(this.score, scoreX, scoreY + 15);
            ctx.fillText(this.score, scoreX, scoreY + 15);

            ctx.font = "bold 40px Meiryo, sans-serif";
            ctx.fillStyle = "white";
            const best = this.ranking && this.ranking.length > 0 ? this.ranking[0] : 0;
            ctx.strokeText(best, scoreX, scoreY + 105);
            ctx.fillText(best, scoreX, scoreY + 105);
        }

        // Next Bubble
        const nextbaloon = ASSETS["img/nextbaloon.png"];
        const nextX = 1600;
        const nextY = 280 + offsetY2;
        if(nextbaloon) {
            ctx.drawImage(nextbaloon, nextX - nextbaloon.width/2, nextY - nextbaloon.height/2);
            
            const nextImg = ASSETS[FRUITS[this.nextNextFruitIdx].src];
            if(nextImg) {
                const drawW = nextImg.width / 4;
                const drawH = nextImg.height / 4;
                ctx.drawImage(nextImg, nextX - drawW/2, nextY + 10 - drawH/2, drawW, drawH);
            }
        }
        this.drawRankingBoard(ctx);
        this.drawEvolutionRing(ctx);
    }

    drawRankingBoard(ctx) {
        const boardX = 250;
        const boardY = 700;
        const w = 400;
        const h = 420;
        const left = boardX - w/2;
        const top = boardY - h/2;

        ctx.fillStyle = "rgba(255, 255, 240, 0.95)";
        ctx.beginPath();
        ctx.roundRect(left, top, w, h, 40);
        ctx.fill();
        ctx.strokeStyle = "rgba(230, 210, 160, 1)";
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(left, top, w, h, 40);
        ctx.clip(); 
        ctx.fillStyle = "rgba(255, 230, 160, 0.4)";
        ctx.fillRect(left, top, w, 110);
        ctx.restore();

        ctx.textAlign = "center";
        ctx.fillStyle = "#6B4A2B";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.font = "bold 26px Meiryo, sans-serif";
        ctx.strokeText("本日", boardX, top + 45);
        ctx.fillText("本日", boardX, top + 45);
        
        ctx.font = "bold 34px Meiryo, sans-serif";
        ctx.strokeText("スコアランキング", boardX, top + 85);
        ctx.fillText("スコアランキング", boardX, top + 85);

        const rankColors = ["rgba(255, 223, 0, 0.4)", "rgba(192, 192, 192, 0.4)", "rgba(205, 127, 50, 0.4)", "transparent", "transparent"];
        const rankLabels = ["1", "2", "3", "4", "5"];
        for(let i=0; i<5; i++) {
            const y = top + 150 + i * 50;
            ctx.fillStyle = rankColors[i];
            ctx.fillRect(left, y - 35, w, 50);

            ctx.fillStyle = i < 3 ? "white" : "#A88A6B";
            ctx.font = "bold 28px Meiryo, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(rankLabels[i], left + 60, y + 2);
            
            ctx.fillStyle = i < 3 ? "#7A5A3B" : "#A88A6B";
            if (i === 1) ctx.fillStyle = "#4A6B9B";
            if (i === 2) ctx.fillStyle = "#9B5A4A";
            ctx.textAlign = "right";
            const s = (this.ranking && this.ranking[i] > 0) ? this.ranking[i] : "----";
            ctx.fillText(s, left + w - 50, y + 2);
        }
    }

    drawEvolutionRing(ctx) {
        const ringX = 1600;
        const ringY = 700;
        const rInner = 120;
        const rOuter = 200;

        // Arrow geometry: shaft starts at arrowInnerAngle, tip points at arrowTipAngle
        const arrowInnerAngle = -Math.PI/2 - 1.0 + Math.PI*2;  // where arc ends / shaft begins
        const arrowTipAngle   = -Math.PI/2 - 0.25 + Math.PI*2; // tip (pointing direction)
        const wingSize = 80; // how far wings extend beyond arc width

        ctx.save();
        ctx.beginPath();
        ctx.arc(ringX, ringY, rOuter, -Math.PI/2 + 0.3, arrowInnerAngle);
        // outer wing → tip → inner wing
        ctx.lineTo(ringX + Math.cos(arrowInnerAngle) * (rOuter + wingSize), ringY + Math.sin(arrowInnerAngle) * (rOuter + wingSize));
        ctx.lineTo(ringX + Math.cos(arrowTipAngle)   * ((rInner+rOuter)/2), ringY + Math.sin(arrowTipAngle)   * ((rInner+rOuter)/2));
        ctx.lineTo(ringX + Math.cos(arrowInnerAngle) * (rInner - wingSize), ringY + Math.sin(arrowInnerAngle) * (rInner - wingSize));
        ctx.lineTo(ringX + Math.cos(arrowInnerAngle) * rInner,              ringY + Math.sin(arrowInnerAngle) * rInner);
        ctx.arc(ringX, ringY, rInner, arrowInnerAngle, -Math.PI/2 + 0.3, true);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(ringX + rOuter, ringY, ringX - rOuter, ringY);
        gradient.addColorStop(0, "rgba(255, 230, 150, 0.7)");
        gradient.addColorStop(0.5, "rgba(255, 255, 150, 0.7)");
        gradient.addColorStop(1, "rgba(180, 255, 150, 0.8)");
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 6;
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.restore();

        const totalFruits = 11;
        const startAngle = -Math.PI / 2 + 0.4;
        // Place watermelon midway between arrowInnerAngle and arrowTipAngle
        const arrowMidAngle = (arrowInnerAngle + arrowTipAngle) / 2;
        const endAngle = arrowMidAngle; // watermelon centered inside arrow

        ctx.textAlign = "center";
        ctx.fillStyle = "#8B5A2B";
        ctx.font = "bold 38px Meiryo, sans-serif";
        ctx.strokeStyle = "white";
        ctx.lineWidth = 8;
        ctx.strokeText("シンカの輪", ringX, ringY - rOuter - 30);
        ctx.fillText("シンカの輪", ringX, ringY - rOuter - 30);

        for (let i = 0; i < totalFruits; i++) {
            const angle = startAngle + (i / (totalFruits - 1)) * (endAngle - startAngle);
            const rMid = (rInner + rOuter) / 2;
            const x = ringX + Math.cos(angle) * rMid;
            const y = ringY + Math.sin(angle) * rMid;

            const img = ASSETS[FRUITS[i].src];
            if (img) {
                // Scale so fruit fits within the arc band; last fruit (watermelon) slightly smaller
                const maxSize = (rOuter - rInner) * (i === totalFruits - 1 ? 0.75 : 0.7);
                const scale = maxSize / (img.width / 4);
                const drawW = (img.width / 4) * scale;
                const drawH = (img.height / 4) * scale;
                ctx.drawImage(img, x - drawW/2, y - drawH/2, drawW, drawH);
            }
        }
    }


    draw() {
        const ctx = this.ctx;
        ctx.save();
        ctx.scale(this.SCALE, this.SCALE);

        // Draw background
        const season = window.bgSeason || 'spring';
        const bg1 = ASSETS[`img/bg_${season}_1.png`];
        const bg2 = ASSETS[`img/bg_${season}_2.png`];
        const bg3 = ASSETS[`img/bg_${season}_3.png`];
        
        if (bg1 && bg2 && bg3) {
            const time = Date.now();
            const scrollSpeed = 0.03; 
            const W = 1920;
            const H = 1080;
            const totalWidth = W * 6;
            const offset = (time * scrollSpeed) % totalWidth;
            
            const images = [
                {img: bg1, flip: false}, {img: bg1, flip: true},
                {img: bg2, flip: false}, {img: bg2, flip: true},
                {img: bg3, flip: false}, {img: bg3, flip: true}
            ];

            for(let i = -1; i <= 2; i++) {
                let tileIndex = Math.floor(offset / W) + i;
                let drawX = (tileIndex * W) - offset;
                let wrappedIndex = tileIndex % 6;
                if (wrappedIndex < 0) wrappedIndex += 6;
                
                let item = images[wrappedIndex];
                if (item.flip) {
                    ctx.save();
                    ctx.translate(drawX + W, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(item.img, 0, 0, W, H);
                    ctx.restore();
                } else {
                    ctx.drawImage(item.img, drawX, 0, W, H);
                }
            }
        } else {
            const bg = ASSETS["img/background.png"];
            if(bg) ctx.drawImage(bg, 0, 0);
        }

        // Draw playing box
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

        draw3DBox(this.PLAYER_MIN_X, this.PLAYER_MAX_X, 250, 1082);

        this.drawUI(ctx);

        // Draw Player cloud
        const cloud = ASSETS["img/00cloud.png"];
        if(cloud) {
            // Align cloud bottom just above back frame top (backTopY = topY-depthY = 250-80 = 170)
            const cloudY = 170 - cloud.height - 10;
            ctx.drawImage(cloud, this.playerX - cloud.width/2, cloudY);
            
            if(this.canDrop && !this.gameOver) {
                const nextImg = ASSETS[FRUITS[this.nextFruitIdx].src];
                const drawW = nextImg.width / 4;
                const drawH = nextImg.height / 4;
                const dropX = this.playerX - 45;
                const dropY = this.playerY + 50;
                
                if (window.guideEnabled) {
                    ctx.beginPath();
                    ctx.moveTo(dropX, dropY + drawH/2);
                    ctx.lineTo(dropX, 1080); // Draw to bottom
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                
                ctx.drawImage(nextImg, dropX - drawW/2, dropY - drawH/2, drawW, drawH);
            }
        }

        // Draw Bodies
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
        ctx.beginPath();
        ctx.moveTo(this.PLAYER_MIN_X, 250);
        ctx.lineTo(this.PLAYER_MAX_X, 250);
        ctx.stroke();

        // Draw UI Elements (Next, Score)
        // Draw Game Over
        if(this.gameOver) {
            const gameoverImg = ASSETS["img/gameover.png"];
            if(gameoverImg) {
                ctx.drawImage(gameoverImg, 710, 460);
                
                // Draw scores on game over screen
                ctx.font = "bold 60px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "white";
                ctx.fillText(this.score.toString(), 920, 650);
                
                ctx.fillStyle = "rgb(232,211,145)";
                const bestScoreVal = Math.max(...this.ranking);
                ctx.fillText(bestScoreVal.toString(), 1050, 726);
            }
        }

        // Particles
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

        ctx.restore();
    }
}
