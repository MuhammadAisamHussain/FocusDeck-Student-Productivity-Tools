document.addEventListener('DOMContentLoaded', async () => {
    initNavbar();
    initMobileMenu();
    initQuoteForm();
    initCaptcha();
    initScrollAnimations();
    await loadDynamicImages();
});

async function loadDynamicImages() {
    try {
        let settings = null;
        if (typeof supabase !== 'undefined' && supabase.from) {
            const { data, error } = await supabase.from('settings').select('*').single();
            if (!error && data) settings = data;
        }
        document.querySelectorAll('.dynamic-image').forEach(img => {
            const slot = img.dataset.slot;
            if (settings && settings[slot]) {
                img.src = settings[slot];
                img.style.visibility = 'visible';
            }
        });
        document.querySelectorAll('.dynamic-bg').forEach(bg => {
            const slot = bg.dataset.slot;
            if (settings && settings[slot]) {
                bg.style.backgroundImage = `url(${settings[slot]})`;
            }
        });
    } catch (error) {
        console.log('Dynamic images: using fallbacks');
    }
}

function initNavbar() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
}

function initMobileMenu() {
    const toggle = document.querySelector('.mobile-toggle');
    const navLinks = document.querySelector('.nav-links');
    toggle?.addEventListener('click', () => navLinks.classList.toggle('active'));
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => navLinks.classList.remove('active'));
    });
}

function initCaptcha() {
    const captchaText = document.getElementById('captchaText');
    const refreshBtn = document.getElementById('captchaRefresh');
    function generateCaptcha() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    }
    refreshBtn?.addEventListener('click', () => { if (captchaText) captchaText.textContent = generateCaptcha(); });
    if (captchaText) captchaText.textContent = generateCaptcha();
}

function initQuoteForm() {
    const form = document.getElementById('quoteForm');
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const captchaInput = document.getElementById('captchaInput');
        const captchaText = document.getElementById('captchaText');
        if (captchaInput && captchaText && captchaInput.value.toUpperCase() !== captchaText.textContent.toUpperCase()) {
            showToast('Invalid captcha code. Please try again.', 'error');
            captchaText.textContent = generateCaptcha();
            captchaInput.value = '';
            return;
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
        setTimeout(() => {
            showToast('Thank you! We\'ll get back to you within 24 hours.', 'success');
            form.reset();
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
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `position:fixed;bottom:30px;right:30px;background:${type==='error'?'#DC2626':'#2E3F5C'};color:white;padding:16px 24px;border-radius:10px;font-family:'Poppins',sans-serif;font-weight:500;font-size:0.9rem;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.2);max-width:420px;animation:slideIn 0.3s ease-out;`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'slideOut 0.3s ease-in'; setTimeout(() => toast.remove(), 300); }, 5000);
}

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) { entry.target.style.opacity = '1'; entry.target.style.transform = 'translateY(0)'; }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.why-card, .service-block, .office-card, .mission-card, .values-card, .journey-step').forEach(el => {
        el.style.opacity = '0'; el.style.transform = 'translateY(30px)'; el.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        observer.observe(el);
    });
}

const styleSheet = document.createElement('style');
styleSheet.textContent = `@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}`;
document.head.appendChild(styleSheet);
