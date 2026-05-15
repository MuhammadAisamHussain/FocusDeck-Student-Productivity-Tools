// ============================================
// eCargoWorld — Landing Page Scripts
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    initNavbar();
    initMobileMenu();
    initQuoteForm();
    initScrollAnimations();
    await loadDynamicImages();
    await loadCertifications();
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

async function loadCertifications() {
    try {
        var result = await supabase.from('settings').select('*').single();
        if (result.error || !result.data) return;
        var settings = result.data;

        var badgesHtml = '';
        for (var i = 1; i <= 5; i++) {
            var urlKey = 'cert_' + i + '_url';
            var url = settings[urlKey] || '';
            if (url) {
                badgesHtml += '<img src="' + url + '" alt="Certification" class="cert-logo-img">';
            }
        }

        var badgesDiv = document.getElementById('certBadges');
        if (badgesDiv) badgesDiv.innerHTML = badgesHtml;
    } catch(e) {
        console.log('Certifications not loaded');
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

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var submitBtn = form.querySelector('button[type="submit"]');
        var originalText = submitBtn.textContent;
        submitBtn.textContent = 'Opening Email...';
        submitBtn.disabled = true;

        var name = document.getElementById('qfName').value.trim();
        var company = document.getElementById('qfCompany').value.trim();
        var phone = document.getElementById('qfPhone').value.trim();
        var email = document.getElementById('qfEmail').value.trim();
        var origin = document.getElementById('qfOrigin').value.trim();
        var destination = document.getElementById('qfDestination').value.trim();
        var weight = document.getElementById('qfWeight').value.trim();
        var volume = document.getElementById('qfVolume').value.trim();
        var freightTerms = document.getElementById('qfFreightTerms').value;
        var deliveryTerms = document.getElementById('qfDeliveryTerms').value;
        var message = document.getElementById('qfMessage').value.trim();

        // Save to database silently
        saveQuoteToDatabase({
            name: name, company: company, phone: phone, email: email,
            origin: origin, destination: destination, weight: weight,
            volume: volume, freight_terms: freightTerms,
            delivery_terms: deliveryTerms, message: message,
            submitted_at: new Date().toISOString()
        });

        // Build mailto: link
        var subject = 'Quote Request from ' + name + ' - ' + origin + ' to ' + destination;
        var body = 'QUOTE REQUEST DETAILS\n';
        body += '══════════════════════\n\n';
        body += 'CONTACT INFORMATION\n';
        body += '───────────────────\n';
        body += 'Name: ' + name + '\n';
        body += 'Company: ' + (company || 'N/A') + '\n';
        body += 'Phone: ' + phone + '\n';
        body += 'Email: ' + email + '\n\n';
        body += 'SHIPMENT DETAILS\n';
        body += '────────────────\n';
        body += 'Origin: ' + origin + '\n';
        body += 'Destination: ' + destination + '\n';
        body += 'Gross Weight: ' + weight + '\n';
        body += 'Volume: ' + volume + '\n';
        body += 'Freight Terms: ' + freightTerms + '\n';
        body += 'Delivery Terms: ' + deliveryTerms + '\n\n';
        if (message) {
            body += 'ADDITIONAL NOTES\n';
            body += '────────────────\n';
            body += message + '\n\n';
        }
        body += '────────────────────────────\n';
        body += 'Submitted via eCargoWorld Website\n';

        // Open default email client
        var mailtoLink = 'mailto:info@ecargopk.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        window.location.href = mailtoLink;

        // Reset form
        form.reset();
        showToast('Your email client has been opened. Please send the email to complete your request.', 'success');

        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    });
}

function saveQuoteToDatabase(formData) {
    try {
        if (typeof supabase !== 'undefined' && supabase.from) {
            supabase.from('quote_requests').insert({
                name: formData.name, company: formData.company,
                phone: formData.phone, email: formData.email,
                origin: formData.origin, destination: formData.destination,
                weight: formData.weight, volume: formData.volume,
                freight_terms: formData.freight_terms, delivery_terms: formData.delivery_terms,
                message: formData.message, created_at: new Date().toISOString()
            }).then(function() {
                console.log('Quote saved to database');
            });
        }
    } catch (e) {
        console.log('Quote DB save skipped');
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
