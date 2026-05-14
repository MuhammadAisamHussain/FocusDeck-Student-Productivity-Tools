// ============================================
// eCargoWorld — Landing Page Scripts
// Dynamic image loading from Supabase settings
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    initNavbar();
    initMobileMenu();
    initQuoteForm();
    initCaptcha();
    initScrollAnimations();
    await loadDynamicImages();
});

// ============ DYNAMIC IMAGE LOADING ============
async function loadDynamicImages() {
    try {
        // Try to load settings from Supabase
        let settings = null;
        
        if (typeof supabase !== 'undefined' && supabase.from) {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .single();
            
            if (!error && data) {
                settings = data;
            }
        }

        // Apply settings to all dynamic images
        document.querySelectorAll('.dynamic-image').forEach(img => {
            const slot = img.dataset.slot;
            const fallback = img.dataset.fallback;
            
            if (settings && settings[slot]) {
                // Use uploaded image from admin panel
                img.src = settings[slot];
                img.style.visibility = 'visible';
            } else if (fallback) {
                // Use local fallback image
                img.src = fallback;
                img.style.visibility = 'visible';
            }
            // If no fallback and no setting, image stays hidden (CSS handles this)
        });

        // Apply background images
        document.querySelectorAll('.dynamic-bg').forEach(bg => {
            const slot = bg.dataset.slot;
            if (settings && settings[slot]) {
                bg.style.backgroundImage = `url(${settings[slot]})`;
            }
        });

        // Update company info if settings loaded
        if (settings) {
            updateCompanyInfo(settings);
        }

    } catch (error) {
        console.log('Dynamic images: using fallbacks (Supabase not connected)');
        // Load fallbacks for images that have them
        document.querySelectorAll('.dynamic-image[data-fallback]').forEach(img => {
            if (!img.src || img.src === window.location.href) {
                img.src = img.dataset.fallback;
                img.style.visibility = 'visible';
            }
        });
    }
}

function updateCompanyInfo(settings) {
    // Update email displays
    if (settings.company_email) {
        document.querySelectorAll('.office-email strong + *').forEach(el => {
            // This is a simplified update — in production, use specific selectors
        });
    }
    
    // Update phone numbers
    if (settings.company_phone) {
        // Would update phone displays
    }
    
    // Update company name
    if (settings.company_name) {
        document.title = `${settings.company_name} — Global Freight Forwarding`;
    }
}

// ============ NAVBAR ============
function initNavbar() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

// ============ MOBILE MENU ============
function initMobileMenu() {
    const toggle = document.querySelector('.mobile-toggle');
    const navLinks = document.querySelector('.nav-links');

    toggle?.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
        });
    });
}

// ============ CAPTCHA ============
function initCaptcha() {
    const captchaText = document.getElementById('captchaText');
    const refreshBtn = document.getElementById('captchaRefresh');
    
    function generateCaptcha() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    refreshBtn?.addEventListener('click', () => {
        if (captchaText) {
            captchaText.textContent = generateCaptcha();
        }
    });

    // Initial captcha
    if (captchaText) {
        captchaText.textContent = generateCaptcha();
    }
}

// ============ QUOTE FORM ============
function initQuoteForm() {
    const form = document.getElementById('quoteForm');
    
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate captcha
        const captchaInput = document.getElementById('captchaInput');
        const captchaText = document.getElementById('captchaText');
        
        if (captchaInput && captchaText) {
            if (captchaInput.value.toUpperCase() !== captchaText.textContent.toUpperCase()) {
                showToast('Invalid captcha code. Please try again.', 'error');
                captchaText.textContent = generateCaptcha();
                captchaInput.value = '';
                return;
            }
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        const formData = {
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            date: document.getElementById('date').value,
            message: document.getElementById('message').value,
            submitted_at: new Date().toISOString()
        };

        console.log('Quote request:', formData);

        // Simulate submission
        setTimeout(() => {
            showToast('Thank you! Your inquiry has been submitted. We\'ll get back to you within 24 hours.', 'success');
            form.reset();
            // Reset captcha
            const ct = document.getElementById('captchaText');
            if (ct) ct.textContent = generateCaptcha();
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 1000);
    });
}

function generateCaptcha() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ============ TOAST ============
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 30px; right: 30px;
        background: ${type === 'error' ? '#DC2626' : '#2E3F5C'};
        color: white; padding: 16px 24px; border-radius: 10px;
        font-family: 'Poppins', sans-serif; font-weight: 500; font-size: 0.9rem;
        z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        max-width: 420px;
        animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ============ SCROLL ANIMATIONS ============
function initScrollAnimations() {
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

    document.querySelectorAll('.why-card, .service-block, .office-card, .mission-card, .values-card, .journey-step').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        observer.observe(el);
    });
}

// Add animation keyframes
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(styleSheet);
