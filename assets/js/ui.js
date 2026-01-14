// assets/js/ui.js
// Header/Footer premium com menu responsivo (hamburger) para mobile.
// Versão "blindada": tenta múltiplos caminhos de logo e usa fallback se não encontrar.

(function () {
  const headerMount = document.getElementById("headerMount");
  const footerMount = document.getElementById("footerMount");

  const base = (() => {
    const p = window.location.pathname || "";
    return p.includes("/pages/") ? ".." : ".";
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
    // remove "./" e resolve para comparação simples
    return href.replace(/^\.\//, "/").replace(/^\.\.\//, "/");
  }

  function isActive(href) {
    const current = (window.location.pathname || "").toLowerCase();
    const target = normalizePath(href).toLowerCase();

    if (target.endsWith("/index.html") && (current.endsWith("/") || current.endsWith("/index.html"))) return true;
    return current.endsWith(target);
  }

  function logoCandidates() {
    // Tentamos múltiplos caminhos comuns dentro do seu projeto
    const paths = [
      `${base}/assets/img/logo.png`,
      `${base}/assets/img/logo.webp`,
      `${base}/assets/img/logo.jpg`,
      `${base}/assets/logo.png`,
      `${base}/assets/logo.webp`,
      `${base}/assets/logo.jpg`,
      `${base}/assets/images/logo.png`,
      `${base}/assets/images/logo.webp`,
      `${base}/assets/images/logo.jpg`,
      `${base}/assets/img/vale.png`,
      `${base}/assets/img/vale.webp`,
      `${base}/assets/img/vale.jpg`,
      `${base}/logo.png`,
      `${base}/logo.webp`,
      `${base}/logo.jpg`,
    ];
    return paths;
  }

  function renderLogoHTML() {
    // Começa com o primeiro candidato; se falhar, trocamos no JS.
    return `
      <div class="brand__logoWrap" data-logo>
        <img class="brand__logo" data-logo-img src="${logoCandidates()[0]}" alt="Vale Produções"/>
        <div class="brand__logoFallback" data-logo-fallback aria-hidden="true" style="display:none;">
          <span class="brand__logoBadge">VP</span>
        </div>
      </div>
    `;
  }

  function renderHeader() {
    if (!headerMount) return;

    headerMount.innerHTML = `
      <header class="siteHeader">
        <div class="container siteHeader__row">
          <a class="brand" href="${base}/index.html" aria-label="Vale Music Awards">
            ${renderLogoHTML()}
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
              <div class="navMobile__logoWrap" data-m-logo>
                <img class="navMobile__logo" data-m-logo-img src="${logoCandidates()[0]}" alt="Vale Produções"/>
                <div class="navMobile__logoFallback" data-m-logo-fallback aria-hidden="true" style="display:none;">
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

    // MENU EVENTS
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

    // LOGO RESOLVER (tenta vários paths e aplica fallback se nenhum funcionar)
    const logoImg = headerMount.querySelector("[data-logo-img]");
    const logoFallback = headerMount.querySelector("[data-logo-fallback]");
    const mLogoImg = headerMount.querySelector("[data-m-logo-img]");
    const mLogoFallback = headerMount.querySelector("[data-m-logo-fallback]");

    const candidates = logoCandidates();

    function setFallback() {
      if (logoImg) logoImg.style.display = "none";
      if (logoFallback) logoFallback.style.display = "grid";
      if (mLogoImg) mLogoImg.style.display = "none";
      if (mLogoFallback) mLogoFallback.style.display = "grid";
    }

    function setLogo(src) {
      if (logoImg) {
        logoImg.style.display = "block";
        logoImg.src = src;
      }
      if (logoFallback) logoFallback.style.display = "none";

      if (mLogoImg) {
        mLogoImg.style.display = "block";
        mLogoImg.src = src;
      }
      if (mLogoFallback) mLogoFallback.style.display = "none";
    }

    async function urlExists(url) {
      try {
        const r = await fetch(url, { method: "GET", cache: "no-store" });
        return r.ok;
      } catch {
        return false;
      }
    }

    (async function resolveLogo() {
      for (const url of candidates) {
        const ok = await urlExists(url);
        if (ok) {
          setLogo(url);
          return;
        }
      }
      setFallback();
    })();
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