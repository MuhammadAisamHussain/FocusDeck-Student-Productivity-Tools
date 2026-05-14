// ============================================
// eCargoWorld — Login Handler
// ============================================

(function() {
    'use strict';

    var loginForm = document.getElementById('loginForm');
    var loginBtn = document.getElementById('loginBtn');
    var loginError = document.getElementById('loginError');
    var togglePassword = document.getElementById('togglePassword');
    var passwordInput = document.getElementById('password');

    // Toggle password visibility
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            var type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            var eyeIcon = togglePassword.querySelector('svg');
            if (type === 'text') {
                eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
            } else {
                eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
            }
        });
    }

    // Load dynamic logos
    loadLogos();

    // Handle form submission
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Check if already logged in
    checkExistingSession();

    async function handleLogin(e) {
        e.preventDefault();
        
        var email = document.getElementById('email').value.trim();
        var password = document.getElementById('password').value;
        var rememberMe = document.getElementById('rememberMe').checked;
        
        if (!email || !password) {
            showError('Please enter your email and password.');
            return;
        }

        // Show loading state
        setLoading(true);
        hideError();

        try {
            var result = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (result.error) {
                throw result.error;
            }

            if (result.data && result.data.user) {
                // Get user profile to check role
                var profileResult = await window.supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', result.data.user.id)
                    .single();

                if (profileResult.error) {
                    // Profile doesn't exist yet — create it
                    var newProfile = {
                        id: result.data.user.id,
                        email: email,
                        full_name: email.split('@')[0],
                        role: 'employee',
                        is_admin: false
                    };
                    await window.supabase.from('profiles').insert(newProfile);
                    
                    // Redirect to dashboard
                    window.location.href = 'app.html';
                } else {
                    // Profile exists — redirect
                    window.location.href = 'app.html';
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            
            if (error.message.includes('Invalid login credentials')) {
                showError('Invalid email or password. Please try again.');
            } else if (error.message.includes('Email not confirmed')) {
                showError('Please confirm your email address before logging in.');
            } else {
                showError('Login failed: ' + error.message);
            }
            
            setLoading(false);
        }
    }

    async function checkExistingSession() {
        try {
            var result = await window.supabase.auth.getUser();
            if (result.data && result.data.user) {
                // Already logged in — redirect
                window.location.href = 'app.html';
            }
        } catch (e) {
            // Not logged in — stay on login page
        }
    }

    async function loadLogos() {
        try {
            var result = await window.supabase
                .from('settings')
                .select('logo_ecw_url, logo_als_url')
                .single();

            if (result.data) {
                var ecwLogo = document.getElementById('loginLogoEcw');
                var alsLogo = document.getElementById('loginLogoAls');
                
                if (ecwLogo && result.data.logo_ecw_url) {
                    ecwLogo.src = result.data.logo_ecw_url;
                    ecwLogo.style.visibility = 'visible';
                }
                if (alsLogo && result.data.logo_als_url) {
                    alsLogo.src = result.data.logo_als_url;
                    alsLogo.style.visibility = 'visible';
                }
            }
        } catch (e) {
            // Logos not available — that's fine
        }
    }

    function setLoading(isLoading) {
        var btnText = loginBtn.querySelector('.btn-text');
        var btnSpinner = loginBtn.querySelector('.btn-spinner');
        
        if (isLoading) {
            loginBtn.disabled = true;
            btnText.style.display = 'none';
            btnSpinner.style.display = 'flex';
        } else {
            loginBtn.disabled = false;
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
        }
    }

    function showError(message) {
        if (loginError) {
            loginError.textContent = message;
            loginError.style.display = 'block';
        }
    }

    function hideError() {
        if (loginError) {
            loginError.style.display = 'none';
        }
    }
})();
