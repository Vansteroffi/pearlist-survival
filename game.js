import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// --- LOGIQUE AUTH & SCORE ---
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
    const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
    const snap = await getDocs(q);
    let html = ""; let rank = 1;
    snap.forEach((d) => {
        html += `<li><span>#${rank} ${d.data().name}</span> <b>${Math.floor(d.data().score)}</b></li>`;
        rank++;
    });
    document.getElementById("live-highscore-list").innerHTML = html;
    document.getElementById("modal-highscore-list").innerHTML = html;
}

async function saveScoreIfBest(newScore) {
    if (!currentUser) return;
    const userRef = doc(db, "leaderboard", currentUser.uid);
    const snap = await getDoc(userRef);
    const roundedScore = Math.floor(newScore);
    if (!snap.exists() || roundedScore > (snap.data().score || 0)) {
        await setDoc(userRef, { name: currentUser.displayName, score: roundedScore, date: Date.now() }, { merge: true });
        loadLeaderboard();
    }
}

// --- JEU PHASER ---
class BootScene extends Phaser.Scene {
    constructor() { super("BootScene"); }
    preload() {
        this.load.image("background", "background.png");
        this.load.image("player", "player_harmonized.png");
        this.load.image("obstacle", "obstacle_harmonized.png");
        this.load.image("pearl", "pearl_harmonized.png");
        this.load.image("white_particle", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5QMfCSIuGvG9AAAAF0lEQVQI12P4//8/AwMDEwMSYCRAnYIAd6ID/8P9f9MAAAAASUVORK5CYII="); // Petit point blanc
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
        GameState.score = 0; GameState.pearls = 0;
        this.distanceTraveledSinceLastSpawn = 0;
        this.spawnDistanceThreshold = 450; 
        this.currentSpeed = 300; 
        this.laneIndex = 1;

        this.bg = this.add.tileSprite(0, 0, 480, 720, "background").setOrigin(0);

        // --- TRAÎNÉE (Sillage) ---
        this.emitter = this.add.particles(0, 0, "white_particle", {
            speedY: { min: 100, max: 200 },
            scale: { start: 1, end: 0 },
            alpha: { start: 0.6, end: 0 },
            lifespan: 600,
            frequency: 30,
            blendMode: 'ADD'
        });

        this.player = this.physics.add.sprite(240, 600, "player").setScale(0.8);
        this.player.body.setCircle(this.player.width * 0.25, this.player.width * 0.25, this.player.height * 0.3);
        
        // On attache les particules au bateau
        this.emitter.startFollow(this.player);
        this.emitter.followOffset.set(0, 30); // Place la traînée derrière le bateau

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

    update(_, delta) {
        if (!GameState.playing || this.isGameOver) return;

        if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.changeLane(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.changeLane(1);

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
    }

    changeLane(dir) {
        const next = this.laneIndex + dir;
        if (next < 0 || next > 2) return;
        this.laneIndex = next;
        this.tweens.add({ targets: this.player, x: [130, 240, 350][this.laneIndex], duration: 160, ease: "Cubic.easeOut" });
    }

    spawnWave() {
        const lanes = [130, 240, 350];
        const shuffled = lanes.sort(() => 0.5 - Math.random());
        const obs = this.obstacles.create(shuffled[0], -100, "obstacle").setScale(0.85);
        obs.body.setCircle(obs.width * 0.35, obs.width * 0.15, obs.height * 0.15);
        
        if(Math.random() < 0.4) {
            this.pearls.create(shuffled[1], -150, "pearl").setScale(0.6).body.setCircle(20);
        }
    }

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        GameState.playing = false;
        this.emitter.stop(); // Arrête la traînée
        this.physics.pause();
        this.cameras.main.shake(300, 0.02);
        if(this.music) this.music.stop();
        if(this.crash) this.crash.play();
        
        document.getElementById("final-score").innerText = Math.floor(GameState.score);
        document.getElementById("player-name-end").innerText = currentUser ? currentUser.displayName : "Marin";
        
        saveScoreIfBest(GameState.score);
        showMenuState("gameover");
    }
}

function showMenuState(s) {
    ["main-menu", "howto", "game-over", "hud", "leaderboard-modal"].forEach(id => document.getElementById(id)?.classList.add("hidden"));
    if (s === "menu") document.getElementById("main-menu").classList.remove("hidden");
    if (s === "play") document.getElementById("hud").classList.remove("hidden");
    if (s === "gameover") document.getElementById("game-over").classList.remove("hidden");
}

function setupDomHandlers() {
    document.getElementById("btn-login").onclick = () => signInWithPopup(auth, provider);
    document.getElementById("btn-play").onclick = () => Bus.emit("start");
    document.getElementById("btn-restart").onclick = () => Bus.emit("restart");
    
    // Logique des Pop-ups
    document.getElementById("btn-show-leaderboard").onclick = () => {
        document.getElementById("leaderboard-modal").classList.remove("hidden");
        document.getElementById("view-rankings").classList.remove("hidden");
        document.getElementById("view-prizes").classList.add("hidden");
        loadLeaderboard();
    };

    document.getElementById("btn-show-prizes").onclick = () => {
        document.getElementById("view-rankings").classList.add("hidden");
        document.getElementById("view-prizes").classList.remove("hidden");
    };

    document.getElementById("btn-back-to-rank").onclick = () => {
        document.getElementById("view-prizes").classList.add("hidden");
        document.getElementById("view-rankings").classList.remove("hidden");
    };

    document.getElementById("btn-close-modal").onclick = () => document.getElementById("leaderboard-modal").classList.add("hidden");
    document.getElementById("close-modal-x").onclick = () => document.getElementById("leaderboard-modal").classList.add("hidden");

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
    type: Phaser.AUTO, width: 480, height: 720, parent: "game-container",
    pixelArt: false, antialias: true, roundPixels: false,
    physics: { default: "arcade", arcade: { fps: 60 } },
    scale: { mode: Phaser.Scale.FIT,
