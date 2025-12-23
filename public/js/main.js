// ===== CAROUSEL CLASS (NATIVE SCROLL - NO INFINITE/NO CLONES) =====
class Carousel {
  constructor(carouselId) {
    this.carouselId = carouselId;
    this.container = document.querySelector(`.carousel-container[data-carousel="${carouselId}"]`);
    if (!this.container) return;

    this.track = this.container.querySelector(".carousel-track");
    this.items = Array.from(this.track.children);
    this.totalItems = this.items.length;

    this.leftArrow = document.querySelector(`.carousel-arrow-left[data-carousel="${carouselId}"]`);
    this.rightArrow = document.querySelector(`.carousel-arrow-right[data-carousel="${carouselId}"]`);
    this.indicatorsContainer = document.querySelector(`.carousel-indicators[data-carousel="${carouselId}"]`);

    this.currentIndex = 0;
    this._raf = 0;
    this._dragged = false;
    this._scrollBound = false;

    this.init();
  }

  init() {
    this.createIndicators();
    this.setupScrollBehavior();
    this.updateArrows();
    this.setActiveIndicator(0);

    // Arrow click handlers
    if (this.leftArrow) this.leftArrow.addEventListener("click", () => this.prev());
    if (this.rightArrow) this.rightArrow.addEventListener("click", () => this.next());

    // Keyboard support
    this.addKeyboardSupport();

    // Handle resize
    window.addEventListener("resize", () => this.handleResize());
  }

  // -----------------------------
  // UTILITIES
  // -----------------------------
  getGapPx() {
    const gap = getComputedStyle(this.track).gap;
    const n = parseFloat(gap || "0");
    return Number.isFinite(n) ? n : 32;
  }

  getStepPx() {
    const first = this.track.children[0];
    if (!first) return 0;
    return first.getBoundingClientRect().width + this.getGapPx();
  }

  clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // -----------------------------
  // RESIZE HANDLER
  // -----------------------------
  handleResize() {
    // Recalculate and update arrows/indicators after resize
    requestAnimationFrame(() => {
      const idx = this.getIndexFromScroll();
      this.currentIndex = idx;
      this.setActiveIndicator(idx);
      this.updateArrows();
    });
  }

  // -----------------------------
  // INDICATORS
  // -----------------------------
  createIndicators() {
    if (!this.indicatorsContainer) return;

    this.indicatorsContainer.innerHTML = "";

    for (let i = 0; i < this.totalItems; i++) {
      const indicator = document.createElement("button");
      indicator.classList.add("carousel-indicator");
      indicator.setAttribute("aria-label", `Vai alla slide ${i + 1}`);
      if (i === 0) indicator.classList.add("active");

      indicator.addEventListener("click", () => this.goToPage(i));
      this.indicatorsContainer.appendChild(indicator);
    }
  }

  setActiveIndicator(index) {
    const indicators = this.indicatorsContainer?.querySelectorAll(".carousel-indicator");
    indicators?.forEach((indicator, i) => {
      indicator.classList.toggle("active", i === index);
    });
  }

  // -----------------------------
  // SCROLL BEHAVIOR (NATIVE)
  // -----------------------------
  setupScrollBehavior() {
    if (this._scrollBound) return;

    let startX = 0;
    let startScroll = 0;

    // Anti ghost-click after drag/swipe
    const onPointerDown = (e) => {
      startX = e.clientX;
      startScroll = this.container.scrollLeft;
      this._dragged = false;
    };

    const onPointerMove = (e) => {
      const dx = Math.abs(e.clientX - startX);
      const ds = Math.abs(this.container.scrollLeft - startScroll);
      if (dx > 10 && ds > 10) this._dragged = true;
    };

    const onClickCapture = (e) => {
      if (this._dragged) {
        e.preventDefault();
        e.stopPropagation();
        this._dragged = false;
      }
    };

    // Sync indicators and arrows on scroll
    const onScroll = () => {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => {
        const idx = this.getIndexFromScroll();
        this.currentIndex = idx;
        this.setActiveIndicator(idx);
        this.updateArrows();
      });
    };

    this._onPointerDown = onPointerDown;
    this._onPointerMove = onPointerMove;
    this._onClickCapture = onClickCapture;
    this._onScroll = onScroll;

    this.container.addEventListener("pointerdown", onPointerDown, { passive: true });
    this.container.addEventListener("pointermove", onPointerMove, { passive: true });
    this.container.addEventListener("click", onClickCapture, true);
    this.container.addEventListener("scroll", onScroll, { passive: true });

    this._scrollBound = true;
  }

  getIndexFromScroll() {
    const step = this.getStepPx();
    if (!step) return 0;
    return this.clamp(Math.round(this.container.scrollLeft / step), 0, this.totalItems - 1);
  }

  scrollToIndex(i) {
    const step = this.getStepPx();
    const left = i * step;
    this.container.scrollTo({ left, behavior: "smooth" });
  }

  // -----------------------------
  // ARROWS
  // -----------------------------
  updateArrows() {
    const max = this.container.scrollWidth - this.container.clientWidth;
    const atStart = this.container.scrollLeft <= 1;
    const atEnd = this.container.scrollLeft >= max - 1;

    // Usiamo solo le classi CSS invece di modificare gli stili inline
    // per evitare conflitti con i transform CSS su mobile
    if (this.leftArrow) {
      this.leftArrow.setAttribute("aria-disabled", atStart ? "true" : "false");
    }
    if (this.rightArrow) {
      this.rightArrow.setAttribute("aria-disabled", atEnd ? "true" : "false");
    }
  }

  // -----------------------------
  // NAVIGATION
  // -----------------------------
  next() {
    const nextIndex = this.clamp(this.currentIndex + 1, 0, this.totalItems - 1);
    this.currentIndex = nextIndex;
    this.scrollToIndex(nextIndex);
    this.setActiveIndicator(nextIndex);
    this.updateArrows();
  }

  prev() {
    const prevIndex = this.clamp(this.currentIndex - 1, 0, this.totalItems - 1);
    this.currentIndex = prevIndex;
    this.scrollToIndex(prevIndex);
    this.setActiveIndicator(prevIndex);
    this.updateArrows();
  }

  goToPage(pageIndex) {
    this.currentIndex = this.clamp(pageIndex, 0, this.totalItems - 1);
    this.scrollToIndex(this.currentIndex);
    this.setActiveIndicator(this.currentIndex);
    this.updateArrows();
  }

  addKeyboardSupport() {
    // Only respond when carousel is in viewport/focused
    this.container.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.prev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        this.next();
      }
    });
  }
}


// ===== MOBILE MENU =====
function initMobileMenu() {
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
  const mobileMenuClose = document.querySelector('.mobile-menu-close');
  const submenuToggles = document.querySelectorAll('.mobile-submenu-toggle');

  if (mobileMenuBtn && mobileMenuOverlay) {
    // Apri menu
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenuOverlay.classList.add('active');
      mobileMenuBtn.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    // Chiudi menu
    const closeMenu = () => {
      mobileMenuOverlay.classList.remove('active');
      mobileMenuBtn.classList.remove('active');
      document.body.style.overflow = '';

      // Chiudi tutti i submenu quando si chiude il menu
      document.querySelectorAll('.mobile-has-submenu').forEach(item => {
        item.classList.remove('active');
      });
    };

    if (mobileMenuClose) {
      mobileMenuClose.addEventListener('click', closeMenu);
    }

    // Chiudi menu quando si clicca su un link (non sui toggle)
    const mobileLinks = mobileMenuOverlay.querySelectorAll('.mobile-submenu a, .mobile-nav-link:not(.mobile-submenu-toggle)');
    mobileLinks.forEach(link => {
      link.addEventListener('click', closeMenu);
    });
  }

  // Toggle submenu - chiude gli altri submenu automaticamente
  submenuToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const parent = toggle.closest('.mobile-has-submenu');
      const isCurrentlyActive = parent.classList.contains('active');

      // Chiudi tutti i submenu
      document.querySelectorAll('.mobile-has-submenu').forEach(item => {
        item.classList.remove('active');
      });

      // Se non era attivo, aprilo
      if (!isCurrentlyActive) {
        parent.classList.add('active');
      }
    });
  });
}

// ===== SMOOTH SCROLL =====
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href !== '#' && href !== '#!') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });
}

// ===== NEWSLETTER FORM =====
function initNewsletterForm() {
  const form = document.getElementById('newsletter-form');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = form.querySelector('input[type="text"]').value;
      const email = form.querySelector('input[type="email"]').value;
      const checkbox = form.querySelector('input[type="checkbox"]');

      if (!checkbox.checked) {
        alert('Per favore, accetta di ricevere informazioni e promozioni.');
        return;
      }

      // Qui puoi aggiungere la logica per inviare i dati al server
      console.log('Newsletter subscription:', { name, email });

      // Mostra messaggio di successo
      alert('Grazie per esserti iscritto alla nostra newsletter!');
      form.reset();
    });
  }
}

// ===== STICKY HEADER ON SCROLL =====
function initStickyHeader() {
  const header = document.getElementById('main-header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
      header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.15)';
    } else {
      header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    }
  });
}

// ===== INITIALIZE ON PAGE LOAD =====
document.addEventListener('DOMContentLoaded', () => {
  // Inizializza caroselli
  new Carousel('menu');
  new Carousel('events');
  new Carousel('gallery');

  // Inizializza menu mobile
  initMobileMenu();

  // Inizializza smooth scroll
  initSmoothScroll();

  // Inizializza newsletter form
  initNewsletterForm();

  // Inizializza sticky header
  initStickyHeader();

  // Animazioni scroll opzionali
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(section);
  });
});