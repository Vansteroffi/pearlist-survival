// Fonction cryptographique pour transformer un mot en code secret illisible
async function hashPassword(message) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 15); // On garde 15 caractères pour le nom du fichier
}

async function checkPassword() {
    // On récupère le mot de passe, on le met en minuscules, et on enlève tous les espaces (ex: "le roux" devient "leroux")
    let input = document.getElementById("passwordInput").value.trim().toLowerCase().replace(/\s+/g, '');
    
    const errorEl = document.getElementById("error-message");
    const loginBox = document.getElementById("loginBox");
    const errorSfx = document.getElementById("errorSound");
    const clickSfx = document.getElementById("clickSound");

    errorEl.textContent = "Recherche...";
    loginBox.classList.remove("shake");
    
    clickSfx.currentTime = 0;
    clickSfx.play().catch(() => {});

    if (input === "") {
        showError(errorEl, loginBox, errorSfx);
        return;
    }

    // Le script transforme le mot en code secret
    const secretCode = await hashPassword(input);
    const nomDePage = "step_" + secretCode + ".html";

    // Le script essaie discrètement de voir si ce fichier HTML existe dans ton dossier
    try {
        const response = await fetch(nomDePage, { method: 'HEAD' });
        if (response.ok) {
            // Le fichier existe ! C'est le bon mot de passe, on redirige le joueur.
            window.location.href = nomDePage;
        } else {
            // Le fichier n'existe pas (erreur 404), donc le mot de passe était faux.
            showError(errorEl, loginBox, errorSfx);
        }
    } catch (error) {
        showError(errorEl, loginBox, errorSfx);
    }
}

function showError(errorEl, loginBox, errorSfx) {
    errorEl.textContent = "Code incorrect...";
    errorSfx.currentTime = 0;
    errorSfx.play().catch(() => {});
    void loginBox.offsetWidth; 
    loginBox.classList.add("shake");
}

document.getElementById("passwordInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") checkPassword();
});