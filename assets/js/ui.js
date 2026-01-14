// assets/js/ui.js
// Header/Footer premium com menu responsivo (hamburger) para mobile.
// LOGO: configure LOGO_PATH abaixo com o caminho REAL do seu logo no projeto.

(function () {
  // =========================
  // CONFIG (AJUSTE AQUI)
  // =========================
  const LOGO_PATH = "./assets/img/logo.png"; // <<< TROQUE para o caminho real do seu logo

  const headerMount = document.getElementById("headerMount");
  const footerMount = document.getElementById("footerMount");

  const base = (() => {
    const p = window.location.pathname || "";
    return p.includes("/pages/") ? ".." : ".";
  })();

  // Resolve LOGO_PATH respeitando base (pages vs root)
  const resolvedLogo = (() => {
    // Se LOGO_PATH começar com "./assets" e estivermos em /pages, vira "../assets"
    if (LOGO_PATH.startsWith("./assets/")) return `${base}${LOGO_PATH.replace(".", "")}`;
    // Se LOGO_PATH começar com "../assets", mantém
    if (LOGO_PATH.startsWith("../assets/")) return LOGO_PATH;
    // Se for absoluto (/assets/...), mantém
    if (LOGO_PATH.startsWith("/")) return LOGO_PATH;
    // Caso seja relativo simples (ex: "assets/img/logo.png")
    if (LOGO_PATH.startsWith("assets/")) return `${base}/${LOGO_PATH}`;
    // Caso default
    return LOGO_PATH;
  })();

  const navItems = [
    { label: "Início", href: `${base}/index.html` },
    { label: "Quem somos", href: `${base}/pages/quem-somos.html` },
    { label: "Inscrição", href: `${base}/pages/inscricao.html` },
    { label: "Ranking", href: `${base}/pages/ranking.html` },
    { label: "Área do candidato", href: `${base}/pages/candidato.html` },
    { label: "Área de jurados", href: `${base}/pages/jurados.html` },
  ];

  function normalizePath(href) {
    return href.replace(/^\.\//, "/").replace(/^\.\.\//, "/");
  }

  function isActive(href) {
    const current = (window.location.pathname || "").toLowerCase();
    const target = normalizePath(href).toLowerCase();
    if (target.endsWith("/index.html") && (current.endsWith("/") || current.endsWith("/index.html"))) return true;
    return current.endsWith(target);
  }

  function renderHeader() {
    if (!headerMount) return;

    headerMount.innerHTML = `
      <header class="siteHeader">
        <div class="container siteHeader__row">
          <a class="brand" href="${base}/index.html" aria-label="Vale Music Awards">
            <div class="brand__logoWrap">
              <img class="brand__logo" src="${resolvedLogo}" alt="Vale Produções"
                   onerror="this.style.display='none'; this.parentElement.querySelector('.brand__logoFallback').style.display='grid';" />
              <div class="brand__logoFallback" aria-hidden="true" style="display:none;">
                <span class="brand__logoBadge">VP</span>
              </div>
            </div>

            <div class="brand__text">
              <div class="brand__title">Vale Music Awards</div>
              <div class="brand__sub">Festival Internacional • Online</div>
            </div>
          </a>

          <nav class="navDesk" aria-label="Menu principal">
            ${navItems.map(i => `
              <a class="navLink ${isActive(i.href) ? "is-active" : ""}" href="${i.href}">
                ${i.label}
              </a>
            `).join("")}
          </nav>

          <button class="navBtn" type="button" aria-label="Abrir menu" aria-controls="mobileNav" aria-expanded="false">
            <span class="navBtn__bar"></span>
            <span class="navBtn__bar"></span>
            <span class="navBtn__bar"></span>
          </button>
        </div>

        <div class="navOverlay" id="navOverlay" hidden></div>

        <aside class="navMobile" id="mobileNav" aria-label="Menu mobile" hidden>
          <div class="navMobile__head">
            <div class="navMobile__brand">
              <div class="navMobile__logoWrap">
                <img class="navMobile__logo" src="${resolvedLogo}" alt="Vale Produções"
                     onerror="this.style.display='none'; this.parentElement.querySelector('.navMobile__logoFallback').style.display='grid';" />
                <div class="navMobile__logoFallback" aria-hidden="true" style="display:none;">
                  <span class="brand__logoBadge">VP</span>
                </div>
              </div>

              <div class="navMobile__titles">
                <b>Vale Music Awards</b>
                <span>Menu</span>
              </div>
            </div>

            <button class="navClose" type="button" aria-label="Fechar menu">✕</button>
          </div>

          <div class="navMobile__list">
            ${navItems.map(i => `
              <a class="navMobile__item ${isActive(i.href) ? "is-active" : ""}" href="${i.href}">
                <span>${i.label}</span>
                <span class="navMobile__chev">→</span>
              </a>
            `).join("")}
          </div>

          <div class="navMobile__foot">
            <div class="navMobile__note">Padrão premium • Ouro & Preto • Vale Produções</div>
          </div>
        </aside>
      </header>
    `;

    const btn = headerMount.querySelector(".navBtn");
    const closeBtn = headerMount.querySelector(".navClose");
    const overlay = headerMount.querySelector("#navOverlay");
    const mobileNav = headerMount.querySelector("#mobileNav");

    function openMenu() {
      overlay.hidden = false;
      mobileNav.hidden = false;
      requestAnimationFrame(() => {
        overlay.classList.add("is-open");
        mobileNav.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        document.documentElement.classList.add("noScroll");
      });
    }

    function closeMenu() {
      overlay.classList.remove("is-open");
      mobileNav.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      document.documentElement.classList.remove("noScroll");
      setTimeout(() => {
        overlay.hidden = true;
        mobileNav.hidden = true;
      }, 180);
    }

    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      expanded ? closeMenu() : openMenu();
    });

    closeBtn.addEventListener("click", closeMenu);
    overlay.addEventListener("click", closeMenu);

    headerMount.querySelectorAll(".navMobile__item").forEach(a => {
      a.addEventListener("click", () => closeMenu());
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") closeMenu();
    });
  }

  function renderFooter() {
    if (!footerMount) return;

    footerMount.innerHTML = `
      <footer class="siteFooter">
        <div class="container siteFooter__row">
          <div class="siteFooter__left">
            <div class="siteFooter__brand">Vale Music Awards</div>
            <div class="siteFooter__muted">© ${new Date().getFullYear()} Vale Produções • Todos os direitos reservados.</div>
          </div>
          <div class="siteFooter__right">
            <a class="footLink" href="${base}/pages/inscricao.html#regulamento">Regulamento</a>
            <a class="footLink" href="${base}/pages/ranking.html">Ranking</a>
            <a class="footLink" href="${base}/pages/jurados.html">Jurados</a>
          </div>
        </div>
      </footer>
    `;
  }

  renderHeader();
  renderFooter();
})();