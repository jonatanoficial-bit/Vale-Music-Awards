// assets/js/ui.js
// Header/Footer premium com menu responsivo (hamburger) para mobile.
// Funciona em GitHub Pages/Vercel (estático) e não depende de libs.

(function () {
  const headerMount = document.getElementById("headerMount");
  const footerMount = document.getElementById("footerMount");

  const base = (() => {
    // Se estiver em /pages/ alguma coisa, volta 1 nível para achar /assets e /index.html
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

  function isActive(href) {
    const current = (window.location.pathname || "").toLowerCase();
    const target = href.replace(base, "").toLowerCase();

    // Home
    if (target.endsWith("/index.html") && (current.endsWith("/") || current.endsWith("/index.html"))) return true;

    return current.endsWith(target.replace("./", "/")) || current.endsWith(target.replace("../", "/"));
  }

  function renderHeader() {
    if (!headerMount) return;

    headerMount.innerHTML = `
      <header class="siteHeader">
        <div class="container siteHeader__row">
          <a class="brand" href="${base}/index.html" aria-label="Vale Music Awards">
            <img class="brand__logo" src="${base}/assets/img/logo.png" alt="Vale Produções"/>
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
              <img class="navMobile__logo" src="${base}/assets/img/logo.png" alt="Vale Produções"/>
              <div class="navMobile__titles">
                <b>Vale Music Awards</b>
                <span>Menu</span>
              </div>
            </div>
            <button class="navClose" type="button" aria-label="Fechar menu">
              ✕
            </button>
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
            <div class="navMobile__note">
              Padrão premium • Ouro & Preto • Vale Produções
            </div>
          </div>
        </aside>
      </header>
    `;

    // Eventos
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

      // Espera animação
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

    // Fecha ao navegar
    headerMount.querySelectorAll(".navMobile__item").forEach(a => {
      a.addEventListener("click", () => closeMenu());
    });

    // Fecha com ESC
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