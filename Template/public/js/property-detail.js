// Property Detail Page JavaScript
class PropertyDetailPage {
  constructor() {
    this.currentPhotoIndex = 0;
    this.photos = [];
    this.map = null;
    this.propertyId = this.getPropertyIdFromUrl();
    this.isSubmittingLead = false;
    
    this.init();
  }

  init() {
    this.loadPhotos();
    this.initMap();
    this.loadSimilarProperties();
    this.bindEvents();
  }

  getPropertyIdFromUrl() {
    // Prefer embedded data-id from DOM
    const dataEl = document.getElementById('propertyData');
    const idAttr = dataEl ? dataEl.getAttribute('data-id') : null;
    if (idAttr) return idAttr;
    // Fallback to last URL segment
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
  }

  loadPhotos() {
    // Get photos from the page (they're already rendered in the EJS template)
    const photoElements = document.querySelectorAll('.thumbnail img');
    this.photos = Array.from(photoElements).map(img => img.src);
    
    if (this.photos.length > 0) {
      this.updateMainPhoto(0);
    }
  }

  updateMainPhoto(index) {
    const mainPhotoImg = document.getElementById('mainPhotoImg');
    const thumbnails = document.querySelectorAll('.thumbnail');
    if (!mainPhotoImg || thumbnails.length === 0) return;

    const targetThumb = thumbnails[index]?.querySelector('img');
    if (targetThumb) {
      mainPhotoImg.src = targetThumb.src;
    }
    thumbnails.forEach((thumb, i) => {
      thumb.classList.toggle('active', i === index);
    });
    this.currentPhotoIndex = index;
  }

  initMap() {
    const mapContainer = document.getElementById('propertyMap');
    if (!mapContainer) return;

    // Prefer data attributes for coordinates
    const data = document.getElementById('propertyData');
    const latAttr = data?.getAttribute('data-latitude');
    const lngAttr = data?.getAttribute('data-longitude');
    const mapLink = data?.getAttribute('data-map-link');
    let lat = latAttr ? parseFloat(latAttr) : NaN;
    let lng = lngAttr ? parseFloat(lngAttr) : NaN;

    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const initLeaflet = (clat, clng) => {
      try {
        this.map = L.map('propertyMap').setView([clat, clng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        const propertyMarker = L.marker([clat, clng]).addTo(this.map);
        const propertyTitle = document.querySelector('.property-title').textContent;
        const propertyLocation = document.querySelector('.property-location').textContent.trim();
        propertyMarker.bindPopup(`
          <div style="text-align: center;">
            <strong>${propertyTitle}</strong><br>
            <small>${propertyLocation}</small>
          </div>
        `);
        const loadingElement = mapContainer.querySelector('.map-loading');
        if (loadingElement) loadingElement.remove();
      } catch (error) {
        console.error('Error initializing map:', error);
        this.showMapError('Failed to load map');
      }
    };

    // If explicit coordinates present (legacy), use them; otherwise require a map link
    if (hasCoords) {
      initLeaflet(lat, lng);
      return;
    }
    if (mapLink && mapLink.trim()) {
      const parsed = this.extractCoordsFromLink(mapLink);
      if (parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) {
        initLeaflet(parsed.lat, parsed.lng);
        return;
      }
      this.showMapError('Invalid map link');
      return;
    }
    // No map link: hide the entire section per product requirement
    const section = document.querySelector('.property-location-map');
    if (section) section.style.display = 'none';
    return;
  }

  extractCoordsFromLink(input) {
    if (!input || typeof input !== 'string') return null;
    const text = input.trim();
    let m = text.match(/@\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
    m = text.match(/[?&](?:q|ll)=\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
    m = text.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
    return null;
  }

  showMapError(message) {
    const mapContainer = document.getElementById('propertyMap');
    if (!mapContainer) return;

    const loadingElement = mapContainer.querySelector('.map-loading');
    if (loadingElement) {
      loadingElement.innerHTML = `
        <div style="text-align: center; color: #dc3545;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <p>${message}</p>
        </div>
      `;
    }
  }

  loadSimilarProperties() {
    const similarContainer = document.getElementById('similarProperties');
    if (!similarContainer) return;

    // Fetch similar properties from the same city/country
    const propertyCountry = document.querySelector('.location-item:first-child strong').nextSibling.textContent.trim();
    const propertyCity = document.querySelector('.location-item:nth-child(2) strong').nextSibling.textContent.trim();
    
    fetch(`/api/properties/similar?country=${encodeURIComponent(propertyCountry)}&city=${encodeURIComponent(propertyCity)}&exclude=${this.propertyId}&limit=3`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.properties.length > 0) {
          this.renderSimilarProperties(data.properties);
        } else {
          this.showSimilarPropertiesError();
        }
      })
      .catch(error => {
        console.error('Error loading similar properties:', error);
        this.showSimilarPropertiesError();
      });
  }

  renderSimilarProperties(properties) {
    const similarContainer = document.getElementById('similarProperties');
    if (!similarContainer) return;

    similarContainer.innerHTML = properties.map(property => `
      <div class="similar-property" onclick="window.location.href='/properties/${property.id}'">
        <div class="similar-property-image">
          <img src="${property.photos && property.photos.length > 0 ? property.photos[0] : '/img/property-placeholder.jpg'}" 
               alt="${property.title}" loading="lazy" decoding="async">
        </div>
        <div class="similar-property-content">
          <h4>${property.title}</h4>
          <p class="similar-property-location">${property.neighborhood}, ${property.city}</p>
          <p class="similar-property-price">€${Number(property.price || 0).toLocaleString('en-US')}</p>
        </div>
      </div>
    `).join('');
  }

  showSimilarPropertiesError() {
    const similarContainer = document.getElementById('similarProperties');
    if (!similarContainer) return;

    similarContainer.innerHTML = `
      <div class="similar-properties-error">
        <p>No similar properties available at the moment.</p>
      </div>
    `;
  }

  bindEvents() {
    // Contact form submission
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
      contactForm.addEventListener('submit', this.handleContactFormSubmit.bind(this));
    }

    // No favorite system
  }

  handleContactFormSubmit(event) {
    event.preventDefault();
    if (this.isSubmittingLead) return;
    this.isSubmittingLead = true;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending...';
    }
    
    const formData = new FormData(event.target);
    const formDataObj = Object.fromEntries(formData.entries());
    
    // Add property information
    formDataObj.propertyId = this.propertyId;
    formDataObj.propertyTitle = document.querySelector('.property-title').textContent;
    
    // Send contact form
    fetch('/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formDataObj)
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        this.showSuccessMessage('Thank you! Your inquiry was submitted. A team member will be in touch soon.');
        // Close the contact modal
        if (typeof closeContactModal === 'function') closeContactModal();
        event.target.reset();
      } else {
        this.showErrorMessage(data.message || 'Failed to send message. Please try again.');
      }
    })
    .catch(error => {
      console.error('Error sending message:', error);
      this.showErrorMessage('An error occurred. Please try again later.');
    })
    .finally(() => {
      this.isSubmittingLead = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    });
  }

  // No favorite system

  showSuccessMessage(message) {
    this.showMessage(message, 'success');
  }

  showErrorMessage(message) {
    this.showMessage(message, 'error');
  }

  showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // Show message
    setTimeout(() => messageDiv.classList.add('show'), 100);
    
    // Hide message after 3 seconds
    setTimeout(() => {
      messageDiv.classList.remove('show');
      setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
  }
}

// Photo Gallery Functions
function showPhoto(index) {
  const mainPhotoImg = document.getElementById('mainPhotoImg');
  const thumbnails = document.querySelectorAll('.thumbnail');
  
  if (mainPhotoImg && thumbnails.length > 0) {
    // Update main photo
    mainPhotoImg.src = thumbnails[index].querySelector('img').src;
    
    // Update active thumbnail
    thumbnails.forEach((thumb, i) => {
      thumb.classList.toggle('active', i === index);
    });
    
    // Update current photo index
    if (window.propertyDetailPage) {
      window.propertyDetailPage.currentPhotoIndex = index;
    }
  }
}

function nextPhoto() {
  const thumbnails = document.querySelectorAll('.thumbnail');
  if (thumbnails.length === 0) return;
  
  let nextIndex = 0;
  if (window.propertyDetailPage) {
    nextIndex = (window.propertyDetailPage.currentPhotoIndex + 1) % thumbnails.length;
  }
  
  showPhoto(nextIndex);
}

function previousPhoto() {
  const thumbnails = document.querySelectorAll('.thumbnail');
  if (thumbnails.length === 0) return;
  
  let prevIndex = 0;
  if (window.propertyDetailPage) {
    prevIndex = (window.propertyDetailPage.currentPhotoIndex - 1 + thumbnails.length) % thumbnails.length;
  }
  
  showPhoto(prevIndex);
}

// Modal Functions
function contactAgent() {
  const modal = document.getElementById('contactModal');
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeContactModal() {
  const modal = document.getElementById('contactModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

function shareProperty() {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

// Social Sharing Functions
function shareOnSocial(platform) {
  const propertyTitle = document.querySelector('.property-title').textContent;
  const propertyUrl = window.location.href;
  
  let shareUrl = '';
  
  switch (platform) {
    case 'facebook':
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(propertyUrl)}`;
      break;
    case 'twitter':
      shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(propertyTitle)}&url=${encodeURIComponent(propertyUrl)}`;
      break;
    case 'linkedin':
      shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(propertyUrl)}`;
      break;
  }
  
  if (shareUrl) {
    window.open(shareUrl, '_blank', 'width=600,height=400');
  }
  
  closeShareModal();
}

function copyLink() {
  const propertyUrl = window.location.href;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(propertyUrl).then(() => {
      // Show success message
      if (window.propertyDetailPage) {
        window.propertyDetailPage.showSuccessMessage('Link copied to clipboard!');
      }
    }).catch(() => {
      // Fallback for older browsers
      fallbackCopyTextToClipboard(propertyUrl);
    });
  } else {
    // Fallback for older browsers
    fallbackCopyTextToClipboard(propertyUrl);
  }
  
  closeShareModal();
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
    if (window.propertyDetailPage) {
      window.propertyDetailPage.showSuccessMessage('Link copied to clipboard!');
    }
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
    if (window.propertyDetailPage) {
      window.propertyDetailPage.showErrorMessage('Failed to copy link');
    }
  }
  
  document.body.removeChild(textArea);
}

function callAgent() {
  // This would typically open a phone dialer or show a phone number
  // For now, we'll show a message
  if (window.propertyDetailPage) {
    window.propertyDetailPage.showSuccessMessage('Phone functionality coming soon!');
  }
}

// Close modals when clicking outside
document.addEventListener('click', function(event) {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    if (event.target === modal) {
      modal.classList.remove('show');
      document.body.style.overflow = '';
    }
  });
});

// Close modals with Escape key
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      if (modal.classList.contains('show')) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
      }
    });
  }
});

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  window.propertyDetailPage = new PropertyDetailPage();
});

// Add CSS for messages
const messageStyles = document.createElement('style');
messageStyles.textContent = `
  .message {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 1001;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    max-width: 300px;
  }
  
  .message.show {
    transform: translateX(0);
  }
  
  .message-success { background-color: #16a34a; }
  .message-error { background-color: #dc2626; }
  .message-info { background-color: #2563eb; }
  .spinner { display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.4); border-top-color: rgba(255,255,255,1); border-radius:50%; animation: spin 0.8s linear infinite; margin-right:8px; vertical-align:-2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  
  .similar-property {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .similar-property:hover {
    background: #e9ecef;
    transform: translateY(-2px);
  }
  
  .similar-property-image {
    width: 80px;
    height: 60px;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
  }
  
  .similar-property-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .similar-property-content {
    flex: 1;
  }
  
  .similar-property-content h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    color: #2c3e50;
  }
  
  .similar-property-location {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: #6c757d;
  }
  
  .similar-property-price {
    margin: 0;
    font-weight: 600;
    color: #28a745;
  }
  
  .similar-properties-error {
    text-align: center;
    color: #6c757d;
    padding: 2rem;
  }
  
  /* removed favorited styles (no favorites system) */
`;

document.head.appendChild(messageStyles);
