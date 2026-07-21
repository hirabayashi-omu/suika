const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Body = Matter.Body,
      Composite = Matter.Composite,
      Events = Matter.Events,
      Vector = Matter.Vector;

const FRUITS = [
    { src: "img/01cherry.png", score: 1 },
    { src: "img/02ichigo.png", score: 1 },
    { src: "img/03budo.png", score: 3 },
    { src: "img/04dekopon.png", score: 6 },
    { src: "img/05kaki.png", score: 10 },
    { src: "img/06ringo.png", score: 15 },
    { src: "img/07nashi.png", score: 21 },
    { src: "img/08momo.png", score: 28 },
    { src: "img/09pineapple.png", score: 36 },
    { src: "img/10melon.png", score: 45 },
    { src: "img/11suika.png", score: 55 }
];

const ASSETS = {};
let imagesLoaded = 0;
let totalImages = FRUITS.length + 6; // background, player, nextbaloon, scorebaloon, particle, win/lose... etc.

function preloadImages(callback) {
    const toLoad = [
        "img/background.png",
        "img/background2.png",
        "img/00cloud.png",
        "img/player1.png",
        "img/player2.png",
        "img/twinkle.png",
        "img/gameover.png",
        "img/win.png",
        "img/lose.png",
        "img/nextbaloon.png",
        "img/scorebaloon.png",
        "img/60second.png",
        "img/30second.png",
        "img/topbar.png"
    ];
    FRUITS.forEach(f => toLoad.push(f.src));

    let loadedCount = 0;
    toLoad.forEach(src => {
        const img = new Image();
        const checkDone = () => {
            loadedCount++;
            if(loadedCount === toLoad.length) {
                callback();
            }
        };
        img.onload = checkDone;
        img.onerror = () => {
            console.error("Failed to load image: " + src);
            checkDone(); // Proceed anyway to prevent hanging
        };
        img.src = src;
        ASSETS[src] = img;
    });
}

const UI = {
    titleScreen: document.getElementById('title-screen'),
    gameUi: document.getElementById('game-ui'),
    gameOverPanel: document.getElementById('game-over-panel'),
    scoreVal: document.getElementById('score-val'),
    btnSingle: document.getElementById('btn-single'),
    btnVs: document.getElementById('btn-vs'),
    btnBack: document.getElementById('btn-back'),
    btnRetry: document.getElementById('btn-retry'),
    canvas: document.getElementById('game-canvas'),
    ctx: document.getElementById('game-canvas').getContext('2d')
};

let currentGame = null;

const SoundManager = {
    bgm: new Audio('sound/suika.mp3'),
    drop: new Audio('sound/drop.mp3'),
    fusion: new Audio('sound/fusion.mp3'),
    gameover: new Audio('sound/gameover.mp3'),
    heart: new Audio('sound/heart.mp3'),
    bgmEnabled: true,
    seEnabled: true,
    volume: 0.3,

    init() {
        this.bgm.loop = true;
        
        const chkBgm = document.getElementById('chk-bgm');
        const chkSe = document.getElementById('chk-se');
        const volSlider = document.getElementById('vol-slider');
        const chkGuide = document.getElementById('chk-guide');
        window.guideEnabled = true;

        if(chkBgm) {
            chkBgm.addEventListener('change', (e) => {
                this.bgmEnabled = e.target.checked;
                if(!this.bgmEnabled) this.bgm.pause();
                else if(currentGame && !currentGame.gameOver) this.playBGM();
            });
        }
        if(chkSe) {
            chkSe.addEventListener('change', (e) => {
                this.seEnabled = e.target.checked;
            });
        }
        if(volSlider) {
            volSlider.addEventListener('input', (e) => {
                this.volume = parseFloat(e.target.value);
                this.updateVolume();
            });
        }
        if(chkGuide) {
            chkGuide.addEventListener('change', (e) => {
                window.guideEnabled = e.target.checked;
            });
        }
        
        this.updateVolume();
    },

    updateVolume() {
        this.bgm.volume = this.volume;
        this.drop.volume = this.volume;
        this.fusion.volume = this.volume;
        this.gameover.volume = this.volume;
        this.heart.volume = this.volume;
    },

    playBGM() {
        if(this.bgmEnabled) {
            this.bgm.play().catch(e => console.error("Audio play failed:", e));
        }
    },
    stopBGM() {
        this.bgm.pause();
        this.bgm.currentTime = 0;
    },
    playSE(name) {
        if(this.seEnabled && this[name]) {
            this[name].currentTime = 0;
            this[name].play().catch(e => console.error(e));
        }
    }
};

function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

function initUI() {
    SoundManager.init();

    UI.btnSingle.addEventListener('click', () => {
        SoundManager.playBGM();
        showScreen(UI.gameUi);
        UI.gameOverPanel.classList.add('hidden');
        startGame('single');
    });

    UI.btnVs.addEventListener('click', () => {
        SoundManager.playBGM();
        showScreen(UI.gameUi);
        UI.gameOverPanel.classList.add('hidden');
        startGame('vs');
    });

    UI.btnBack.addEventListener('click', () => {
        if(currentGame) {
            currentGame.stop();
            currentGame = null;
        }
        SoundManager.stopBGM();
        showScreen(UI.titleScreen);
    });

    UI.btnRetry.addEventListener('click', () => {
        UI.gameOverPanel.classList.add('hidden');
        if(currentGame) {
            let mode = currentGame.mode;
            currentGame.stop();
            SoundManager.playBGM();
            startGame(mode);
        }
    });
}

function startGame(mode) {
    if(mode === 'single') {
        currentGame = new SinglePlayerGame(UI.canvas, UI.ctx);
    } else {
        currentGame = new VSGame(UI.canvas, UI.ctx);
    }
    currentGame.start();
}

// Window load
window.onload = () => {
    preloadImages(() => {
        initUI();
    });
};
