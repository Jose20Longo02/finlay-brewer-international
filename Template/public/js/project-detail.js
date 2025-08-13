// Project Detail Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Initialize the page
  initializeProjectDetail();
});

function initializeProjectDetail() {
  // Initialize gallery functionality
  initializeGallery();
  
  // Initialize contact form
  initializeContactForm();
  
  // Initialize smooth scrolling
  initializeSmoothScrolling();
  
  // Initialize related project interactions
  initializeRelatedProjects();
}

// Gallery Functionality
function initializeGallery() {
  const mainImage = document.getElementById('main-image');
  const thumbnails = document.querySelectorAll('.thumbnail');
  
  if (!mainImage || thumbnails.length === 0) return;
  
  // Handle thumbnail clicks
  thumbnails.forEach(thumbnail => {
    thumbnail.addEventListener('click', function() {
      const photoSrc = this.dataset.photo;
      const photoIndex = this.dataset.index;
      
      // Update main image
      updateMainImage(photoSrc, photoIndex);
      
      // Update active thumbnail
      updateActiveThumbnail(photoIndex);
    });
  });
  
  // Add keyboard navigation
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowLeft') {
      navigateGallery('prev');
    } else if (e.key === 'ArrowRight') {
      navigateGallery('next');
    }
  });
  
  // Add touch/swipe support for mobile
  initializeTouchSupport();
}

function updateMainImage(photoSrc, photoIndex) {
  const mainImage = document.getElementById('main-image');
  if (!mainImage) return;
  
  // Add fade out effect
  mainImage.style.opacity = '0';
  
  setTimeout(() => {
    // Update image source
    mainImage.src = `/uploads/projects/${getProjectId()}/${photoSrc}`;
    
    // Add fade in effect
    mainImage.style.opacity = '1';
  }, 150);
}

function updateActiveThumbnail(photoIndex) {
  const thumbnails = document.querySelectorAll('.thumbnail');
  
  thumbnails.forEach(thumbnail => {
    thumbnail.classList.remove('active');
  });
  
  const activeThumbnail = document.querySelector(`[data-index="${photoIndex}"]`);
  if (activeThumbnail) {
    activeThumbnail.classList.add('active');
  }
}

function navigateGallery(direction) {
  const thumbnails = document.querySelectorAll('.thumbnail');
  const activeThumbnail = document.querySelector('.thumbnail.active');
  
  if (!activeThumbnail || thumbnails.length <= 1) return;
  
  let currentIndex = parseInt(activeThumbnail.dataset.index);
  let newIndex;
  
  if (direction === 'prev') {
    newIndex = currentIndex > 0 ? currentIndex - 1 : thumbnails.length - 1;
  } else {
    newIndex = currentIndex < thumbnails.length - 1 ? currentIndex + 1 : 0;
  }
  
  const newThumbnail = document.querySelector(`[data-index="${newIndex}"]`);
  if (newThumbnail) {
    newThumbnail.click();
  }
}

function initializeTouchSupport() {
  const galleryMain = document.querySelector('.gallery-main');
  if (!galleryMain) return;
  
  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;
  
  galleryMain.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  });
  
  galleryMain.addEventListener('touchend', function(e) {
    endX = e.changedTouches[0].clientX;
    endY = e.changedTouches[0].clientY;
    
    handleSwipe();
  });
  
  function handleSwipe() {
    const diffX = startX - endX;
    const diffY = startY - endY;
    
    // Check if it's a horizontal swipe
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Swipe left - next image
        navigateGallery('next');
      } else {
        // Swipe right - previous image
        navigateGallery('prev');
      }
    }
  }
}

// Contact Form Functionality
function initializeContactForm() {
  const contactForm = document.getElementById('project-contact-form');
  if (!contactForm) return;
  
  contactForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Validate form
    if (!validateContactForm()) {
      return;
    }
    
    // Submit form
    submitContactForm();
  });
  
  // Add real-time validation
  addFormValidation();
}

function validateContactForm() {
  const name = document.getElementById('contact-name').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const message = document.getElementById('contact-message').value.trim();
  
  // Clear previous error states
  clearFormErrors();
  
  let isValid = true;
  
  if (!name) {
    showFieldError('contact-name', 'Name is required');
    isValid = false;
  }
  
  if (!email) {
    showFieldError('contact-email', 'Email is required');
    isValid = false;
  } else if (!isValidEmail(email)) {
    showFieldError('contact-email', 'Please enter a valid email address');
    isValid = false;
  }
  
  if (!message) {
    showFieldError('contact-message', 'Message is required');
    isValid = false;
  }
  
  return isValid;
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  
  // Add error class
  field.classList.add('error');
  
  // Create or update error message
  let errorElement = field.parentNode.querySelector('.error-message');
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    field.parentNode.appendChild(errorElement);
  }
  
  errorElement.textContent = message;
  errorElement.style.display = 'block';
}

function clearFormErrors() {
  const errorFields = document.querySelectorAll('.form-input.error, .form-textarea.error');
  const errorMessages = document.querySelectorAll('.error-message');
  
  errorFields.forEach(field => {
    field.classList.remove('error');
  });
  
  errorMessages.forEach(message => {
    message.style.display = 'none';
  });
}

function addFormValidation() {
  const inputs = document.querySelectorAll('#project-contact-form input, #project-contact-form textarea');
  
  inputs.forEach(input => {
    input.addEventListener('blur', function() {
      validateField(this);
    });
    
    input.addEventListener('input', function() {
      // Clear error when user starts typing
      if (this.classList.contains('error')) {
        this.classList.remove('error');
        const errorMessage = this.parentNode.querySelector('.error-message');
        if (errorMessage) {
          errorMessage.style.display = 'none';
        }
      }
    });
  });
}

function validateField(field) {
  const value = field.value.trim();
  
  if (field.hasAttribute('required') && !value) {
    showFieldError(field.id, `${field.previousElementSibling.textContent} is required`);
    return false;
  }
  
  if (field.type === 'email' && value && !isValidEmail(value)) {
    showFieldError(field.id, 'Please enter a valid email address');
    return false;
  }
  
  return true;
}

function submitContactForm() {
  const form = document.getElementById('project-contact-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  
  // Show loading state
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
  submitBtn.disabled = true;
  
  // Collect form data
  const formData = new FormData(form);
  formData.append('project_id', getProjectId());
  formData.append('project_title', getProjectTitle());
  
  // Submit to server
  fetch('/api/contact/project', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showSuccessMessage('Thank you! Your message has been sent successfully.');
      form.reset();
    } else {
      showErrorMessage(data.message || 'Error sending message. Please try again.');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    showErrorMessage('Error sending message. Please try again.');
  })
  .finally(() => {
    // Reset button state
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  });
}

function showSuccessMessage(message) {
  showMessage(message, 'success');
}

function showErrorMessage(message) {
  showMessage(message, 'error');
}

function showMessage(message, type) {
  // Remove existing messages
  const existingMessages = document.querySelectorAll('.message-banner');
  existingMessages.forEach(msg => msg.remove());
  
  // Create message banner
  const messageBanner = document.createElement('div');
  messageBanner.className = `message-banner message-${type}`;
  messageBanner.innerHTML = `
    <div class="message-content">
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
      <span>${message}</span>
    </div>
    <button class="message-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  // Insert at top of form
  const contactCard = document.querySelector('.contact-card');
  contactCard.insertBefore(messageBanner, contactCard.firstChild);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (messageBanner.parentNode) {
      messageBanner.remove();
    }
  }, 5000);
}

// Smooth Scrolling
function initializeSmoothScrolling() {
  const links = document.querySelectorAll('a[href^="#"]');
  
  links.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// Related Projects
function initializeRelatedProjects() {
  const relatedProjectItems = document.querySelectorAll('.related-project-item');
  
  relatedProjectItems.forEach(item => {
    item.addEventListener('mouseenter', function() {
      this.style.transform = 'translateX(4px)';
    });
    
    item.addEventListener('mouseleave', function() {
      this.style.transform = 'translateX(0)';
    });
  });
}

// Utility Functions
function getProjectId() {
  // Extract project ID from URL or data attribute
  const projectIdElement = document.querySelector('[data-project-id]');
  if (projectIdElement) {
    return projectIdElement.dataset.projectId;
  }
  
  // Fallback: try to extract from URL
  const urlParts = window.location.pathname.split('/');
  return urlParts[urlParts.length - 1];
}

function getProjectTitle() {
  const titleElement = document.querySelector('.project-title');
  return titleElement ? titleElement.textContent : 'Project';
}

// Add CSS for error states and messages
function addErrorStyles() {
  if (document.getElementById('error-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'error-styles';
  style.textContent = `
    .form-input.error,
    .form-textarea.error {
      border-color: var(--red-500) !important;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
    }
    
    .error-message {
      color: var(--red-600);
      font-size: var(--font-size-sm);
      margin-top: var(--spacing-1);
      display: none;
    }
    
    .message-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-4);
      border-radius: var(--radius-lg);
      margin-bottom: var(--spacing-6);
      font-size: var(--font-size-sm);
    }
    
    .message-success {
      background: var(--green-50);
      color: var(--green-700);
      border: 1px solid var(--green-200);
    }
    
    .message-error {
      background: var(--red-50);
      color: var(--red-700);
      border: 1px solid var(--red-200);
    }
    
    .message-content {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    }
    
    .message-close {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      font-size: var(--font-size-lg);
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color var(--transition-fast);
    }
    
    .message-close:hover {
      background: rgba(0, 0, 0, 0.1);
    }
    
    .form-input:focus.error,
    .form-textarea:focus.error {
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
    }
  `;
  
  document.head.appendChild(style);
}

// Initialize error styles
addErrorStyles();

// Export functions for global access
window.ProjectDetail = {
  navigateGallery,
  submitContactForm,
  showSuccessMessage,
  showErrorMessage
};
