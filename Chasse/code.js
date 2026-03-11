function checkPassword() {
      const input = document.getElementById("passwordInput").value.trim().toLowerCase();
      const errorEl = document.getElementById("error-message");
      const loginBox = document.getElementById("loginBox");
      const errorSfx = document.getElementById("errorSound");
      const clickSfx = document.getElementById("clickSound");

      errorEl.textContent = "";
      loginBox.classList.remove("shake");

      clickSfx.currentTime = 0;
      clickSfx.play().catch(() => {});

      switch(input) {
        case "Taverne":
          window.location.href = "step1gezhivbepacfea.html";
          break;
        case "Initiales":
          window.location.href = "step2ebmthenrzpnvrz.html";
          break;
        case "Plage":
          window.location.href= "step3uytrevnbhjipkan.html";
          break;
        case "Le Roux":
          window.location.href="step4kijihngeoipnvbntyzen.html";
          break;
        default:
          errorEl.textContent = "Code incorrect...";
          errorSfx.currentTime = 0;
          errorSfx.play().catch(() => {});
          void loginBox.offsetWidth; 
          loginBox.classList.add("shake");
      }
    }

    document.getElementById("passwordInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") checkPassword();
    });
