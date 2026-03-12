import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
let gameStartTime = 0;
let gameSessionId = null;
const Bus = new Phaser.Events.EventEmitter();

// --- ETAT DU JEU (CHIFFRÉ) ---
const GameState = (() => {
    let score = 0;
    let pearls = 0;
    let playing = false;

    // Fonction de chiffrement simple (XOR basique)
    const encrypt = (value, key = 0x55) => value ^ key;
    const decrypt = (value, key = 0x55) => value ^ key;

    let encryptedScore = encrypt(0);
    let encryptedPearls = encrypt(0);

    return {
        getScore: () => decrypt(encryptedScore),
        getPearls: () => decrypt(encryptedPearls),
        getPlaying: () => playing,
        addScore: (val) => { encryptedScore = encrypt(decrypt(encryptedScore) + val); },
        addPearl: () => { encryptedPearls = encrypt(decrypt(encryptedPearls) + 1); },
        setPlaying: (val) => { playing = val; },
        reset: () => {
            score = 0; pearls = 0; playing = false;
            encryptedScore = encrypt(0);
            encryptedPearls = encrypt(0);
        }
    };
})();

// --- AUTHENTIFICATION ---
onAuthStateChanged(auth, async (user) => {
    const errorEl = document.getElementById("error-msg");
    const logoutBtn = document.getElementById("btn-logout");
    const loginBtn = document.getElementById("btn-login");
    const authStatus = document.getElementById("auth-status");

    if (user) {
        const domain = user.email.split('@')[1];
        if (ALLOWED_DOMAINS.includes(domain)) {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists() && userSnap.data().banned) {
                authStatus.innerHTML = "🚫 Compte bloqué pour triche.";
                errorEl.innerHTML = `Raison : ${userSnap.data().banReason || "Triche détectée"}`;
                errorEl.classList.remove("hidden");
                logoutBtn.classList.remove("hidden");
                loginBtn.classList.add("hidden");
                return;
            }
            currentUser = user;
            authStatus.innerHTML = `⚓ Bienvenue Capitaine <b>${user.displayName.split(' ')[0]}</b> !`;
            document.getElementById("auth-section").classList.add("hidden");
            document.getElementById("game-controls").classList.remove("hidden");
            loadLeaderboard();
        } else {
            authStatus.innerHTML = "🚫 Accès Refusé";
            errorEl.innerHTML = `Utilise ton mail ICAM (actuel: ${user.email})`;
            errorEl.classList.remove("hidden");
            logoutBtn.classList.remove("hidden");
            loginBtn.classList.add("hidden");
        }
    } else {
        authStatus.innerHTML = "Embarque avec ton mail ICAM.";
        loginBtn.classList.remove("hidden");
        document.getElementById("game-controls").classList.add("hidden");
        errorEl.classList.add("hidden");
        logoutBtn.classList.add("hidden");
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
            const data = d.data();
            html += `<li><span>#${rank} ${data.name}</span> <b>${Math.floor(data.score || 0)}</b></li>`;
            rank++;
        });
        document.getElementById("live-highscore-list").innerHTML = html;
        document.getElementById("modal-highscore-list").innerHTML = html;
        document.getElementById("lb-title").innerText = "🏆 TOP MILLES";
    } catch(e) { console.error("Erreur leaderboard:", e); }
}

async function saveScoreIfBest(newScore) {
    if (!currentUser) return;
    if (newScore > 30000) {
        logCheatAttempt("highScore", { attemptedScore: newScore });
        return;
    }
    const userRef = doc(db, "leaderboard", currentUser.uid);
    const snap = await getDoc(userRef);
    const roundedScore = Math.floor(newScore);
    let bestScore = roundedScore;
    let totalTime = Math.floor((Date.now() - gameStartTime) / 1000);

    if (snap.exists()) {
        const data = snap.data();
        bestScore = Math.max(data.score || 0, roundedScore);
        totalTime = (data.totalTime || 0) + totalTime;
    }
    await setDoc(userRef, { name: currentUser.displayName, score: bestScore, totalTime: totalTime, date: Date.now() }, { merge: true });
    loadLeaderboard();
}

// --- LOG DES TENTATIVES DE TRICHE ---
async function logCheatAttempt(type, details = {}) {
    if (!currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    let cheatCount = (userSnap.exists() ? (userSnap.data().cheatCount || 0) : 0) + 1;

    await setDoc(doc(db, "cheatLogs", `${currentUser.uid}_${Date.now()}`), {
        userId: currentUser.uid,
        userName: currentUser.displayName,
        type,
        details,
        timestamp: Date.now(),
        gameSessionId
    });
    await setDoc(userRef, { cheatCount }, { merge: true });

    if (cheatCount === 1) alert("⚠️ Attention : Une tentative de triche a été détectée.");
    else if (cheatCount === 2) alert("⚠️ Dernier avertissement avant blocage.");
    else if (cheatCount >= 3) {
        alert("🚫 Compte bloqué.");
        await setDoc(userRef, { banned: true, banReason: "Triche répétée" }, { merge: true });
        signOut(auth).then(() => window.location.reload());
    }
}

// --- VÉRIFICATION DE L'INTÉGRITÉ DU CODE (CHECKSUM) ---
async function verifyCodeIntegrity() {
    try {
        const response = await fetch('game.js');
        const code = await response.text();
        const currentHash = CryptoJS.SHA256(code).toString();
        const expectedHash = "TON_HASH_ICI"; // Remplace par le hash du fichier original

        if (currentHash !== expectedHash) {
            logCheatAttempt("codeTampering", { currentHash, expectedHash });
        }
    } catch (e) {
        console.error("Erreur vérification checksum:", e);
    }
}

// --- DÉTECTION DES MODIFICATIONS DU DOM ---
function setupDomTamperingDetection() {
    const scoreDisplay = document.getElementById("score-display");
    const pearlsDisplay = document.getElementById("pearls-display");
    let lastScore = 0;
    let lastPearls = 0;

    setInterval(() => {
        const currentScore = parseInt(scoreDisplay.textContent);
        const currentPearls = parseInt(pearlsDisplay.textContent);

        if (currentScore !== GameState.getScore() || currentPearls !== GameState.getPearls()) {
            logCheatAttempt("domTampering", {
                expectedScore: GameState.getScore(),
                displayedScore: currentScore,
                expectedPearls: GameState.getPearls(),
                displayedPearls: currentPearls
            });
        }
        lastScore = currentScore;
        lastPearls = currentPearls;
    }, 1000);
}

// --- PREUVE DE JEU (PROOF OF PLAY) ---
function setupProofOfPlay() {
    gameSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    setInterval(async () => {
        if (GameState.getPlaying() && currentUser) {
            const snapshot = {
                userId: currentUser.uid,
                score: GameState.getScore(),
                pearls: GameState.getPearls(),
                obstacles: window.game?.scene?.scenes.find(s => s.scene.key === "MainScene")?.obstacles?.getChildren().length || 0,
                time: Date.now(),
                sessionId: gameSessionId
            };
            await setDoc(doc(db, "gameSessions", `${gameSessionId}_${Date.now()}`), snapshot);
        }
    }, 5000);
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
        this.load.audio('sea_ambience', 'sea.mp3');
        this.load.audio('crash_sound', 'crash.mp3');
        this.load.audio('coin_sound', 'coin.mp3');
    }
    create() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 4, 4); g.generateTexture('p_white', 4, 4);
        const gg = this.make.graphics({ x: 0, y: 0, add: false });
        gg.fillStyle(0xffd700, 1); gg.fillRect(0, 0, 4, 4); gg.generateTexture('p_gold', 4, 4);
        this.scene.start("MainScene");
    }
}

class MainScene extends Phaser.Scene {
    constructor() { super("MainScene"); }

    create() {
        this.isGameOver = false;
        GameState.reset();
        this.currentSpeed = 300;
        this.laneIndex = 1;
        this.distanceTraveledSinceLastSpawn = 0;
        this.spawnDistanceThreshold = 450;

        this.bg = this.add.tileSprite(0, 0, 480, 720, "background").setOrigin(0);

        this.trailEmitter = this.add.particles(0, 0, "p_white", {
            speedY: { min: 120, max: 250 }, scale: { start: 2, end: 0 },
            alpha: { start: 0.7, end: 0 }, lifespan: 800, frequency: 15, blendMode: 'ADD'
        });

        this.player = this.physics.add.sprite(240, 600, "player").setScale(0.8);
        this.player.body.setCircle(this.player.width * 0.25, this.player.width * 0.25, this.player.height * 0.3);
        this.trailEmitter.startFollow(this.player);
        this.trailEmitter.followOffset.set(0, 40);

        this.pearlEmitter = this.add.particles(0, 0, "p_gold", {
            speed: { min: 100, max: 200 }, angle: { min: 0, max: 360 },
            scale: { start: 2.5, end: 0 }, lifespan: 500, gravityY: 200, emitting: false
        });

        this.obstacles = this.physics.add.group();
        this.pearls = this.physics.add.group();

        try {
            this.sea = this.sound.add('sea_ambience', { loop: true, volume: 0.3 });
            this.music = this.sound.add('music_action', { loop: true, volume: 0.4 });
            this.crash = this.sound.add('crash_sound', { volume: 0.7 });
            this.coinEffect = this.sound.add('coin_sound', { volume: 0.5 });
            this.sound.mute = isMuted;
            this.sea.play();
        } catch(e) { console.error("Audio error", e); }

        this.physics.add.overlap(this.player, this.obstacles, () => this.gameOver(), null, this);
        this.physics.add.overlap(this.player, this.pearls, (pl, p) => {
            this.pearlEmitter.emitParticleAt(p.x, p.y, 15);
            p.destroy(); GameState.addPearl(); GameState.addScore(25);
            if(this.coinEffect) this.coinEffect.play();
        }, null, this);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.setupInputHandlers();

        Bus.removeAllListeners();
        Bus.on("start", () => {
            if (this.isGameOver) return;
            gameStartTime = Date.now();
            GameState.setPlaying(true);
            this.physics.resume();
            showMenuState("play");
            if(this.sea) this.sea.stop();
            if(this.music) this.music.play();
        });
        Bus.on("restart", () => {
            this.sound.stopAll();
            this.scene.restart();
        });

        document.getElementById("btn-secret-trigger").onclick = () => {
            this.physics.pause();
            GameState.setPlaying(false);
            if(this.music) this.music.pause();
            document.getElementById("secret-modal").classList.remove("hidden");
        };
        document.getElementById("btn-close-secret").onclick = () => {
            document.getElementById("secret-modal").classList.add("hidden");
            this.physics.resume();
            GameState.setPlaying(true);
            if(this.music && !isMuted) this.music.resume();
        };

        this.physics.pause();
        showMenuState("menu");
    }

    setupInputHandlers() {
        let dragStartX = 0;
        let hasMoved = false;
        this.input.on("pointerdown", (p) => { dragStartX = p.x; hasMoved = false; });
        this.input.on("pointermove", (p) => {
            if(!GameState.getPlaying() || !p.isDown || hasMoved) return;
            if (Math.abs(p.x - dragStartX) > 25) {
                this.changeLane(p.x > dragStartX ? 1 : -1);
                hasMoved = true;
            }
        });
        this.input.on("pointerup", (p) => {
            if(!GameState.getPlaying()) return;
            if (!hasMoved) this.changeLane((p.x < 240) ? -1 : 1);
        });
    }

    update(_, delta) {
        if (!GameState.getPlaying() || this.isGameOver) return;
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.changeLane(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.changeLane(1);

        const dt = delta / 1000;
        this.currentSpeed += 4.5 * dt;
        const move = this.currentSpeed * dt;
        this.bg.tilePositionY -= move;
        this.obstacles.setVelocityY(this.currentSpeed);
        this.pearls.setVelocityY(this.currentSpeed);

        this.distanceTraveledSinceLastSpawn += move;
        if (this.distanceTraveledSinceLastSpawn >= this.spawnDistanceThreshold) {
            this.spawnWave();
            this.distanceTraveledSinceLastSpawn = 0;
            if(this.spawnDistanceThreshold > 280) this.spawnDistanceThreshold -= 0.6;
        }

        GameState.addScore(move * 0.01);
        document.getElementById("score-display").textContent = Math.floor(GameState.getScore());
        document.getElementById("pearls-display").textContent = GameState.getPearls();

        const score = Math.floor(GameState.getScore());
        const btnS = document.getElementById("btn-secret-trigger");
        if(score >= 50 && score <= 100) btnS.classList.remove("hidden");
        else btnS.classList.add("hidden");

        this.obstacles.getChildren().forEach(o => { if(o.y > 800) o.destroy(); });
    }

    changeLane(dir) {
        const next = this.laneIndex + dir;
        if (next >= 0 && next <= 2) {
            this.laneIndex = next;
            this.tweens.add({ targets: this.player, x: [130, 240, 350][this.laneIndex], duration: 150, ease: "Power2" });
        }
    }

    spawnWave() {
        const lanes = [130, 240, 350].sort(() => 0.5 - Math.random());
        const numObs = Math.random() < 0.45 ? 2 : 1;
        for (let i = 0; i < numObs; i++) {
            const obs = this.obstacles.create(lanes[i], -100, "obstacle").setScale(0.85);
            obs.body.setCircle(30, 15, 15);
            obs.setData("isObstacle", true);
        }
        if (numObs < 3 && Math.random() < 0.45) {
            this.pearls.create(lanes[numObs], -150, "pearl").setScale(0.6).body.setCircle(20);
        }
    }

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        GameState.setPlaying(false);
        this.trailEmitter.stop();
        this.physics.pause();
        this.cameras.main.shake(250, 0.02);
        if(this.music) this.music.stop();
        if(this.crash) this.crash.play();
        document.getElementById("final-score").textContent = Math.floor(GameState.getScore());
        document.getElementById("player-name-end").textContent = currentUser ? currentUser.displayName.split(' ')[0] : "Marin";
        saveScoreIfBest(GameState.getScore());
        showMenuState("gameover");
    }
}

// --- GESTION INTERFACE (DOM) ---
function showMenuState(s) {
    const ids = ["main-menu", "howto", "game-over", "hud", "leaderboard-modal"];
    ids.forEach(id => document.getElementById(id)?.classList.add("hidden"));
    if (s === "menu") document.getElementById("main-menu").classList.remove("hidden");
    if (s === "play") document.getElementById("hud").classList.remove("hidden");
    if (s === "gameover") document.getElementById("game-over").classList.remove("hidden");
}

function setupDomHandlers(game) {
    document.getElementById("btn-login").onclick = () => signInWithPopup(auth, provider);
    document.getElementById("btn-logout").onclick = () => signOut(auth).then(() => window.location.reload());
    document.getElementById("btn-play").onclick = () => Bus.emit("start");

    document.getElementById("btn-restart").onclick = () => {
        showMenuState("play");
        Bus.emit("restart");
    };

    document.getElementById("btn-settings").onclick = (e) => {
        isMuted = !isMuted;
        game.sound.mute = isMuted;
        e.target.innerText = isMuted ? "🔇" : "🔊";
    };

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

// --- INITIALISATION ---
const phaserConfig = {
    type: Phaser.AUTO, width: 480, height: 720, parent: "game-container",
    physics: { default: "arcade", arcade: { fps: 60 } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MainScene]
};

window.addEventListener('DOMContentLoaded', () => {
    const game = new Phaser.Game(phaserConfig);
    setupDomHandlers(game);

    // Active les protections après le chargement
    verifyCodeIntegrity();
    setupDomTamperingDetection();
    setupProofOfPlay();

    // Anti-triche pour la suppression d'obstacles
    const originalDestroy = Phaser.GameObjects.GameObject.prototype.destroy;
    Phaser.GameObjects.GameObject.prototype.destroy = function() {
        const stack = new Error().stack;
        if (this.scene?.scene?.key === "MainScene" && this.getData("isObstacle")) {
            const ok = stack && (stack.includes("MainScene") || stack.includes("phaser"));
            if (!ok) { logCheatAttempt("manualDestroy"); return this; }
        }
        return originalDestroy.call(this);
    };
});
