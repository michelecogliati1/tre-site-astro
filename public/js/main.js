// ===== CAROUSEL CLASS (DESKTOP: INFINITE TRANSFORM) (MOBILE: NATIVE SCROLL) =====
class Carousel {
  constructor(carouselId) {
    this.carouselId = carouselId;
    this.container = document.querySelector(`.carousel-container[data-carousel="${carouselId}"]`);
    if (!this.container) return;

    this.track = this.container.querySelector(".carousel-track");
    this.originalItems = Array.from(this.track.children);

    this.leftArrow = document.querySelector(`.carousel-arrow-left[data-carousel="${carouselId}"]`);
    this.rightArrow = document.querySelector(`.carousel-arrow-right[data-carousel="${carouselId}"]`);
    this.indicatorsContainer = document.querySelector(`.carousel-indicators[data-carousel="${carouselId}"]`);

    this.currentIndex = 0;
    this.itemsPerView = this.getItemsPerView();
    this.isTransitioning = false;

    // mode
    this.isMobile = window.matchMedia("(max-width: 768px)").matches;

    // desktop-only infinite state
    this.items = [];
    this.totalOriginalItems = this.originalItems.length;
    this.totalPages = this.totalOriginalItems;

    // mobile scroll state
    this._raf = 0;
    this._dragged = false;

    this.init();
  }

  init() {
    this.createIndicators();

    if (this.leftArrow) this.leftArrow.addEventListener("click", () => this.prev());
    if (this.rightArrow) this.rightArrow.addEventListener("click", () => this.next());

    // Desktop: swipe “finto” (touchstart/end) → ok con transform
    // Mobile: NON lo usiamo (altrimenti si mischia con scroll nativo)
    if (!this.isMobile) this.addTouchSupport();

    this.addKeyboardSupport();

    window.addEventListener("resize", () => this.handleResize());

    // Setup mode
    if (this.isMobile) {
      this.setupMobile();
    } else {
      this.setupDesktopInfinite();
      this.updateCarousel();
    }
  }

  // -----------------------------
  // RESPONSIVE
  // -----------------------------
  handleResize() {
    const newIsMobile = window.matchMedia("(max-width: 768px)").matches;
    const newItemsPerView = this.getItemsPerView();

    const modeChanged = newIsMobile !== this.isMobile;
    const perViewChanged = newItemsPerView !== this.itemsPerView;

    if (!modeChanged && !perViewChanged) return;

    this.isMobile = newIsMobile;
    this.itemsPerView = newItemsPerView;

    // Cleanup: rimuovi cloni + reset
    this.track.querySelectorAll(".clone").forEach((c) => c.remove());
    this.track.style.transform = "none";
    this.track.classList.add("no-transition");

    // reset listeners mobile scroll (idempotente: non crea doppioni grazie a flag interni)
    this.teardownMobileScroll();

    // re-init per mode
    this.createIndicators();

    if (this.isMobile) {
      this.setupMobile(true);
    } else {
      this.setupDesktopInfinite(true);
      this.updateCarousel(false);
    }
  }

  getItemsPerView() {
    const width = window.innerWidth;

    if (this.carouselId === "gallery") {
      if (width < 768) return 1;
      if (width < 992) return 2;
      return 3;
    }

    if (width < 768) return 1;
    if (width < 1200) return 2;
    return 3;
  }

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
  // INDICATORS
  // -----------------------------
  createIndicators() {
    if (!this.indicatorsContainer) return;

    this.indicatorsContainer.innerHTML = "";

    for (let i = 0; i < this.totalPages; i++) {
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
  // MOBILE MODE (native scroll)
  // -----------------------------
  setupMobile(forceReset = false) {
    // In mobile: niente cloni, niente transform
    this.items = Array.from(this.track.children); // solo originali
    this.totalPages = this.totalOriginalItems;

    // reset transform e transition
    this.track.style.transform = "none";
    this.track.classList.add("no-transition");

    if (forceReset) this.container.scrollLeft = 0;

    // Sync indicator subito
    this.currentIndex = this.getMobileIndexFromScroll();
    this.setActiveIndicator(this.currentIndex);

    this.updateMobileArrows();

    // Scroll listener per sync indicator + arrows
    this.setupMobileScroll();
  }

  setupMobileScroll() {
    if (this._mobileScrollBound) return; // evita doppioni

    // anti “ghost click” dopo swipe
    let startX = 0;
    let startScroll = 0;

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

    const onScroll = () => {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => {
        const idx = this.getMobileIndexFromScroll();
        this.currentIndex = idx;
        this.setActiveIndicator(idx);
        this.updateMobileArrows();
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

    this._mobileScrollBound = true;
  }

  teardownMobileScroll() {
    if (!this._mobileScrollBound) return;

    this.container.removeEventListener("pointerdown", this._onPointerDown);
    this.container.removeEventListener("pointermove", this._onPointerMove);
    this.container.removeEventListener("click", this._onClickCapture, true);
    this.container.removeEventListener("scroll", this._onScroll);

    this._mobileScrollBound = false;
  }

  getMobileIndexFromScroll() {
    const step = this.getStepPx();
    if (!step) return 0;
    return this.clamp(Math.round(this.container.scrollLeft / step), 0, this.totalPages - 1);
  }

  scrollToMobileIndex(i) {
    const step = this.getStepPx();
    const left = i * step;
    this.container.scrollTo({ left, behavior: "smooth" });
  }

  updateMobileArrows() {
    const max = this.container.scrollWidth - this.container.clientWidth;
    const atStart = this.container.scrollLeft <= 1;
    const atEnd = this.container.scrollLeft >= max - 1;

    if (this.leftArrow) {
      this.leftArrow.style.opacity = atStart ? "0.35" : "1";
      this.leftArrow.style.pointerEvents = atStart ? "none" : "auto";
    }
    if (this.rightArrow) {
      this.rightArrow.style.opacity = atEnd ? "0.35" : "1";
      this.rightArrow.style.pointerEvents = atEnd ? "none" : "auto";
    }
  }

  // -----------------------------
  // DESKTOP MODE (infinite transform)
  // -----------------------------
  setupDesktopInfinite(forceReset = false) {
    // ricrea cloni e stato come nel tuo JS originale
    this.itemsPerView = this.getItemsPerView();

    if (forceReset) {
      this.currentIndex = 0;
      this.isTransitioning = false;
    }

    this.setupInfiniteScroll();

    this.items = Array.from(this.track.children);
    this.totalPages = this.totalOriginalItems;

    // riabilita transition
    this.track.classList.remove("no-transition");
  }

  setupInfiniteScroll() {
    const itemsToClone = Math.max(this.itemsPerView * 2, 6);

    // append clones
    for (let i = 0; i < itemsToClone; i++) {
      const clone = this.originalItems[i % this.originalItems.length].cloneNode(true);
      clone.classList.add("clone");
      this.track.appendChild(clone);
    }

    // prepend clones
    for (let i = 0; i < itemsToClone; i++) {
      const clone = this.originalItems[this.originalItems.length - 1 - (i % this.originalItems.length)].cloneNode(true);
      clone.classList.add("clone");
      this.track.insertBefore(clone, this.track.firstChild);
    }

    this.currentIndex = itemsToClone;
  }

  updateCarousel(animate = true) {
    if (this.isMobile) {
      // in mobile non usiamo transform
      this.setActiveIndicator(this.currentIndex);
      this.updateMobileArrows();
      return;
    }

    if (!this.items.length) return;

    const itemWidth = this.items[0].offsetWidth;
    const gap = parseInt(getComputedStyle(this.track).gap) || 32;
    const offset = -(this.currentIndex * (itemWidth + gap));

    if (!animate) this.track.classList.add("no-transition");
    this.track.style.transform = `translateX(${offset}px)`;

    if (!animate) {
      this.track.offsetHeight;
      setTimeout(() => this.track.classList.remove("no-transition"), 50);
    }

    const itemsToClone = Math.max(this.itemsPerView * 2, 6);
    const realIndex = (this.currentIndex - itemsToClone) % this.totalOriginalItems;
    const positiveRealIndex = realIndex < 0 ? this.totalOriginalItems + realIndex : realIndex;

    this.setActiveIndicator(positiveRealIndex);
  }

  next() {
    if (this.isMobile) {
      const nextIndex = this.clamp(this.currentIndex + 1, 0, this.totalPages - 1);
      this.currentIndex = nextIndex;
      this.scrollToMobileIndex(nextIndex);
      this.setActiveIndicator(nextIndex);
      this.updateMobileArrows();
      return;
    }

    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.currentIndex++;
    this.updateCarousel();

    setTimeout(() => {
      this.checkInfiniteScroll();
      this.isTransitioning = false;
    }, 500);
  }

  prev() {
    if (this.isMobile) {
      const prevIndex = this.clamp(this.currentIndex - 1, 0, this.totalPages - 1);
      this.currentIndex = prevIndex;
      this.scrollToMobileIndex(prevIndex);
      this.setActiveIndicator(prevIndex);
      this.updateMobileArrows();
      return;
    }

    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.currentIndex--;
    this.updateCarousel();

    setTimeout(() => {
      this.checkInfiniteScroll();
      this.isTransitioning = false;
    }, 500);
  }

  checkInfiniteScroll() {
    const itemsToClone = Math.max(this.itemsPerView * 2, 6);
    const totalItems = this.items.length;

    if (this.currentIndex >= totalItems - itemsToClone) {
      this.currentIndex = itemsToClone + (this.currentIndex - (totalItems - itemsToClone));
      this.updateCarousel(false);
    }

    if (this.currentIndex < itemsToClone) {
      this.currentIndex = totalItems - itemsToClone - (itemsToClone - this.currentIndex);
      this.updateCarousel(false);
    }
  }

  goToPage(pageIndex) {
    if (this.isMobile) {
      this.currentIndex = this.clamp(pageIndex, 0, this.totalPages - 1);
      this.scrollToMobileIndex(this.currentIndex);
      this.setActiveIndicator(this.currentIndex);
      this.updateMobileArrows();
      return;
    }

    if (this.isTransitioning) return;
    const itemsToClone = Math.max(this.itemsPerView * 2, 6);
    this.currentIndex = itemsToClone + pageIndex;
    this.updateCarousel();
  }

  addTouchSupport() {
    let touchStartX = 0;
    let touchEndX = 0;

    this.container.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
      },
      { passive: true }
    );

    this.container.addEventListener(
      "touchend",
      (e) => {
        touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe(touchStartX, touchEndX);
      },
      { passive: true }
    );
  }

  handleSwipe(startX, endX) {
    const swipeThreshold = 50;
    const diff = startX - endX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) this.next();
      else this.prev();
    }
  }

  addKeyboardSupport() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") this.prev();
      if (e.key === "ArrowRight") this.next();
    });
  }
}


// ===== MOBILE MENU =====
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

        // Chiudi menu quando si clicca su un link
        const mobileLinks = mobileMenuOverlay.querySelectorAll('.mobile-submenu a, .mobile-nav-link:not(.mobile-submenu-toggle)');
        mobileLinks.forEach(link => {
            link.addEventListener('click', closeMenu);
        });
    }

    // Toggle submenu - chiude gli altri submenu automaticamente
    submenuToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
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

            const formData = new FormData(form);
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
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 100) {
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.15)';
        } else {
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        }

        lastScroll = currentScroll;
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