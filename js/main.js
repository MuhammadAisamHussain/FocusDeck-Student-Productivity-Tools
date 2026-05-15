// ============================================
// eCargoWorld — Landing Page Scripts
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    initNavbar();
    initMobileMenu();
    initQuoteForm();
    initScrollAnimations();
    await loadDynamicImages();
});

async function loadDynamicImages() {
    try {
        var settings = null;
        if (typeof supabase !== 'undefined' && supabase.from) {
            var result = await supabase.from('settings').select('*').single();
            if (!result.error && result.data) settings = result.data;
        }
        document.querySelectorAll('.dynamic-image').forEach(function(img) {
            var slot = img.dataset.slot;
            if (settings && settings[slot]) {
                img.src = settings[slot];
                img.style.visibility = 'visible';
            }
        });
        document.querySelectorAll('.dynamic-bg').forEach(function(bg) {
            var slot = bg.dataset.slot;
            if (settings && settings[slot]) {
                bg.style.backgroundImage = 'url(' + settings[slot] + ')';
            }
        });
    } catch (error) {
        console.log('Dynamic images: using fallbacks');
    }
}

function initNavbar() {
    var navbar = document.getElementById('navbar');
    window.addEventListener('scroll', function() {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
}

function initMobileMenu() {
    var toggle = document.querySelector('.mobile-toggle');
    var navLinks = document.querySelector('.nav-links');
    if (toggle) {
        toggle.addEventListener('click', function() { navLinks.classList.toggle('active'); });
    }
    document.querySelectorAll('.nav-links a').forEach(function(link) {
        link.addEventListener('click', function() { navLinks.classList.remove('active'); });
    });
}

function initQuoteForm() {
    var form = document.getElementById('quoteForm');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        var submitBtn = form.querySelector('button[type="submit"]');
        var originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        var formData = {
            name: document.getElementById('qfName').value.trim(),
            company: document.getElementById('qfCompany').value.trim(),
            phone: document.getElementById('qfPhone').value.trim(),
            email: document.getElementById('qfEmail').value.trim(),
            origin: document.getElementById('qfOrigin').value.trim(),
            destination: document.getElementById('qfDestination').value.trim(),
            weight: document.getElementById('qfWeight').value.trim(),
            volume: document.getElementById('qfVolume').value.trim(),
            freight_terms: document.getElementById('qfFreightTerms').value,
            delivery_terms: document.getElementById('qfDeliveryTerms').value,
            message: document.getElementById('qfMessage').value.trim(),
            submitted_at: new Date().toISOString()
        };

        // Try to send via Supabase Edge Function
        var sent = await sendQuoteEmail(formData);

        if (sent) {
            showToast('Quote request submitted! We will get back to you within 24 hours.', 'success');
            form.reset();
        } else {
            // Fallback: store in database
            var saved = await saveQuoteToDatabase(formData);
            if (saved) {
                showToast('Quote request received! We will get back to you within 24 hours.', 'success');
                form.reset();
            } else {
                showToast('Could not submit request. Please email us at info@ecargopk.com', 'error');
            }
        }

        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    });
}

async function sendQuoteEmail(formData) {
    try {
        // Try Supabase Edge Function
        var response = await fetch('https://zijycqosgkycwptofhqs.supabase.co/functions/v1/send-quote-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + window.supabase.supabaseKey
            },
            body: JSON.stringify(formData)
        });
        return response.ok;
    } catch (e) {
        console.log('Edge function not available, using database fallback');
        return false;
    }
}

async function saveQuoteToDatabase(formData) {
    try {
        if (typeof supabase !== 'undefined' && supabase.from) {
            var result = await supabase.from('quote_requests').insert({
                name: formData.name,
                company: formData.company,
                phone: formData.phone,
                email: formData.email,
                origin: formData.origin,
                destination: formData.destination,
                weight: formData.weight,
                volume: formData.volume,
                freight_terms: formData.freight_terms,
                delivery_terms: formData.delivery_terms,
                message: formData.message,
                created_at: new Date().toISOString()
            });
            return !result.error;
        }
        return false;
    } catch (e) {
        return false;
    }
}

function showToast(message, type) {
    type = type || 'success';
    var toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:30px;right:30px;background:' + (type === 'error' ? '#DC2626' : '#2E3F5C') + ';color:white;padding:16px 24px;border-radius:10px;font-family:Poppins,sans-serif;font-weight:500;font-size:0.9rem;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.2);max-width:420px;animation:slideIn 0.3s ease-out;';
    document.body.appendChild(toast);
    setTimeout(function() { toast.style.animation = 'slideOut 0.3s ease-in'; setTimeout(function() { toast.remove(); }, 300); }, 5000);
}

function initScrollAnimations() {
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) { entry.target.style.opacity = '1'; entry.target.style.transform = 'translateY(0)'; }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.why-card, .service-block, .office-card, .mission-card, .values-card, .journey-step').forEach(function(el) {
        el.style.opacity = '0'; el.style.transform = 'translateY(30px)'; el.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        observer.observe(el);
    });
}

var animStyles = document.createElement('style');
animStyles.textContent = '@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}';
document.head.appendChild(animStyles);
