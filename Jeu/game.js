import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- CONFIGURATION FIREBASE ---
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
provider.setCustomParameters({ prompt: 'select_account' });

// --- VARIABLES GLOBALES ---
const ALLOWED_DOMAINS = ["2026.icam.fr", "2027.icam.fr", "2028.icam.fr", "2029.icam.fr", "2030.icam.fr", "2031.icam.fr", "icam.fr"];
let currentUser = null;
let isMuted = false;
const Bus = new Phaser.Events.EventEmitter();

const GameState = {
    score: 0,
    pearls: 0,
    playing: false,
    reset() { this.score = 0; this.pearls = 0; this.playing = false; }
};

// --- LOGIQUE ANTI-TRICHE GRADUELLE (Sans message doublon) ---
async function logCheatAttempt(type) {
    if (!currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    let count = (userSnap.exists() ? (userSnap.data().cheatCount || 0) : 0) + 1;

    await setDoc(userRef, { cheatCount: count, lastCheatType: type }, { merge: true });

    if (count === 1) {
        alert("⚓ Ohé matelot ! Tu n'as rien à faire ici.");
    } 
    else if (count === 2) {
        alert("⚠️ ATTENTION : Au prochain avertissement, tu seras banni ! Tes scores seront supprimés et tes résultats ne seront plus enregistrés.");
    } 
    else if (count >= 3) {
        alert("🚫 BANNI : Tes accès sont révoqués et tes scores ont été effacés.");
        await deleteDoc(doc(db, "leaderboard", currentUser.uid));
        await setDoc(userRef, { banned: true, banReason: "Triche répétée" }, { merge: true });
        signOut(auth).then(() => window.location.reload());
    }
}

// --- AUTHENTIFICATION ---
onAuthStateChanged(auth, async (user) => {
    const logoutBtn = document.getElementById("btn-logout");
    const loginBtn = document.getElementById("btn-login");
    const authStatus = document.getElementById("auth-status");

    if (user) {
        const domain = user.email.split('@')[1];
        if (ALLOWED_DOMAINS.includes(domain)) {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists() && userSnap.data().banned) {
                authStatus.innerHTML = "🚫 <b>COMPTE BANNI</b>";
                logoutBtn.classList.remove("hidden");
                loginBtn.classList.add("hidden");
                return;
            }
            
            currentUser = user;
            authStatus.innerHTML = `⚓ Bienvenue <b>${user.displayName.split(' ')[0]}</b> !`;
            document.getElementById("auth-section").classList.add("hidden");
            document.getElementById("game-controls").classList.remove("hidden");
            loadLeaderboard();
        } else {
            authStatus.innerHTML = "🚫 Mail ICAM requis";
            logoutBtn.classList.remove("hidden");
            loginBtn.classList.add("hidden");
        }
    } else {
        loginBtn.classList.remove("hidden");
        document.getElementById("game-controls").classList.add("hidden");
    }
});

// --- CLASSEMENT ---
async function loadLeaderboard() {
    try {
        const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
        const snap = await getDocs(q);
        let html = "";
        let rank = 1;
        snap.forEach((d) => {
            html += `<li><span>#${rank} ${d.data().name}</span> <b>${Math.floor(d.data().score || 0)}</b></li>`;
            rank++;
        });
        document.getElementById("live-highscore-list").innerHTML = html;
        document.getElementById("modal-highscore-list").innerHTML = html;
    } catch(e) { console.error(e); }
}

async function saveScoreIfBest(newScore) {
    if (!currentUser || newScore > 35000) return;
    const userSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (userSnap.exists() && userSnap.data().banned) return;

    const userRef = doc(db, "leaderboard", currentUser.uid);
    const snap = await getDoc(userRef);
    const roundedScore = Math.floor(newScore);
    let bestScore = roundedScore;
    if (snap.exists()) bestScore = Math.max(snap.data().score || 0, roundedScore);

    await setDoc(userRef, {
        name: currentUser.displayName,
        score: bestScore,
        date: Date.now()
    }, { merge: true });
    loadLeaderboard();
}

// --- JEU PHASER ---
class BootScene extends Phaser.Scene {
    constructor() { super("BootScene"); }
    preload() {
        this.load.image("background", "background.png");
        this.load.image("player", "player_harmonized.png");
        this.load.image("obstacle", "obstacle_harmonized.png");
        this.load.image("pearl", "pearl_harmonized.png");
        this.load.audio('music_action', 'music.mp3');
        this.load.audio('crash_sound', 'crash.mp3');
        this.load.audio('coin_sound', 'coin.mp3');
    }
    create() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffffff, 1).fillRect(0, 0, 4, 4).generateTexture('p_white', 4, 4);
        g.clear().fillStyle(0xffd700, 1).fillRect(0, 0, 4, 4).generateTexture('p_gold', 4, 4);
        this.scene.start("MainScene");
    }
}

class MainScene extends Phaser.Scene {
    constructor() { super("MainScene"); }

    create() {
        this.domScore = document.getElementById("score-display");
        this.domPearls = document.getElementById("pearls-display");
        this.domSecret = document.getElementById("btn-secret-trigger");

        this.isGameOver = false;
        GameState.reset();
        this.currentSpeed = 300;
        this.laneIndex = 1;
        this.distanceTraveledSinceLastSpawn = 0;
        this.spawnDistanceThreshold = 450;

        this.bg = this.add.tileSprite(0, 0, 480, 720, "background").setOrigin(0);

        this.trailEmitter = this.add.particles(0, 0, "p_white", {
            speedY: { min: 100, max: 200 }, scale: { start: 1.5, end: 0 },
            alpha: { start: 0.5, end: 0 }, lifespan: 600, frequency: 30, blendMode: 'ADD'
        });

        // --- AJUSTEMENT MOBILE : On remonte le joueur (y: 580 au lieu de 600) ---
        this.player = this.physics.add.sprite(240, 580, "player").setScale(0.8);
        this.player.body.setCircle(this.player.width * 0.2, this.player.width * 0.3, this.player.height * 0.3);
        
        this.trailEmitter.startFollow(this.player);
        this.trailEmitter.followOffset.set(0, 35);

        this.pearlEmitter = this.add.particles(0, 0, "p_gold", {
            speed: { min: 80, max: 150 }, scale: { start: 2, end: 0 }, lifespan: 400, emitting: false
        });

        this.obstacles = this.physics.add.group();
        this.pearls = this.physics.add.group();

        try {
            this.music = this.sound.add('music_action', { loop: true, volume: 0.4 });
            this.crash = this.sound.add('crash_sound', { volume: 0.7 });
            this.coinEffect = this.sound.add('coin_sound', { volume: 0.5 });
            this.sound.mute = isMuted;
        } catch(e) {}

        this.physics.add.overlap(this.player, this.obstacles, () => this.gameOver(), null, this);
        this.physics.add.overlap(this.player, this.pearls, (pl, p) => {
            this.pearlEmitter.emitParticleAt(p.x, p.y, 10);
            p.destroy(); 
            GameState.pearls += 1; 
            GameState.score += 25;
            if(this.coinEffect) this.coinEffect.play();
        }, null, this);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.setupInputHandlers();

        Bus.removeAllListeners();
        Bus.on("start", () => {
            GameState.playing = true;
            this.physics.resume();
            showMenuState("play");
            if(this.music) this.music.play();
        });

        Bus.on("restart", () => {
            this.sound.stopAll();
            this.scene.restart();
        });

        this.physics.pause();
        showMenuState("menu");
    }

    setupInputHandlers() {
        let dragStartX = 0;
        let hasMoved = false;
        this.input.on("pointerdown", (p) => { dragStartX = p.x; hasMoved = false; });
        this.input.on("pointermove", (p) => {
            if(!GameState.playing || !p.isDown || hasMoved) return;
            if (Math.abs(p.x - dragStartX) > 20) { // Sensibilité augmentée
                this.changeLane(p.x > dragStartX ? 1 : -1);
                hasMoved = true;
            }
        });
        this.input.on("pointerup", (p) => {
            if(!GameState.playing || hasMoved) return;
            this.changeLane((p.x < 240) ? -1 : 1);
        });
    }

    update(_, delta) {
        if (!GameState.playing || this.isGameOver) return;
        
        const dt = delta / 1000;
        this.currentSpeed += 4 * dt;
        const move = this.currentSpeed * dt;
        
        this.bg.tilePositionY -= move;
        this.obstacles.setVelocityY(this.currentSpeed);
        this.pearls.setVelocityY(this.currentSpeed);

        this.distanceTraveledSinceLastSpawn += move;
        if (this.distanceTraveledSinceLastSpawn >= this.spawnDistanceThreshold) {
            this.spawnWave();
            this.distanceTraveledSinceLastSpawn = 0;
            if(this.spawnDistanceThreshold > 290) this.spawnDistanceThreshold -= 0.5;
        }

        GameState.score += move * 0.01;
        this.domScore.textContent = Math.floor(GameState.score);
        this.domPearls.textContent = GameState.pearls;

        this.obstacles.children.each(o => { if(o && o.y > 750) o.destroy(); });
        this.pearls.children.each(p => { if(p && p.y > 750) p.destroy(); });
    }

    changeLane(dir) {
        const next = this.laneIndex + dir;
        if (next >= 0 && next <= 2) {
            this.laneIndex = next;
            this.tweens.add({ targets: this.player, x: [130, 240, 350][this.laneIndex], duration: 120, ease: "Quad.easeOut" });
        }
    }

    spawnWave() {
        const lanes = [130, 240, 350].sort(() => 0.5 - Math.random());
        const numObs = Math.random() < 0.4 ? 2 : 1;
        for (let i = 0; i < numObs; i++) {
            const obs = this.obstacles.create(lanes[i], -50, "obstacle").setScale(0.8);
            obs.body.setCircle(25, 15, 15);
            obs.setData("isObstacle", true);
        }
        if (numObs < 3 && Math.random() < 0.5) {
            this.pearls.create(lanes[numObs], -100, "pearl").setScale(0.6).body.setCircle(20);
        }
    }

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        GameState.playing = false;
        this.trailEmitter.stop();
        this.physics.pause();
        this.cameras.main.shake(200, 0.01);
        if(this.music) this.music.stop();
        if(this.crash) this.crash.play();
        document.getElementById("final-score").textContent = Math.floor(GameState.score);
        saveScoreIfBest(GameState.score);
        showMenuState("gameover");
    }
}

// --- INITIALISATION & SECURITÉ ---
const phaserConfig = {
    type: Phaser.AUTO, 
    width: 480, 
    height: 720, 
    parent: "game-container",
    physics: { default: "arcade", arcade: { fps: 60 } },
    scale: { 
        mode: Phaser.Scale.FIT, // S'adapte à l'écran
        autoCenter: Phaser.Scale.CENTER_BOTH,
        expandParent: false // Évite de déborder
    },
    scene: [BootScene, MainScene],
    powerPreference: 'high-performance'
};

window.addEventListener('DOMContentLoaded', () => {
    const game = new Phaser.Game(phaserConfig);
    setupDomHandlers(game);

    Object.defineProperty(window, 'game', { 
        get: () => { logCheatAttempt("console_access"); return undefined; } 
    });

    const _dest = Phaser.GameObjects.GameObject.prototype.destroy;
    Phaser.GameObjects.GameObject.prototype.destroy = function() {
        if (this.scene?.scene?.key === "MainScene" && this.getData("isObstacle")) {
            const s = new Error().stack;
            if (!s || (!s.includes("MainScene") && !s.includes("phaser"))) {
                logCheatAttempt("manual_destroy"); return this;
            }
        }
        return _dest.call(this);
    };
});

// INTERCEPTION F12 (LOG SANS MESSAGE ALERTE DOUBLON)
window.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        logCheatAttempt("f12_shortcut");
    }
});
window.addEventListener('contextmenu', e => e.preventDefault());

function setupDomHandlers(game) {
    document.getElementById("btn-login").onclick = () => signInWithPopup(auth, provider);
    document.getElementById("btn-logout").onclick = () => signOut(auth).then(() => window.location.reload());
    document.getElementById("btn-play").onclick = () => Bus.emit("start");
    document.getElementById("btn-restart").onclick = () => Bus.emit("restart");
    document.getElementById("btn-settings").onclick = (e) => {
        isMuted = !isMuted; game.sound.mute = isMuted;
        e.target.innerText = isMuted ? "🔇" : "🔊";
    };
    document.getElementById("btn-show-leaderboard").onclick = () => {
        document.getElementById("leaderboard-modal").classList.remove("hidden");
        loadLeaderboard();
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

function showMenuState(s) {
    const ids = ["main-menu", "howto", "game-over", "hud", "leaderboard-modal"];
    ids.forEach(id => document.getElementById(id)?.classList.add("hidden"));
    if (s === "menu") document.getElementById("main-menu").classList.remove("hidden");
    if (s === "play") document.getElementById("hud").classList.remove("hidden");
    if (s === "gameover") document.getElementById("game-over").classList.remove("hidden");
}