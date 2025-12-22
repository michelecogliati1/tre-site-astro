// ===== CAROUSEL CLASS CON INFINITE SCROLL (1 CARD ALLA VOLTA) =====
class Carousel {
    constructor(carouselId) {
        this.carouselId = carouselId;
        this.container = document.querySelector(`.carousel-container[data-carousel="${carouselId}"]`);

        if (!this.container) return;

        this.track = this.container.querySelector('.carousel-track');
        this.originalItems = Array.from(this.track.children);
        this.leftArrow = document.querySelector(`.carousel-arrow-left[data-carousel="${carouselId}"]`);
        this.rightArrow = document.querySelector(`.carousel-arrow-right[data-carousel="${carouselId}"]`);
        this.indicatorsContainer = document.querySelector(`.carousel-indicators[data-carousel="${carouselId}"]`);

        this.currentIndex = 0;
        this.itemsPerView = this.getItemsPerView();
        this.isTransitioning = false;

        this.setupInfiniteScroll();

        this.items = Array.from(this.track.children);
        this.totalOriginalItems = this.originalItems.length;
        this.totalPages = this.totalOriginalItems;

        this.init();
    }

    setupInfiniteScroll() {
        const itemsToClone = Math.max(this.itemsPerView * 2, 6);

        for (let i = 0; i < itemsToClone; i++) {
            const clone = this.originalItems[i % this.originalItems.length].cloneNode(true);
            clone.classList.add('clone');
            this.track.appendChild(clone);
        }

        for (let i = 0; i < itemsToClone; i++) {
            const clone = this.originalItems[this.originalItems.length - 1 - (i % this.originalItems.length)].cloneNode(true);
            clone.classList.add('clone');
            this.track.insertBefore(clone, this.track.firstChild);
        }

        this.currentIndex = itemsToClone;
    }

    init() {
        this.createIndicators();

        if (this.leftArrow) {
            this.leftArrow.addEventListener('click', () => this.prev());
        }
        if (this.rightArrow) {
            this.rightArrow.addEventListener('click', () => this.next());
        }

        this.addTouchSupport();
        this.addKeyboardSupport();

        window.addEventListener('resize', () => this.handleResize());

        this.updateCarousel();
    }

    getItemsPerView() {
        const width = window.innerWidth;

        if (this.carouselId === 'gallery') {
            if (width < 768) return 1;
            if (width < 992) return 2;
            return 3;
        }

        if (width < 768) return 1;
        if (width < 1200) return 2;
        return 3;
    }

    createIndicators() {
        if (!this.indicatorsContainer) return;

        this.indicatorsContainer.innerHTML = '';

        for (let i = 0; i < this.totalPages; i++) {
            const indicator = document.createElement('button');
            indicator.classList.add('carousel-indicator');
            indicator.setAttribute('aria-label', `Vai alla slide ${i + 1}`);

            if (i === 0) indicator.classList.add('active');

            indicator.addEventListener('click', () => this.goToPage(i));
            this.indicatorsContainer.appendChild(indicator);
        }
    }

    updateCarousel(animate = true) {
        if (!this.items.length) return;

        const itemWidth = this.items[0].offsetWidth;
        const gap = parseInt(getComputedStyle(this.track).gap) || 32;
        const offset = -(this.currentIndex * (itemWidth + gap));

        if (!animate) {
            this.track.classList.add('no-transition');
        }

        this.track.style.transform = `translateX(${offset}px)`;

        if (!animate) {
            this.track.offsetHeight;
            setTimeout(() => {
                this.track.classList.remove('no-transition');
            }, 50);
        }

        const itemsToClone = Math.max(this.itemsPerView * 2, 6);
        const realIndex = (this.currentIndex - itemsToClone) % this.totalOriginalItems;
        const positiveRealIndex = realIndex < 0 ? this.totalOriginalItems + realIndex : realIndex;

        const indicators = this.indicatorsContainer?.querySelectorAll('.carousel-indicator');
        indicators?.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === positiveRealIndex);
        });
    }

    next() {
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
        if (this.isTransitioning) return;

        const itemsToClone = Math.max(this.itemsPerView * 2, 6);

        this.currentIndex = itemsToClone + pageIndex;
        this.updateCarousel();
    }

    addTouchSupport() {
        let touchStartX = 0;
        let touchEndX = 0;

        this.container.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        this.container.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe(touchStartX, touchEndX);
        }, { passive: true });
    }

    handleSwipe(startX, endX) {
        const swipeThreshold = 50;
        const diff = startX - endX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                this.next();
            } else {
                this.prev();
            }
        }
    }

    addKeyboardSupport() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });
    }

    handleResize() {
        const newItemsPerView = this.getItemsPerView();

        if (newItemsPerView !== this.itemsPerView) {
            this.itemsPerView = newItemsPerView;

            this.track.querySelectorAll('.clone').forEach(clone => clone.remove());

            this.setupInfiniteScroll();

            this.items = Array.from(this.track.children);
            this.totalPages = this.totalOriginalItems;

            this.createIndicators();
            this.updateCarousel(false);
        }
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