import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDocs, collection, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDp-ngw6gIqgi7-vhlSvLepnAusaSw2vFE",
  authDomain: "pearlist-survival.firebaseapp.com",
  projectId: "pearlist-survival",
  storageBucket: "pearlist-survival.firebasestorage.app",
  messagingSenderId: "131875439710",
  appId: "1:131875439710:web:7608311b0003555843a0cf",
  measurementId: "G-NYKYVXJBR2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ALLOWED_DOMAINS = ["2026.icam.fr", "2027.icam.fr", "2028.icam.fr", "2029.icam.fr", "2030.icam.fr", "2031.icam.fr", "icam.fr"];
let currentUser = null;
const Bus = new Phaser.Events.EventEmitter();
const GameState = { playing: false, score: 0, pearls: 0 };

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const domain = user.email.split('@')[1];
        if (ALLOWED_DOMAINS.includes(domain)) {
            currentUser = user;
            document.getElementById("auth-status").innerHTML = `⚓ Bienvenue, <b>${user.displayName.split(' ')[0]}</b> !`;
            document.getElementById("auth-section").classList.add("hidden");
            document.getElementById("game-controls").classList.remove("hidden");
            loadLeaderboard();
        } else {
            alert("Accès réservé ICAM !");
            auth.signOut();
        }
    }
});

async function loadLeaderboard() {
    const list = document.getElementById("live-highscore-list");
    const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
    const snap = await getDocs(q);
    let html = ""; let rank = 1;
    snap.forEach((d) => {
        html += `<li><span>#${rank} ${d.data().name}</span> <b>${Math.floor(d.data().score)}</b></li>`;
        rank++;
    });
    list.innerHTML = html || "<li>Aucun record</li>";
}

class BootScene extends Phaser.Scene {
    constructor() { super("BootScene"); }
    preload() {
        this.load.image("background", "background.png");
        this.load.image("player", "player_harmonized.png");
        this.load.image("obstacle", "obstacle_harmonized.png");
        this.load.image("pearl", "pearl_harmonized.png");
        this.load.audio('music_action', 'music.mp3');
        this.load.audio('sea_ambience', 'sea.mp3');
        this.load.audio('crash_sound', 'crash.mp3');
        this.load.audio('coin_sound', 'coin.mp3');
    }
    create() { this.scene.start("MainScene"); }
}

class MainScene extends Phaser.Scene {
    constructor() { super("MainScene"); }

    create() {
        this.isGameOver = false;
        GameState.score = 0;
        GameState.pearls = 0;
        this.distanceTraveledSinceLastSpawn = 0;
        this.spawnDistanceThreshold = 450; 
        this.currentSpeed = 300; 
        this.laneIndex = 1;

        this.bg = this.add.tileSprite(0, 0, 480, 720, "background").setOrigin(0);
        
        this.player = this.physics.add.sprite(240, 600, "player").setScale(0.8);
        this.player.body.setCircle(this.player.width * 0.25, this.player.width * 0.25, this.player.height * 0.3);

        this.obstacles = this.physics.add.group();
        this.pearls = this.physics.add.group();

        try {
            this.sea = this.sound.add('sea_ambience', { loop: true, volume: 0.4 });
            this.music = this.sound.add('music_action', { loop: true, volume: 0.5 });
            this.crash = this.sound.add('crash_sound', { volume: 0.8 });
            this.coinEffect = this.sound.add('coin_sound', { volume: 0.6 });
            this.sea.play();
        } catch(e) {}

        this.physics.add.overlap(this.player, this.obstacles, () => this.gameOver(), null, this);
        this.physics.add.overlap(this.player, this.pearls, (pl, p) => {
            p.destroy(); GameState.pearls++; GameState.score += 20;
            if(this.coinEffect) this.coinEffect.play();
        }, null, this);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.input.on("pointerdown", (p) => { if(GameState.playing) this.changeLane((p.x < 240) ? -1 : 1); });

        Bus.removeAllListeners();
        Bus.on("start", () => {
            GameState.playing = true;
            this.physics.resume();
            showMenuState("play");
            if(this.sea) this.sea.stop();
            if(this.music) this.music.play();
        });
        Bus.on("restart", () => { if(this.music) this.music.stop(); this.scene.restart(); });

        this.physics.pause();
        showMenuState("menu");
    }

    update(time, delta) {
        if (!GameState.playing || this.isGameOver) return;

        if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.changeLane(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.changeLane(1);

        // Facteur de temps pour être indépendant du framerate
        const dt = delta / 1000;
        this.currentSpeed += 5 * dt; 
        const move = this.currentSpeed * dt;
        
        this.bg.tilePositionY -= move;
        this.obstacles.setVelocityY(this.currentSpeed);
        this.pearls.setVelocityY(this.currentSpeed);

        this.distanceTraveledSinceLastSpawn += move;
        if (this.distanceTraveledSinceLastSpawn >= this.spawnDistanceThreshold) {
            this.spawnWave();
            this.distanceTraveledSinceLastSpawn = 0;
            if(this.spawnDistanceThreshold > 320) this.spawnDistanceThreshold -= 0.8;
        }

        GameState.score += (move * 0.01); 
        document.getElementById("score-display").innerText = Math.floor(GameState.score);
        document.getElementById("pearls-display").innerText = GameState.pearls;

        this.obstacles.getChildren().forEach(o => { if(o.y > 850) o.destroy(); });
        this.pearls.getChildren().forEach(p => { if(p.y > 850) p.destroy(); });
    }

    changeLane(dir) {
        const next = this.laneIndex + dir;
        if (next < 0 || next > 2) return;
        this.laneIndex = next;
        this.tweens.add({ targets: this.player, x: [130, 240, 350][this.laneIndex], duration: 160, ease: "Cubic.easeOut" });
    }

    spawnWave() {
        const lanes = [130, 240, 350];
        const randomValue = Math.random();
        let spawnedLanes = [];

        const doubleChance = Math.min(0.6, 0.2 + (this.currentSpeed / 2000));

        if (randomValue > 0.1) {
            const shuffled = lanes.sort(() => 0.5 - Math.random());
            const count = (Math.random() < doubleChance) ? 2 : 1;
            for(let i=0; i < count; i++) {
                const obs = this.obstacles.create(shuffled[i], -100, "obstacle").setScale(0.85);
                obs.body.setCircle(obs.width * 0.35, obs.width * 0.15, obs.height * 0.15);
                spawnedLanes.push(shuffled[i]);
            }
        }

        if(Math.random() < 0.4) {
            const free = lanes.filter(l => !spawnedLanes.includes(l));
            if(free.length > 0) {
                const pLane = free[Math.floor(Math.random() * free.length)];
                this.pearls.create(pLane, -150, "pearl").setScale(0.6).body.setCircle(20);
            }
        }
    }

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        GameState.playing = false;
        this.physics.pause();
        this.cameras.main.shake(300, 0.02);
        if(this.music) this.music.stop();
        if(this.crash) this.crash.play();
        document.getElementById("final-score").innerText = Math.floor(GameState.score);
        document.getElementById("player-name-end").innerText = currentUser ? currentUser.displayName : "Marin";
        setDoc(doc(db, "leaderboard", currentUser.uid), {
            name: currentUser.displayName,
            score: Math.floor(GameState.score),
            date: Date.now()
        }, { merge: true }).then(() => loadLeaderboard());
        showMenuState("gameover");
    }
}

function showMenuState(s) {
    ["main-menu", "howto", "game-over", "hud"].forEach(id => document.getElementById(id)?.classList.add("hidden"));
    if (s === "menu") document.getElementById("main-menu").classList.remove("hidden");
    if (s === "play") document.getElementById("hud").classList.remove("hidden");
    if (s === "gameover") document.getElementById("game-over").classList.remove("hidden");
}

function setupDomHandlers() {
    document.getElementById("btn-login").onclick = () => signInWithPopup(auth, provider);
    document.getElementById("btn-play").onclick = () => Bus.emit("start");
    document.getElementById("btn-restart").onclick = () => Bus.emit("restart");
    document.getElementById("btn-menu").onclick = () => window.location.reload();
    document.getElementById("btn-howto").onclick = () => {
        document.getElementById("main-menu").classList.add("hidden");
        document.getElementById("howto").classList.remove("hidden");
    };
    document.getElementById("btn-back-menu").onclick = () => {
        document.getElementById("howto").classList.add("hidden");
        document.getElementById("main-menu").classList.remove("hidden");
    };
}

const phaserConfig = {
    type: Phaser.AUTO,
    width: 480, height: 720,
    parent: "game-container",
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    physics: { 
        default: "arcade",
        arcade: { 
            fps: 60,
            fixedStep: true // Force un calcul physique stable
        }
    },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MainScene]
};

window.addEventListener('DOMContentLoaded', () => {
    setupDomHandlers();
    new Phaser.Game(phaserConfig);
});