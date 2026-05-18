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
        
        if (!email || !password) {
            showError('Please enter your email and password.');
            return;
        }

        setLoading(true);
        hideError();

        try {
            var result = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (result.error) throw result.error;

            if (result.data && result.data.user) {
                var profileResult = await window.supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', result.data.user.id)
                    .single();

                if (profileResult.error) {
                    var newProfile = {
                        id: result.data.user.id,
                        email: email,
                        full_name: email.split('@')[0],
                        role: 'employee',
                        is_admin: false
                    };
                    await window.supabase.from('profiles').insert(newProfile);
                }

                window.location.href = 'app.html';
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
                window.location.href = 'app.html';
            }
        } catch (e) {}
    }

    async function loadLogos() {
        try {
            var result = await window.supabase
                .from('settings')
                .select('logo_ecw_url, logo_als_url')
                .single();

            if (result.data) {
                var ecwLogo = document.getElementById('loginLogoEcw');
                if (ecwLogo && result.data.logo_ecw_url) {
                    ecwLogo.src = result.data.logo_ecw_url;
                    ecwLogo.style.visibility = 'visible';
                }
            }
        } catch (e) {}
    }

    function setLoading(isLoading) {
        var btnText = loginBtn.querySelector('.btn-text');
        var btnSpinner = loginBtn.querySelector('.btn-spinner');
        
        if (isLoading) {
            loginBtn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (btnSpinner) btnSpinner.style.display = 'flex';
        } else {
            loginBtn.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (btnSpinner) btnSpinner.style.display = 'none';
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
