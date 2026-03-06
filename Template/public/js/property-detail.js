// Property Detail Page JavaScript
class PropertyDetailPage {
  constructor() {
    this.currentPhotoIndex = 0;
    this.photos = [];
    this.propertyId = null;
    this.propertySlug = null;
    this.propertyCountry = '';
    this.propertyCity = '';
    this.isSubmittingLead = false;

    const data = document.getElementById('propertyData');
    if (data) {
      this.propertyId = data.getAttribute('data-id');
      this.propertySlug = data.getAttribute('data-slug');
      this.propertyCountry = data.getAttribute('data-country') || '';
      this.propertyCity = data.getAttribute('data-city') || '';
      const photosEnc = data.getAttribute('data-photos');
      if (photosEnc) {
        try {
          const parsed = JSON.parse(decodeURIComponent(photosEnc));
          this.photos = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
        } catch (e) {
          this.photos = [];
        }
      }
    }
    if (!this.photos.length) this.photos = [this.getMainPhotoSrc()];

    this.init();
  }

  getMainPhotoSrc() {
    const img = document.getElementById('mainPhotoImg');
    return img ? img.src || '/img/property-placeholder.jpg' : '/img/property-placeholder.jpg';
  }

  init() {
    this.loadPhotos();
    this.loadSimilarProperties();
    this.initLocationMap();
    this.bindEvents();
  }

  initLocationMap() {
    const mapEl = document.getElementById('propertyDetailMap');
    if (!mapEl || typeof L === 'undefined') return;
    const lat = parseFloat(mapEl.getAttribute('data-lat'));
    const lng = parseFloat(mapEl.getAttribute('data-lng'));
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    try {
      const map = L.map('propertyDetailMap', { center: [lat, lng], zoom: 15 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      L.marker([lat, lng]).addTo(map);
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 100);
    } catch (e) {
      console.error('Property detail map init failed:', e);
    }
  }

  loadPhotos() {
    if (this.photos.length > 0) {
      this.updateMainPhoto(0);
    }
  }

  updateMainPhoto(index) {
    const mainPhotoImg = document.getElementById('mainPhotoImg');
    const numEl = document.getElementById('currentPhotoNum');
    const totalEl = document.getElementById('totalPhotos');

    if (mainPhotoImg && this.photos[index]) {
      mainPhotoImg.src = this.photos[index];
    }
    if (numEl) numEl.textContent = String(index + 1);
    if (totalEl) totalEl.textContent = String(this.photos.length);
    this.currentPhotoIndex = index;

    // Sync thumbnail focus: set is-active on current, scroll into view
    const thumbs = document.querySelectorAll('.gallery-thumb');
    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle('is-active', i === index);
    });
    const activeThumb = document.querySelector('.gallery-thumb.is-active');
    if (activeThumb) {
      activeThumb.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }

  loadSimilarProperties() {
    const similarContainer = document.getElementById('similarProperties');
    if (!similarContainer) return;
    if (!this.propertyCountry || !this.propertyCity || !this.propertyId) {
      this.showSimilarPropertiesError();
      return;
    }

    fetch(`/api/properties/similar?country=${encodeURIComponent(this.propertyCountry)}&city=${encodeURIComponent(this.propertyCity)}&exclude=${this.propertyId}&limit=6`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.properties && data.properties.length > 0) {
          this.renderSimilarProperties(data.properties);
        } else {
          this.showSimilarPropertiesError();
        }
      })
      .catch((error) => {
        console.error('Error loading similar properties:', error);
        this.showSimilarPropertiesError();
      });
  }

  renderSimilarProperties(properties) {
    const similarContainer = document.getElementById('similarProperties');
    if (!similarContainer) return;

    const sizeIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
    const bedIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>';
    const bathIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M4 10h16"/></svg>';

    similarContainer.innerHTML = properties.map((p) => {
      const slug = p.slug || p.id;
      const url = `/properties/${slug}`;
      const location = [p.neighborhood, p.city].filter(Boolean).join(', ') || p.city || '—';
      const size = p.size != null ? `${Math.round(p.size)} m2` : '—';
      const beds = p.bedrooms != null ? String(p.bedrooms) : '—';
      const baths = p.bathrooms != null ? String(p.bathrooms) : '—';
      const img = (p.photos && p.photos[0]) ? p.photos[0] : '/img/property-placeholder.jpg';

      return `<a href="${url}" class="similar-property-card">
        <div class="similar-property-card-image"><img src="${img}" alt="${p.title || location}" loading="lazy" decoding="async"></div>
        <div class="similar-property-card-content">
          <h3 class="similar-property-card-location">${location}</h3>
          <div class="similar-property-card-specs">
            <span>${sizeIcon} ${size}</span>
            <span>${bedIcon} ${beds}</span>
            <span>${bathIcon} ${baths}</span>
          </div>
          <span class="similar-property-card-learn">Learn More</span>
        </div>
      </a>`;
    }).join('');

    this.initSimilarCarousel();
  }

  initSimilarCarousel() {
    const list = document.getElementById('similarProperties');
    const prev = document.querySelector('.similar-carousel-prev');
    const next = document.querySelector('.similar-carousel-next');
    if (!list || !prev || !next) return;

    const cards = list.querySelectorAll('.similar-property-card');
    if (cards.length === 0) return;

    const CARD_WIDTH = 280;
    const GAP = 20;
    const scrollStep = CARD_WIDTH + GAP;

    list.scrollLeft = scrollStep;

    const updateCenteredCard = () => {
      const listRect = list.getBoundingClientRect();
      const centerX = listRect.left + listRect.width / 2;

      let closest = null;
      let minDist = Infinity;
      cards.forEach((card) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const dist = Math.abs(centerX - cardCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = card;
        }
      });

      cards.forEach((c) => c.classList.remove('carousel-center'));
      if (closest) closest.classList.add('carousel-center');
    };

    updateCenteredCard();
    list.addEventListener('scroll', updateCenteredCard);

    prev.onclick = () => {
      list.scrollBy({ left: -scrollStep, behavior: 'smooth' });
    };
    next.onclick = () => {
      list.scrollBy({ left: scrollStep, behavior: 'smooth' });
    };
  }

  showSimilarPropertiesError() {
    const similarContainer = document.getElementById('similarProperties');
    if (!similarContainer) return;
    similarContainer.innerHTML = '<div class="similar-properties-error"><p>No similar properties available at the moment.</p></div>';
  }

  bindEvents() {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
      contactForm.addEventListener('submit', this.handleContactFormSubmit.bind(this));
    }
    // Thumbnail clicks: go to that photo
    document.querySelectorAll('.gallery-thumb').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const index = parseInt(thumb.getAttribute('data-index'), 10);
        if (!Number.isNaN(index) && index >= 0 && index < this.photos.length) {
          showPhoto(index);
        }
      });
    });
  }

  handleContactFormSubmit(event) {
    event.preventDefault();
    if (this.isSubmittingLead) return;
    this.isSubmittingLead = true;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    const formData = new FormData(event.target);
    const formDataObj = Object.fromEntries(formData.entries());
    formDataObj.propertyId = this.propertyId;
    formDataObj.propertyTitle = document.querySelector('.property-title')?.textContent || '';

    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formDataObj)
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          this.showSuccessMessage('Thank you! Your inquiry was submitted. A team member will be in touch soon.');
          event.target.reset();
        } else {
          this.showErrorMessage(data.message || 'Failed to send message. Please try again.');
        }
      })
      .catch(() => {
        this.showErrorMessage('An error occurred. Please try again later.');
      })
      .finally(() => {
        this.isSubmittingLead = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
  }

  showSuccessMessage(message) {
    this.showMessage(message, 'success');
  }

  showErrorMessage(message) {
    this.showMessage(message, 'error');
  }

  showMessage(message, type) {
    const el = document.createElement('div');
    el.className = `message message-${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 100);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }
}

function showPhoto(index) {
  const page = window.propertyDetailPage;
  if (!page || index < 0 || index >= page.photos.length) return;
  page.updateMainPhoto(index);
}

function nextPhoto() {
  const page = window.propertyDetailPage;
  if (!page) return;
  const next = (page.currentPhotoIndex + 1) % page.photos.length;
  showPhoto(next);
}

function previousPhoto() {
  const page = window.propertyDetailPage;
  if (!page) return;
  const prev = (page.currentPhotoIndex - 1 + page.photos.length) % page.photos.length;
  showPhoto(prev);
}

function shareByEmail() {
  const title = document.querySelector('.property-title')?.textContent || 'Property';
  const url = window.location.href;
  const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent('Check out this property: ' + url)}`;
  window.location.href = mailto;
}

function shareOnSocial(platform) {
  const title = document.querySelector('.property-title')?.textContent || '';
  const url = window.location.href;
  let shareUrl = '';

  switch (platform) {
    case 'facebook':
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      break;
    case 'twitter':
      shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
      break;
    case 'linkedin':
      shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
      break;
    case 'whatsapp':
      shareUrl = `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`;
      break;
    case 'instagram':
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          if (window.propertyDetailPage) window.propertyDetailPage.showSuccessMessage('Link copied! Share it on Instagram.');
        });
      }
      return;
    default:
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  }
  if (shareUrl) window.open(shareUrl, '_blank', 'width=600,height=400');
}

document.addEventListener('DOMContentLoaded', function () {
  window.propertyDetailPage = new PropertyDetailPage();
});
