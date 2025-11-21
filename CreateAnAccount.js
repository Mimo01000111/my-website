// CreateAnAccount.js - Fixed & Enhanced Version

// Global variables
let currentStep = 1;
let currentOTP = null;
let emailVerified = false;
let otpExpiry = null;
let countdownInterval = null;
let capturedFaces = {
    front: false,
    left: false,
    right: false,
    closed: false
};
let webcamStream = null;
let formData = {
    personalInfo: {},
    householdInfo: {},
    documents: {},
    faceCaptures: {},
    accountInfo: {}
};

// Safe DOM helpers
function getEl(id) { return document.getElementById(id) || null; }
function getVal(id) { const el = getEl(id); return el ? (el.value ?? '') : ''; }
function setVal(id, value) { const el = getEl(id); if (el) el.value = value; }
function toggleDisplay(id, display) { const el = getEl(id); if (el) el.style.display = display; }
function exists(id) { return !!getEl(id); }

// Initialize EmailJS
(function(){
    try {
        if (typeof emailjs !== 'undefined' && emailjs.init) {
            emailjs.init("0gk0L5jm4E-8teqLe");
        } else {
            console.warn('EmailJS not available in this context.');
        }
    } catch (e) {
        console.error('Failed to init EmailJS:', e);
    }
})();

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    updateProgress();
    setupEventListeners();
    setupOtherInputs();
    setupFileUploads();
    setupPhoneFormatting();
    loadSavedData();
    
    // Add real-time validation for Middle Name
    const middleNameInput = getEl('middleName');
    if (middleNameInput) {
        middleNameInput.addEventListener('input', function() {
            validateMiddleName();
        });
        middleNameInput.addEventListener('blur', function() {
            validateMiddleName();
        });
    }
});

// Validate Middle Name in real-time
function validateMiddleName() {
    const middleName = getEl('middleName');
    const middleNameError = getEl('middleName-error');
    
    if (!middleName || !middleNameError) return;
    
    const value = middleName.value.trim();
    
    if (value === '') {
        middleName.classList.remove('success');
        middleName.classList.remove('error');
        middleNameError.style.display = 'none';
        return;
    }
    
    if (value.length > 0 && (value.toLowerCase() === 'n/a' || value.length >= 2)) {
        middleName.classList.add('success');
        middleName.classList.remove('error');
        middleNameError.style.display = 'none';
    } else {
        middleName.classList.remove('success');
        middleName.classList.add('error');
        middleNameError.style.display = 'block';
    }
}

// Set up event listeners
function setupEventListeners() {
    // Navigation buttons
    document.querySelectorAll('.btn-next').forEach(button => {
        if (button) button.addEventListener('click', handleNextStep);
    });
    document.querySelectorAll('.btn-prev').forEach(button => {
        if (button) button.addEventListener('click', handlePrevStep);
    });

    // Terms and Conditions modal
    if (exists('show-terms-btn')) getEl('show-terms-btn').addEventListener('click', showTermsModal);
    if (exists('closeTermsModal')) getEl('closeTermsModal').addEventListener('click', closeTermsModal);
    if (exists('cancelTerms')) getEl('cancelTerms').addEventListener('click', closeTermsModal);
    if (exists('confirmTerms')) getEl('confirmTerms').addEventListener('click', confirmTerms);

    // OTP functionality
    if (exists('send-otp')) getEl('send-otp').addEventListener('click', sendOTP);
    if (exists('verify-otp-btn')) getEl('verify-otp-btn').addEventListener('click', verifyOTP);
    if (exists('resend-otp')) getEl('resend-otp').addEventListener('click', sendOTP);

    // Password visibility toggle
    if (exists('togglePassword')) getEl('togglePassword').addEventListener('click', togglePasswordVisibility);
    if (exists('toggleConfirmPassword')) getEl('toggleConfirmPassword').addEventListener('click', toggleConfirmPasswordVisibility);

    // Real-time validation
    if (exists('password')) getEl('password').addEventListener('input', validatePassword);
    if (exists('confirmPassword')) getEl('confirmPassword').addEventListener('input', validatePasswordConfirmation);
    if (exists('dateOfBirth')) getEl('dateOfBirth').addEventListener('change', calculateAge);

    // Webcam functionality
    if (exists('startWebcam')) getEl('startWebcam').addEventListener('click', startWebcam);
    if (exists('captureImage')) getEl('captureImage').addEventListener('click', captureImage);
    if (exists('retakeImage')) getEl('retakeImage').addEventListener('click', retakeImage);

    // Face capture buttons
    ['front','left','right','closed'].forEach(face => {
        const btnId = `capture-${face}`;
        if (exists(btnId)) getEl(btnId).addEventListener('click', () => captureFace(face));
    });

    // Retake face buttons
    document.querySelectorAll('.retake-face-btn').forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', function() {
            const faceType = this.getAttribute('data-face');
            if (faceType) retakeFaceCapture(faceType);
        });
    });

    // File upload
    if (exists('idFront')) getEl('idFront').addEventListener('change', () => handleIdFileUpload('front'));
    if (exists('idBack')) getEl('idBack').addEventListener('change', () => handleIdFileUpload('back'));
    if (exists('residenceFile')) getEl('residenceFile').addEventListener('change', function(e) {
        handleFileUpload(e, 'residenceImagePreview', 'residencePreview', 'residenceFilePreviewContainer', 'residence');
    });

    // File deletion buttons
    if (exists('deleteResidenceFile')) getEl('deleteResidenceFile').addEventListener('click', () => deleteFile('residence'));
    if (exists('deleteIdFront')) getEl('deleteIdFront').addEventListener('click', () => deleteFile('idFront'));
    if (exists('deleteIdBack')) getEl('deleteIdBack').addEventListener('click', () => deleteFile('idBack'));

    // Return to home button
    if (exists('returnToHome')) getEl('returnToHome').addEventListener('click', returnToHome);

    // Print confirmation button
    if (exists('printConfirmation')) getEl('printConfirmation').addEventListener('click', printConfirmation);

    // Citizenship and occupation dropdowns
    if (exists('citizenship')) getEl('citizenship').addEventListener('change', function() {
        toggleOtherInput(this, 'otherCitizenship');
    });
    if (exists('occupation')) getEl('occupation').addEventListener('change', function() {
        toggleOtherInput(this, 'otherOccupation');
    });

    // Extension name toggle
    if (exists('extName')) getEl('extName').addEventListener('change', function() {
        toggleOtherExt(this);
    });

    // Auto-save on input changes
    setupAutoSave();

    // Add real-time validation
    setupRealTimeValidation();
}

// Real-time validation for Step 1 fields
function setupRealTimeValidation() {
    const requiredFields = [
        'lastName', 'firstName', 'gender', 'dateOfBirth', 'address',
        'placeOfBirth', 'age', 'phone', 'civilStatus', 'citizenship',
        'occupation', 'email', 'password', 'confirmPassword'
    ];

    requiredFields.forEach(fieldId => {
        const field = getEl(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                validateSingleField(fieldId);
            });
            field.addEventListener('blur', function() {
                validateSingleField(fieldId);
            });
        }
    });

    // Dropdowns: change event
    ['gender', 'civilStatus', 'citizenship', 'occupation'].forEach(dropdownId => {
        const dropdown = getEl(dropdownId);
        if (dropdown) dropdown.addEventListener('change', function() {
            validateSingleField(dropdownId);
        });
    });

    const extName = getEl('extName');
    if (extName) extName.addEventListener('change', function() { validateSingleField('extName'); });
}

// Validate a single field in real-time
function validateSingleField(fieldId) {
    const field = getEl(fieldId);
    const errorElement = getEl(`${fieldId}-error`);
    if (!field || !errorElement) return;

    let isValid = true;
    let errorMessage = '';

    switch(fieldId) {
        case 'lastName':
        case 'firstName':
        case 'address':
        case 'placeOfBirth':
            isValid = field.value.trim().length > 0;
            errorMessage = `Please enter your ${fieldId.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
            break;

        case 'gender':
        case 'civilStatus':
        case 'citizenship':
        case 'occupation':
            isValid = field.value !== '';
            errorMessage = `Please select your ${fieldId.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
            break;

        case 'dateOfBirth':
            isValid = field.value !== '';
            errorMessage = 'Please enter your date of birth';
            if (field.value) {
                const dob = new Date(field.value);
                const today = new Date();
                let age = today.getFullYear() - dob.getFullYear();
                const monthDiff = today.getMonth() - dob.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
                if (age < 18) {
                    isValid = false;
                    errorMessage = 'You must be at least 18 years old to register';
                }
            }
            break;

        case 'age':
            isValid = field.value !== '' && parseInt(field.value, 10) >= 18;
            errorMessage = 'Please enter a valid age (must be at least 18)';
            break;

        case 'phone':
            {
                const phoneRegex = /^\+63\s?9\d{2}[- ]?\d{3}[- ]?\d{4}$/;
                isValid = phoneRegex.test(field.value);
                errorMessage = 'Please enter a valid Philippine phone number starting with +63';
            }
            break;

        case 'email':
            {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                isValid = emailRegex.test(field.value);
                errorMessage = 'Please enter a valid email address';

                const emailSuccess = getEl('email-success');
                if (emailSuccess) {
                    if (isValid) {
                        emailSuccess.style.display = 'block';
                        if (getEl('send-otp')) getEl('send-otp').disabled = false;
                    } else {
                        emailSuccess.style.display = 'none';
                        if (getEl('send-otp')) getEl('send-otp').disabled = true;
                    }
                }

                // Reset OTP verification if email changes
                if (emailVerified) resetOTPVerification();
            }
            break;

        case 'password':
            isValid = validatePasswordStrength(field.value);
            if (isValid) updatePasswordRequirements(field.value);
            break;

        case 'confirmPassword':
            {
                const password = getVal('password');
                isValid = field.value === password && field.value !== '';
                errorMessage = 'Passwords do not match';
                const matchMessage = getEl('password-match-message');
                if (matchMessage) {
                    matchMessage.style.display = isValid ? 'block' : 'none';
                }
            }
            break;

        case 'extName':
            {
                const otherExt = getEl('otherExt');
                isValid = field.value !== '' || (otherExt && otherExt.value.trim() !== '');
                errorMessage = 'Please select or specify your extension name';
            }
            break;
    }

    if (isValid) {
        field.classList.remove('error');
        field.classList.add('success');
        errorElement.style.display = 'none';
    } else {
        field.classList.add('error');
        field.classList.remove('success');
        if (field.value.trim() !== '') {
            errorElement.textContent = errorMessage;
            errorElement.style.display = 'block';
        } else {
            errorElement.style.display = 'none';
        }
    }
}

// Enhanced password strength validation
function validatePasswordStrength(password) {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[@_><,?]/.test(password);
    const isLongEnough = password.length >= 10;
    return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && isLongEnough;
}

// Update password requirements in real-time
function updatePasswordRequirements(password) {
    const requirements = {
        'req-length': password.length >= 10,
        'req-uppercase': /[A-Z]/.test(password),
        'req-lowercase': /[a-z]/.test(password),
        'req-number': /\d/.test(password),
        'req-special': /[@_><,?]/.test(password)
    };

    Object.keys(requirements).forEach(reqId => {
        const element = getEl(reqId);
        if (!element) return;
        if (requirements[reqId]) {
            element.classList.remove('invalid');
            element.classList.add('valid');
        } else {
            element.classList.remove('valid');
            element.classList.add('invalid');
        }
    });
}

// Auto-save functionality (debounced)
function setupAutoSave() {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (!input) return;
        input.addEventListener('change', saveFormData);
        input.addEventListener('input', debounce(saveFormData, 1000));
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Save form data to localStorage
function saveFormData() {
    const data = collectFormData();
    try {
        localStorage.setItem('barangayRegistrationData', JSON.stringify(data));
        localStorage.setItem('barangayRegistrationCurrentStep', currentStep.toString());
    } catch (e) {
        console.error('Failed saving to localStorage:', e);
    }
}

// Load saved data from localStorage
function loadSavedData() {
    try {
        const savedData = localStorage.getItem('barangayRegistrationData');
        const savedStep = localStorage.getItem('barangayRegistrationCurrentStep');

        if (savedData) {
            const data = JSON.parse(savedData);
            populateFormData(data);
        }

        if (savedStep) {
            currentStep = parseInt(savedStep, 10) || 1;
            showStep(currentStep);
            updateProgress();
        }
    } catch (e) {
        console.error('Failed to load saved data:', e);
    }
}

// Helper to collect file preview src
function getPreviewSrc(previewId) {
    const img = getEl(previewId);
    return (img && img.src) ? img.src : '';
}

// Collect all form data
function collectFormData() {
    return {
        personalInfo: {
            lastName: getVal('lastName'),
            firstName: getVal('firstName'),
            middleName: getVal('middleName'),
            extName: getVal('extName'),
            otherExt: getVal('otherExt'),
            gender: getVal('gender'),
            dateOfBirth: getVal('dateOfBirth'),
            address: getVal('address'),
            placeOfBirth: getVal('placeOfBirth'),
            age: getVal('age'),
            phone: getVal('phone'),
            civilStatus: getVal('civilStatus'),
            citizenship: getVal('citizenship'),
            otherCitizenship: getVal('otherCitizenship'),
            occupation: getVal('occupation'),
            otherOccupation: getVal('otherOccupation'),
            specialCategories: getSelectedCategories()
        },
        accountInfo: {
            email: getVal('email'),
            password: getVal('password'),
            emailVerified: emailVerified
        },
        householdInfo: {
            propertyUrl: getVal('propertyUrl'),
            householdMembers: getVal('householdMembers'),
            ownerName: getVal('ownerName'),
            precinctNo: getVal('precinctNo'),
            yearsInBarangay: getVal('yearsInBarangay')
        },
        documents: {
            idType: getVal('idType'),
            userReason: getVal('userReason'),
            residencePreviewSrc: getPreviewSrc('residenceImagePreview'),
            idFrontPreviewSrc: getPreviewSrc('idFrontImagePreview'),
            idBackPreviewSrc: getPreviewSrc('idBackImagePreview')
        },
        faceCaptures: {
            flags: { ...capturedFaces },
            frontPreview: getPreviewSrc('frontFacePreview'),
            leftPreview: getPreviewSrc('leftFacePreview'),
            rightPreview: getPreviewSrc('rightFacePreview'),
            closedPreview: getPreviewSrc('closedFacePreview')
        },
        currentStep: currentStep
    };
}

// Populate form with saved data
function populateFormData(data) {
    if (!data) return;

    // Personal Info
    if (data.personalInfo) {
        setVal('lastName', data.personalInfo.lastName || '');
        setVal('firstName', data.personalInfo.firstName || '');
        setVal('middleName', data.personalInfo.middleName || '');
        setVal('extName', data.personalInfo.extName || '');
        setVal('otherExt', data.personalInfo.otherExt || '');
        setVal('gender', data.personalInfo.gender || '');
        setVal('dateOfBirth', data.personalInfo.dateOfBirth || '');
        setVal('address', data.personalInfo.address || '');
        setVal('placeOfBirth', data.personalInfo.placeOfBirth || '');
        setVal('age', data.personalInfo.age || '');
        setVal('phone', data.personalInfo.phone || '');
        setVal('civilStatus', data.personalInfo.civilStatus || '');
        setVal('citizenship', data.personalInfo.citizenship || '');
        setVal('otherCitizenship', data.personalInfo.otherCitizenship || '');
        setVal('occupation', data.personalInfo.occupation || '');
        setVal('otherOccupation', data.personalInfo.otherOccupation || '');
        if (Array.isArray(data.personalInfo.specialCategories)) {
            data.personalInfo.specialCategories.forEach(category => {
                const checkbox = document.querySelector(`input[name="indicateIf[]"][value="${category}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    }

    // Account Info
    if (data.accountInfo) {
        setVal('email', data.accountInfo.email || '');
        setVal('password', data.accountInfo.password || '');
        emailVerified = !!data.accountInfo.emailVerified;
        if (emailVerified && exists('otp-success')) {
            getEl('otp-success').style.display = 'block';
            if (exists('email')) getEl('email').disabled = true;
            if (exists('send-otp')) getEl('send-otp').disabled = true;
        }
    }

    // Household Info
    if (data.householdInfo) {
        setVal('propertyUrl', data.householdInfo.propertyUrl || '');
        setVal('householdMembers', data.householdInfo.householdMembers || '');
        setVal('ownerName', data.householdInfo.ownerName || '');
        setVal('precinctNo', data.householdInfo.precinctNo || '');
        setVal('yearsInBarangay', data.householdInfo.yearsInBarangay || '');
    }

    // Documents previews
    if (data.documents) {
        if (data.documents.residencePreviewSrc && exists('residenceImagePreview')) {
            getEl('residenceImagePreview').src = data.documents.residencePreviewSrc;
            if (exists('residenceFilePreviewContainer')) getEl('residenceFilePreviewContainer').style.display = 'block';
            if (exists('residencePreview')) getEl('residencePreview').style.display = 'none';
        }
        if (data.documents.idFrontPreviewSrc && exists('idFrontImagePreview')) {
            getEl('idFrontImagePreview').src = data.documents.idFrontPreviewSrc;
            if (exists('idFrontPreviewContainer')) getEl('idFrontPreviewContainer').style.display = 'block';
        }
        if (data.documents.idBackPreviewSrc && exists('idBackImagePreview')) {
            getEl('idBackImagePreview').src = data.documents.idBackPreviewSrc;
            if (exists('idBackPreviewContainer')) getEl('idBackPreviewContainer').style.display = 'block';
        }

        setVal('idType', data.documents.idType || '');
        setVal('userReason', data.documents.userReason || '');
    }

    // Face Captures
    if (data.faceCaptures) {
        if (data.faceCaptures.flags) capturedFaces = { ...capturedFaces, ...data.faceCaptures.flags };
        if (data.faceCaptures.frontPreview && exists('frontFacePreview')) {
            getEl('frontFacePreview').src = data.faceCaptures.frontPreview;
            getEl('frontFacePreview').style.display = 'block';
        }
        if (data.faceCaptures.leftPreview && exists('leftFacePreview')) {
            getEl('leftFacePreview').src = data.faceCaptures.leftPreview;
            getEl('leftFacePreview').style.display = 'block';
        }
        if (data.faceCaptures.rightPreview && exists('rightFacePreview')) {
            getEl('rightFacePreview').src = data.faceCaptures.rightPreview;
            getEl('rightFacePreview').style.display = 'block';
        }
        if (data.faceCaptures.closedPreview && exists('closedFacePreview')) {
            getEl('closedFacePreview').src = data.faceCaptures.closedPreview;
            getEl('closedFacePreview').style.display = 'block';
        }

        updateFaceCaptureUI();
    }
}

// Update face capture UI based on saved data
function updateFaceCaptureUI() {
    Object.keys(capturedFaces).forEach(faceType => {
        if (capturedFaces[faceType]) {
            const stepElement = getEl(`step-${faceType}`);
            const preview = getEl(`${faceType}FacePreview`);
            const retakeBtn = document.querySelector(`.retake-face-btn[data-face="${faceType}"]`);

            if (stepElement) {
                stepElement.classList.remove('active');
                stepElement.classList.add('completed');
            }
            if (preview) preview.style.display = 'block';
            if (retakeBtn) retakeBtn.style.display = 'block';
        }
    });

    updateFaceProgressFromSaved();
    checkAllFacesCaptured();
}

function updateFaceProgressFromSaved() {
    const angles = ['front', 'left', 'right', 'closed'];
    let lastCompletedIndex = -1;

    angles.forEach((angle, index) => {
        if (capturedFaces[angle]) lastCompletedIndex = index;
    });

    for (let i = 0; i < angles.length; i++) {
        const progressCircle = getEl(`progress-${angles[i]}`);
        const connector = getEl(`connector-${i+1}`);

        if (progressCircle && i <= lastCompletedIndex) progressCircle.classList.add('completed');
        if (connector && i <= lastCompletedIndex - 1) connector.classList.add('completed');

        if (i === lastCompletedIndex + 1) {
            if (progressCircle) progressCircle.classList.add('active');
            updateInstructions(angles[i]);
        }
    }
}

// Phone number formatting
function setupPhoneFormatting() {
    const phoneInput = getEl('phone');
    if (!phoneInput) return;

    if (!phoneInput.value || !phoneInput.value.trim()) phoneInput.value = '+63 ';

    phoneInput.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');
        if (value.startsWith('63')) value = value.substring(2);
        let formatted = '+63 ';
        if (value.length > 0) formatted += value.substring(0, 3);
        if (value.length > 3) formatted += '-' + value.substring(3, 6);
        if (value.length > 6) formatted += '-' + value.substring(6, 10);
        this.value = formatted;
    });

    phoneInput.addEventListener('keydown', function(e) {
        const cursorPos = this.selectionStart;
        if (e.key.length === 1 || ['Backspace','Delete','ArrowLeft','ArrowRight','Tab'].includes(e.key)) {
            // allow
        }
        if ((e.key === 'Backspace' || e.key === 'Delete') && cursorPos <= 4) {
            e.preventDefault();
            return;
        }
    });

    phoneInput.addEventListener('blur', function() {
        if (!this.value.startsWith('+63')) {
            let numbers = this.value.replace(/\D/g, '');
            if (numbers.startsWith('63')) numbers = numbers.substring(2);
            this.value = '+63 ' + numbers.substring(0, 10);
        }
    });

    phoneInput.addEventListener('focus', function() {
        const len = this.value.length;
        this.setSelectionRange(len, len);
    });
}

// OTP Functions
async function sendOTP() {
    const email = getVal('email').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showError('email-error', 'Please enter a valid email address first');
        return;
    }

    const btn = getEl('send-otp');
    const resendBtn = getEl('resend-otp');
    if (btn) { btn.disabled = true; btn.classList.add('loading'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...'; }
    if (resendBtn) resendBtn.disabled = true;

    try {
        currentOTP = Math.floor(100000 + Math.random() * 900000).toString();
        otpExpiry = Date.now() + 5 * 60 * 1000;

        const templateParams = {
            to_email: email,
            user_email: email,
            email: email,
            otp_code: currentOTP,
            from_name: 'Barangay 118 Online System',
            message: `Your OTP verification code is: ${currentOTP}. This code will expire in 5 minutes.`,
            user_name: getVal('firstName') || 'User'
        };

        if (typeof emailjs === 'undefined' || !emailjs.send) {
            throw new Error('EmailJS is not available. OTP cannot be sent in this environment.');
        }

        const response = await emailjs.send('service_y0sh9nd', 'template_vdbhhq5', templateParams);
        console.log('Email sent successfully:', response);
        showToast('OTP has been sent to your email! Please check your inbox.', 'success');

        if (exists('otp-input-group')) getEl('otp-input-group').style.display = 'block';
        if (exists('otp-resend')) getEl('otp-resend').style.display = 'block';
        if (exists('otp-countdown')) getEl('otp-countdown').style.display = 'block';

        startCountdown(120);
        if (exists('otp-error')) getEl('otp-error').style.display = 'none';
    } catch (error) {
        console.error('Failed to send OTP:', error);
        let errorMessage = 'Failed to send OTP. ';
        if (error.text) errorMessage += 'Error: ' + error.text;
        else errorMessage += 'Please check your email address and try again.';
        showToast(errorMessage, 'error');

        if (btn) { btn.disabled = false; btn.classList.remove('loading'); btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP'; }
        if (resendBtn) resendBtn.disabled = false;
    }
}

function startCountdown(seconds) {
    const countdownElement = getEl('countdown-timer');
    const sendBtn = getEl('send-otp');
    const resendBtn = getEl('resend-otp');

    if (countdownInterval) clearInterval(countdownInterval);
    if (sendBtn) sendBtn.disabled = true;
    if (resendBtn) resendBtn.disabled = true;
    if (sendBtn) sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    countdownInterval = setInterval(() => {
        seconds--;
        if (countdownElement) countdownElement.textContent = seconds;
        if (seconds <= 0) {
            clearInterval(countdownInterval);
            if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP'; }
            if (resendBtn) resendBtn.disabled = false;
            if (getEl('otp-countdown')) getEl('otp-countdown').style.display = 'none';
        }
    }, 1000);
}

function verifyOTP() {
    const enteredOTP = getVal('otpInput').trim();
    const otpError = getEl('otp-error');
    const otpSuccess = getEl('otp-success');

    if (!currentOTP) {
        if (otpError) { otpError.textContent = 'Please request an OTP first.'; otpError.style.display = 'block'; }
        return;
    }

    if (Date.now() > otpExpiry) {
        if (otpError) { otpError.textContent = 'OTP has expired. Please request a new one.'; otpError.style.display = 'block'; }
        return;
    }

    if (enteredOTP === currentOTP) {
        if (otpError) otpError.style.display = 'none';
        if (otpSuccess) otpSuccess.style.display = 'block';
        emailVerified = true;

        if (getEl('email')) getEl('email').disabled = true;
        if (getEl('send-otp')) getEl('send-otp').disabled = true;
        if (getEl('verify-otp-btn')) getEl('verify-otp-btn').disabled = true;
        if (getEl('resend-otp')) getEl('resend-otp').disabled = true;
        if (getEl('otpInput')) getEl('otpInput').disabled = true;

        if (countdownInterval) {
            clearInterval(countdownInterval);
            if (getEl('otp-countdown')) getEl('otp-countdown').style.display = 'none';
        }

        showToast('Email verified successfully!', 'success');
        saveFormData();
    } else {
        if (otpError) { otpError.textContent = 'Incorrect OTP. Please try again.'; otpError.style.display = 'block'; }
        if (otpSuccess) otpSuccess.style.display = 'none';
    }
}

function resetOTPVerification() {
    emailVerified = false;
    currentOTP = null;
    if (getEl('otp-success')) getEl('otp-success').style.display = 'none';
    if (getEl('email')) getEl('email').disabled = false;
    if (getEl('send-otp')) getEl('send-otp').disabled = false;
    if (getEl('verify-otp-btn')) getEl('verify-otp-btn').disabled = false;
    if (getEl('resend-otp')) getEl('resend-otp').disabled = false;
    if (getEl('otpInput')) getEl('otpInput').disabled = false;
    if (getEl('otp-input-group')) getEl('otp-input-group').style.display = 'none';
    if (getEl('otp-resend')) getEl('otp-resend').style.display = 'none';
    if (getEl('otp-countdown')) getEl('otp-countdown').style.display = 'none';
    if (countdownInterval) clearInterval(countdownInterval);
}

// File upload and deletion functions
function setupFileUploads() {
    // Already set up in event listeners
}

function handleFileUpload(event, previewId, placeholderId, containerId, fileType) {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        event.target.value = '';
        return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        showToast('Please upload only JPG, PNG, or PDF files', 'error');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = getEl(previewId);
        const placeholder = getEl(placeholderId);
        const container = getEl(containerId);

        if (file.type.includes('image') && preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
            if (container) container.style.display = 'block';
        } else if (file.type === 'application/pdf' && placeholder) {
            placeholder.innerHTML = `<i class="fas fa-file-pdf" style="font-size: 2rem; margin-bottom: 10px; color: #e74c3c;"></i><div>${file.name}</div>`;
            if (preview) preview.style.display = 'none';
            if (container) container.style.display = 'block';
        }

        showToast(`${fileType.charAt(0).toUpperCase() + fileType.slice(1)} file uploaded successfully!`, 'success');
        saveFormData();
    };
    reader.readAsDataURL(file);
}

function handleIdFileUpload(side) {
    const fileInput = getEl(`id${side.charAt(0).toUpperCase() + side.slice(1)}`);
    if (!fileInput || !fileInput.files) return;
    const file = fileInput.files[0];

    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        fileInput.value = '';
        return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        showToast('Please upload only JPG, PNG, or PDF files', 'error');
        fileInput.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = getEl(`id${side.charAt(0).toUpperCase() + side.slice(1)}ImagePreview`);
        const container = getEl(`id${side.charAt(0).toUpperCase() + side.slice(1)}PreviewContainer`);

        if (file.type.includes('image') && preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            if (container) container.style.display = 'block';
        } else if (file.type === 'application/pdf' && container) {
            container.innerHTML = `<i class="fas fa-file-pdf" style="font-size: 2rem; margin-bottom: 10px; color: #e74c3c;"></i><div>${file.name}</div>`;
        }

        showToast(`ID ${side} uploaded successfully!`, 'success');
        saveFormData();
    };
    reader.readAsDataURL(file);
}

function deleteFile(fileType) {
    let fileInput, preview, placeholder, container;

    switch(fileType) {
        case 'residence':
            fileInput = getEl('residenceFile');
            preview = getEl('residenceImagePreview');
            placeholder = getEl('residencePreview');
            container = getEl('residenceFilePreviewContainer');
            break;
        case 'idFront':
            fileInput = getEl('idFront');
            preview = getEl('idFrontImagePreview');
            container = getEl('idFrontPreviewContainer');
            break;
        case 'idBack':
            fileInput = getEl('idBack');
            preview = getEl('idBackImagePreview');
            container = getEl('idBackPreviewContainer');
            break;
    }

    if (fileInput) fileInput.value = '';
    if (preview) preview.style.display = 'none';
    if (container) {
        container.style.display = 'none';
        if (fileType === 'idFront' || fileType === 'idBack') {
            container.innerHTML = `
                <img id="${fileType}ImagePreview" class="image-preview" alt="Uploaded ${fileType} preview">
                <button type="button" class="delete-file-btn" id="delete${fileType.charAt(0).toUpperCase() + fileType.slice(1)}" aria-label="Remove ${fileType} file">×</button>
            `;
            const delBtn = getEl(`delete${fileType.charAt(0).toUpperCase() + fileType.slice(1)}`);
            if (delBtn) delBtn.addEventListener('click', () => deleteFile(fileType));
        }
    }
    if (placeholder) {
        placeholder.style.display = 'flex';
        if (fileType === 'residence') {
            placeholder.innerHTML = '<i class="fas fa-file-invoice" style="font-size: 2rem; margin-bottom: 10px;"></i><div>Proof of residence preview will appear here</div>';
        }
    }

    showToast('File removed. You can upload a new one.', 'success');
    saveFormData();
}

// Enhanced Face Capture Functions
function captureFace(angle) {
    const video = getEl('webcamVideo');
    const canvas = getEl('webcamCanvas');
    const preview = getEl(`${angle}FacePreview`);
    const retakeBtn = document.querySelector(`.retake-face-btn[data-face="${angle}"]`);

    if (!video || !video.srcObject) {
        showToast('Please start the camera first.', 'error');
        return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 100;
    previewCanvas.height = 100;
    const previewContext = previewCanvas.getContext('2d');

    previewContext.beginPath();
    previewContext.arc(50, 50, 50, 0, Math.PI * 2, true);
    previewContext.closePath();
    previewContext.clip();

    previewContext.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 100, 100);

    if (preview) {
        preview.src = previewCanvas.toDataURL('image/png');
        preview.style.display = 'block';
    }
    if (retakeBtn) retakeBtn.style.display = 'block';

    capturedFaces[angle] = true;

    const stepElement = getEl(`step-${angle}`);
    if (stepElement) {
        stepElement.classList.remove('active');
        stepElement.classList.add('completed');
    }

    updateFaceProgress(angle);

    let nextAngle = '';
    if (angle === 'front') nextAngle = 'left';
    else if (angle === 'left') nextAngle = 'right';
    else if (angle === 'right') nextAngle = 'closed';

    if (nextAngle) {
        const nextStepElement = getEl(`step-${nextAngle}`);
        if (nextStepElement) nextStepElement.classList.add('active');
        if (getEl(`capture-${nextAngle}`)) getEl(`capture-${nextAngle}`).disabled = false;
        updateInstructions(nextAngle);
    }

    checkAllFacesCaptured();
    showToast(`${angle.charAt(0).toUpperCase() + angle.slice(1)} face captured successfully!`, 'success');
    saveFormData();
}

function checkAllFacesCaptured() {
    const allCaptured = Object.values(capturedFaces).every(val => val === true);
    if (allCaptured) {
        if (exists('completeFaceScan')) getEl('completeFaceScan').disabled = false;
        if (exists('face-status')) {
            getEl('face-status').innerHTML = '<i class="fas fa-check-circle"></i> All face captures completed!';
            getEl('face-status').classList.add('completed');
        }
        stopWebcam();
    }
}

function updateFaceProgress(currentAngle) {
    const angles = ['front', 'left', 'right', 'closed'];
    const currentIndex = angles.indexOf(currentAngle);
    for (let i = 0; i <= currentIndex; i++) {
        const progressCircle = getEl(`progress-${angles[i]}`);
        if (progressCircle) {
            progressCircle.classList.add('completed');
            if (i === currentIndex) {
                progressCircle.classList.add('active');
            } else {
                progressCircle.classList.remove('active');
            }
        }
    }
    for (let i = 0; i < currentIndex; i++) {
        const connector = getEl(`connector-${i+1}`);
        if (connector) connector.classList.add('completed');
    }
}

function updateInstructions(angle) {
    const instructions = getEl('face-instructions');
    const status = getEl('face-status');
    if (!instructions || !status) return;

    switch(angle) {
        case 'front':
            instructions.textContent = 'Please look directly at the camera for the front face capture';
            status.innerHTML = '<i class="fas fa-camera"></i> Ready for front face capture';
            break;
        case 'left':
            instructions.textContent = 'Please turn your head slightly to the left';
            status.innerHTML = '<i class="fas fa-arrow-left"></i> Ready for left side capture';
            break;
        case 'right':
            instructions.textContent = 'Please turn your head slightly to the right';
            status.innerHTML = '<i class="fas fa-arrow-right"></i> Ready for right side capture';
            break;
        case 'closed':
            instructions.textContent = 'Please close your eyes gently for the closed eyes capture';
            status.innerHTML = '<i class="fas fa-eye-slash"></i> Ready for closed eyes capture';
            break;
    }
}

// Enhanced retake
function retakeFaceCapture(faceType) {
    if (!faceType) return;
    capturedFaces[faceType] = false;

    const preview = getEl(`${faceType}FacePreview`);
    const retakeBtn = document.querySelector(`.retake-face-btn[data-face="${faceType}"]`);
    if (preview) preview.style.display = 'none';
    if (retakeBtn) retakeBtn.style.display = 'none';

    const stepElement = getEl(`step-${faceType}`);
    if (stepElement) {
        stepElement.classList.add('active');
        stepElement.classList.remove('completed');
    }

    if (getEl(`capture-${faceType}`)) getEl(`capture-${faceType}`).disabled = false;
    if (exists('completeFaceScan')) getEl('completeFaceScan').disabled = true;

    updateProgressAfterRetake(faceType);
    updateInstructions(faceType);

    if (!webcamStream) startWebcam();

    showToast(`You can now retake the ${faceType} face photo.`, 'info');
    saveFormData();
}

function updateProgressAfterRetake(retakenAngle) {
    const angles = ['front', 'left', 'right', 'closed'];
    const retakenIndex = angles.indexOf(retakenAngle);

    for (let i = retakenIndex; i < angles.length; i++) {
        const progressCircle = getEl(`progress-${angles[i]}`);
        if (progressCircle) {
            progressCircle.classList.remove('completed');
            if (i === retakenIndex) progressCircle.classList.add('active');
            else progressCircle.classList.remove('active');
        }
        if (i > 0) {
            const connector = getEl(`connector-${i}`);
            if (connector) connector.classList.remove('completed');
        }
    }
}

// Step navigation and helpers
function showStep(step) {
    document.querySelectorAll('.form-section').forEach(section => {
        if (section) section.classList.remove('active');
    });

    const target = getEl(`step${step}`);
    if (target) target.classList.add('active');
}

function returnToHome() {
    // Save final registration data before leaving
    quickSaveRegistration();
    
    localStorage.removeItem('barangayRegistrationData');
    localStorage.removeItem('barangayRegistrationCurrentStep');
    localStorage.removeItem('barangayRegistrationControlNumber');

    showToast('Registration completed! Returning to home page...', 'success');
    setTimeout(() => {
        window.location.href = 'PanelUserView.html';
    }, 1200);
}

function printConfirmation() {
    window.print();
}

// Utility toast / error
function showError(elementId, message) {
    const el = getEl(elementId);
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
    } else {
        showToast(message, 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <div style="display:inline-block; margin-left:8px">${message}</div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.transform = 'translateX(0)'; toast.style.opacity = '1'; }, 10);
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 4500);
}

// Get selected categories
function getSelectedCategories() {
    const selected = [];
    document.querySelectorAll('input[name="indicateIf[]"]:checked').forEach(cb => {
        if (cb && cb.value) selected.push(cb.value);
    });
    return selected;
}

// Setup other input fields for citizenship and occupation
function setupOtherInputs() {
    const citizenshipSelect = getEl('citizenship');
    const occupationSelect = getEl('occupation');

    if (citizenshipSelect) citizenshipSelect.addEventListener('change', function() { toggleOtherInput(this, 'otherCitizenship'); });
    if (occupationSelect) occupationSelect.addEventListener('change', function() { toggleOtherInput(this, 'otherOccupation'); });
}

function toggleOtherInput(selectElement, otherInputId) {
    const otherInput = getEl(otherInputId);
    if (!selectElement || !otherInput) return;
    if (selectElement.value === "Other") {
        otherInput.style.display = "block";
        otherInput.required = true;
    } else {
        otherInput.style.display = "none";
        otherInput.required = false;
        otherInput.value = "";
    }
}

function toggleOtherExt(select) {
    const otherInput = getEl('otherExt');
    if (!select || !otherInput) return;
    if (select.value === 'Other') {
        otherInput.style.display = 'block';
        otherInput.required = true;
    } else {
        otherInput.style.display = 'none';
        otherInput.required = false;
        otherInput.value = '';
    }
}

// Update progress bar and step counter with accurate percentages
function updateProgress() {
    const bar = getEl('progress-bar');
    if (bar) {
        // Accurate progress: 20% per step (Step 1: 20%, Step 2: 40%, etc.)
        const progress = ((currentStep - 1) / 4) * 100;
        bar.style.width = `${progress}%`;
        bar.setAttribute('aria-valuenow', progress);
    }
    
    if (getEl('current-step-number')) getEl('current-step-number').textContent = currentStep;

    const stepDescriptions = {
        1: '- Head of Family Information',
        2: '- Household Information',
        3: '- Document Upload',
        4: '- Face Verification',
        5: '- Completion'
    };
    if (getEl('step-description')) getEl('step-description').textContent = stepDescriptions[currentStep] || '';

    // Update step indicators with proper checkmarks
    for (let i = 1; i <= 5; i++) {
        const stepIndicator = getEl(`step${i}-indicator`);
        if (!stepIndicator) continue;
        
        const stepNumber = stepIndicator.querySelector('.step-number');
        if (!stepNumber) continue;
        
        if (i < currentStep) {
            stepIndicator.classList.remove('active');
            stepIndicator.classList.add('completed');
            stepNumber.innerHTML = ''; // Clear number
            stepNumber.innerHTML = '✓'; // Add checkmark
        } else if (i === currentStep) {
            stepIndicator.classList.add('active');
            stepIndicator.classList.remove('completed');
            stepNumber.innerHTML = i; // Show number
        } else {
            stepIndicator.classList.remove('active', 'completed');
            stepNumber.innerHTML = i; // Show number
        }
    }
}

// Handle step buttons
function handleNextStep(event) {
    const button = event.target;
    const step = getCurrentStepFromButton(button);
    if (validateStep(step)) {
        if (step === 1) showTermsModal();
        else nextStep(step);
    }
}

function handlePrevStep(event) {
    const button = event.target;
    const step = getCurrentStepFromButton(button);
    prevStep(step);
}

function getCurrentStepFromButton(button) {
    if (!button) return currentStep;
    const formSection = button.closest('.form-section');
    if (!formSection) return currentStep;
    const sectionId = formSection.id;
    const parsed = parseInt(sectionId.replace('step', ''), 10);
    return isNaN(parsed) ? currentStep : parsed;
}

function nextStep(step) {
    const currentEl = getEl(`step${step}`);
    if (currentEl) currentEl.classList.remove('active');
    currentStep = step + 1;
    const nextEl = getEl(`step${currentStep}`);
    if (nextEl) nextEl.classList.add('active');
    updateProgress();
    saveFormData();
    if (step === 3 && webcamStream) stopWebcam();
    
    // Auto-save registration when reaching step 5
    if (currentStep === 5) {
        quickSaveRegistration();
    }
}

function prevStep(step) {
    const currentEl = getEl(`step${step}`);
    if (currentEl) currentEl.classList.remove('active');
    currentStep = Math.max(1, step - 1);
    const prevEl = getEl(`step${currentStep}`);
    if (prevEl) prevEl.classList.add('active');
    updateProgress();
    saveFormData();
    if (step === 4 && webcamStream) stopWebcam();
}

// Validation per step
function validateStep(step) {
    let isValid = true;
    if (step === 1) isValid = validateStep1();
    else if (step === 2) isValid = validateStep2();
    else if (step === 3) isValid = validateStep3();
    else if (step === 4) isValid = validateStep4();

    if (!isValid) {
        showToast('Please complete all required fields before proceeding.', 'error');
        const firstError = document.querySelector('.error');
        if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return isValid;
}

// Validate Step 1
function validateStep1() {
    let isValid = true;
    const requiredFields = ['lastName', 'firstName', 'address', 'placeOfBirth', 'dateOfBirth', 'age', 'phone', 'gender', 'civilStatus','citizenship', 'occupation', 'email', 'password'];

    requiredFields.forEach(field => {
        const element = getEl(field);
        const errorElement = getEl(`${field}-error`);
        if (!element || !element.value.trim()) {
            if (element) element.classList.add('error');
            if (errorElement) errorElement.style.display = 'block';
            isValid = false;
        } else {
            if (element) element.classList.remove('error');
            if (errorElement) errorElement.style.display = 'none';
        }
    });

    // Validate Middle Name
    const middleName = getEl('middleName');
    const middleNameValue = middleName ? middleName.value.trim() : '';
    if (middleNameValue && middleNameValue.toLowerCase() !== 'n/a' && middleNameValue.length < 2) {
        if (middleName) middleName.classList.add('error');
        if (getEl('middleName-error')) getEl('middleName-error').style.display = 'block';
        isValid = false;
    }

    // phone
    const phone = getEl('phone');
    const phoneError = getEl('phone-error');
    const phoneRegex = /^\+63\s?9\d{2}[- ]?\d{3}[- ]?\d{4}$/;
    if (phone && phone.value && !phoneRegex.test(phone.value)) {
        phone.classList.add('error');
        if (phoneError) {
            phoneError.textContent = 'Please enter a valid phone number starting with +63 followed by 10 digits';
            phoneError.style.display = 'block';
        }
        isValid = false;
    }

    // email
    const email = getEl('email');
    const emailError = getEl('email-error');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && email.value && !emailRegex.test(email.value)) {
        email.classList.add('error');
        if (emailError) { emailError.textContent = 'Please enter a valid email address'; emailError.style.display = 'block'; }
        isValid = false;
    } else if (email && email.value && !emailVerified) {
        if (emailError) { emailError.textContent = 'Please verify your email with OTP'; emailError.style.display = 'block'; }
        isValid = false;
    }

    // password rules
    const password = getVal('password');
    const passwordError = getEl('password-error');
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[@_><,?]/.test(password);
    const isLongEnough = password.length >= 10;

    if (password && (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar || !isLongEnough)) {
        if (getEl('password')) getEl('password').classList.add('error');
        if (passwordError) passwordError.style.display = 'block';
        isValid = false;
    }

    // confirm
    const confirmPassword = getVal('confirmPassword');
    const confirmPasswordError = getEl('confirmPassword-error');
    const passwordMatchMessage = getEl('password-match-message');

    if (password !== confirmPassword) {
        if (getEl('confirmPassword')) getEl('confirmPassword').classList.add('error');
        if (confirmPasswordError) confirmPasswordError.style.display = 'block';
        if (passwordMatchMessage) passwordMatchMessage.classList.remove('valid');
        isValid = false;
    } else {
        if (getEl('confirmPassword')) getEl('confirmPassword').classList.remove('error');
        if (confirmPasswordError) confirmPasswordError.style.display = 'none';
        if (password && passwordMatchMessage) passwordMatchMessage.classList.add('valid');
    }

    return isValid;
}

// Step 2 validation
function validateStep2() {
    let isValid = true;
    const requiredFields = ['propertyUrl', 'householdMembers', 'ownerName', 'yearsInBarangay'];
    requiredFields.forEach(field => {
        const element = getEl(field);
        const errorElement = getEl(`${field}-error`);
        if (!element || !element.value.trim()) {
            if (element) element.classList.add('error');
            if (errorElement) errorElement.style.display = 'block';
            isValid = false;
        } else {
            if (element) element.classList.remove('error');
            if (errorElement) errorElement.style.display = 'none';
        }
    });
    return isValid;
}

// Step 3 validation
function validateStep3() {
    let isValid = true;
    const idFront = getEl('idFront');
    const idBack = getEl('idBack');
    const idType = getEl('idType');
    const userReason = getEl('userReason');

    if (!(idFront && idFront.files && idFront.files.length)) {
        if (getEl('idFront-error')) getEl('idFront-error').style.display = 'block';
        isValid = false;
    } else if (getEl('idFront-error')) getEl('idFront-error').style.display = 'none';

    if (!(idBack && idBack.files && idBack.files.length)) {
        if (getEl('idBack-error')) getEl('idBack-error').style.display = 'block';
        isValid = false;
    } else if (getEl('idBack-error')) getEl('idBack-error').style.display = 'none';

    if (!(idType && idType.value)) {
        if (getEl('idType-error')) getEl('idType-error').style.display = 'block';
        isValid = false;
    } else if (getEl('idType-error')) getEl('idType-error').style.display = 'none';

    if (!(userReason && userReason.value.trim())) {
        if (getEl('userReason-error')) getEl('userReason-error').style.display = 'block';
        isValid = false;
    } else if (getEl('userReason-error')) getEl('userReason-error').style.display = 'none';

    return isValid;
}

// Step 4 validation
function validateStep4() {
    const allCaptured = Object.values(capturedFaces).every(val => val === true);
    if (!allCaptured) {
        showToast('Please complete all face capture steps before proceeding.', 'error');
        return false;
    }

    // Generate control number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const controlNumber = `BRGY118-${year}${month}${day}-${randomNum}`;
    if (exists('controlNumber')) getEl('controlNumber').textContent = controlNumber;

    formData.controlNumber = controlNumber;
    try { localStorage.setItem('barangayRegistrationControlNumber', controlNumber); } catch (e) { console.warn(e); }

    return true;
}

// Terms & modal
function showTermsModal() {
    if (validateStep1()) {
        if (exists('termsModal')) {
            getEl('termsModal').style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    } else {
        showToast('Please fill in all required fields before proceeding to the Terms and Conditions.', 'error');
    }
}

function closeTermsModal() {
    if (exists('termsModal')) getEl('termsModal').style.display = 'none';
    document.body.style.overflow = '';
}

function confirmTerms() {
    const modalAccept = getEl('modal-accept');
    const modalError = getEl('modal-terms-error');
    const termsModal = getEl('termsModal');
    if (!modalAccept) return;
    if (!modalAccept.checked) {
        if (modalError) modalError.style.display = 'block';
        return;
    }
    if (modalError) modalError.style.display = 'none';
    if (termsModal) termsModal.style.display = 'none';
    document.body.style.overflow = '';
    nextStep(1);
}

// Password validation & toggles
function validatePassword() {
    const password = getVal('password');
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[@_><,?]/.test(password);
    const isLongEnough = password.length >= 10;

    if (getEl('req-length')) getEl('req-length').className = isLongEnough ? 'valid' : 'invalid';
    if (getEl('req-uppercase')) getEl('req-uppercase').className = hasUpperCase ? 'valid' : 'invalid';
    if (getEl('req-lowercase')) getEl('req-lowercase').className = hasLowerCase ? 'valid' : 'invalid';
    if (getEl('req-number')) getEl('req-number').className = hasNumbers ? 'valid' : 'invalid';
    if (getEl('req-special')) getEl('req-special').className = hasSpecialChar ? 'valid' : 'invalid';

    validatePasswordConfirmation();
    saveFormData();
}

function validatePasswordConfirmation() {
    const password = getVal('password');
    const confirmPassword = getVal('confirmPassword');
    const confirmPasswordError = getEl('confirmPassword-error');
    const passwordMatchMessage = getEl('password-match-message');

    if (password && confirmPassword) {
        if (password !== confirmPassword) {
            if (getEl('confirmPassword')) getEl('confirmPassword').classList.add('error');
            if (confirmPasswordError) confirmPasswordError.style.display = 'block';
            if (passwordMatchMessage) passwordMatchMessage.classList.remove('valid');
        } else {
            if (getEl('confirmPassword')) getEl('confirmPassword').classList.remove('error');
            if (confirmPasswordError) confirmPasswordError.style.display = 'none';
            if (passwordMatchMessage) passwordMatchMessage.classList.add('valid');
        }
    }
}

function togglePasswordVisibility() {
    const passwordInput = getEl('password');
    const toggleButton = getEl('togglePassword');
    if (!passwordInput || !toggleButton) return;
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    toggleButton.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i> Show' : '<i class="fas fa-eye-slash"></i> Hide';
}

function toggleConfirmPasswordVisibility() {
    const confirmPasswordInput = getEl('confirmPassword');
    const toggleButton = getEl('toggleConfirmPassword');
    if (!confirmPasswordInput || !toggleButton) return;
    const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    confirmPasswordInput.setAttribute('type', type);
    toggleButton.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i> Show' : '<i class="fas fa-eye-slash"></i> Hide';
}

// Calculate age
function calculateAge() {
    const dobVal = getVal('dateOfBirth');
    if (!dobVal) return;
    const dob = new Date(dobVal);
    if (isNaN(dob.getTime())) return;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
    setVal('age', age);
    saveFormData();
}

// Webcam
async function startWebcam() {
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } });
        const video = getEl('webcamVideo');
        if (video) video.srcObject = webcamStream;

        if (getEl('startWebcam')) getEl('startWebcam').disabled = true;
        if (getEl('captureImage')) getEl('captureImage').disabled = false;
        if (getEl('capture-front')) getEl('capture-front').disabled = false;

        if (getEl('face-status')) getEl('face-status').innerHTML = '<i class="fas fa-camera"></i> Camera active - Ready for face capture';
        showToast('Camera started successfully!', 'success');
    } catch (err) {
        console.error("Error accessing webcam:", err);
        showToast("Unable to access webcam. Please make sure you've given permission and try again.", 'error');
    }
}

function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
        const video = getEl('webcamVideo');
        if (video) video.srcObject = null;
        if (getEl('startWebcam')) getEl('startWebcam').disabled = false;
        if (getEl('captureImage')) getEl('captureImage').disabled = true;
        if (getEl('face-status')) getEl('face-status').innerHTML = '<i class="fas fa-times-circle"></i> Camera stopped';
    }
}

function captureImage() {
    const video = getEl('webcamVideo');
    const canvas = getEl('webcamCanvas');
    const capturedImage = getEl('capturedImage');
    if (!video || !canvas || !capturedImage) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    capturedImage.src = canvas.toDataURL('image/png');
    capturedImage.style.display = 'block';
    video.style.display = 'none';

    if (getEl('captureImage')) getEl('captureImage').style.display = 'none';
    if (getEl('retakeImage')) getEl('retakeImage').style.display = 'inline-block';
}

function retakeImage() {
    const video = getEl('webcamVideo');
    const capturedImage = getEl('capturedImage');
    if (!video || !capturedImage) return;

    capturedImage.style.display = 'none';
    video.style.display = 'block';

    if (getEl('captureImage')) getEl('captureImage').style.display = 'inline-block';
    if (getEl('retakeImage')) getEl('retakeImage').style.display = 'none';
}

// Quick save registration to localStorage for admin access
function quickSaveRegistration() {
    const data = collectFormData();
    const controlNumber = document.getElementById('controlNumber')?.textContent || 'BRGY118-' + Date.now();
    
    const registration = {
        controlNumber: controlNumber,
        personalInfo: data.personalInfo,
        accountInfo: data.accountInfo,
        householdInfo: data.householdInfo,
        documents: data.documents,
        faceCaptures: data.faceCaptures,
        status: 'pending',
        registrationDate: new Date().toISOString(),
        submittedAt: new Date().toLocaleString()
    };

    // Get existing registrations or initialize empty array
    const existing = JSON.parse(localStorage.getItem('barangayRegistrations') || '[]');
    
    // Check if this registration already exists (by control number)
    const existingIndex = existing.findIndex(reg => reg.controlNumber === controlNumber);
    
    if (existingIndex !== -1) {
        // Update existing registration
        existing[existingIndex] = registration;
    } else {
        // Add new registration
        existing.push(registration);
    }
    
    // Save back to localStorage
    localStorage.setItem('barangayRegistrations', JSON.stringify(existing));
    
    console.log('Registration saved to admin database:', registration);
    showToast('Registration data saved successfully!', 'success');
}

// Auto-save when reaching success page
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on step 5 (success page)
    if (document.getElementById('step5')?.classList.contains('active')) {
        setTimeout(quickSaveRegistration, 500);
    }
});

// Export functions to window for global access
try {
    window.toggleOtherExt = toggleOtherExt;
    window.toggleOtherInput = toggleOtherInput;
} catch (e) {
    console.warn('Unable to attach functions to window:', e);
}