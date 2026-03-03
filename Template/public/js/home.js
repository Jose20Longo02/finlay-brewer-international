// Home Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
  initHeroDestinationTabs();
  initFavoritePropertiesGallery();
  initArticlesCarousel();

  window.locations = {};
  
  // Check if locations data is available in the global scope
  if (typeof window.locationsData !== 'undefined') {
    window.locations = window.locationsData;
    console.log('✅ Locations data loaded from window:', window.locations);
    console.log('📊 Countries available:', Object.keys(window.locations));
  } else {
    console.warn('❌ Locations data not found in window.locationsData');
    // Fallback: try to get from data attribute
    const locationsData = document.getElementById('locations-data');
    if (locationsData) {
      try {
        window.locations = JSON.parse(locationsData.getAttribute('data-locations') || '{}');
        console.log('✅ Locations data loaded from data attribute:', window.locations);
      } catch (e) {
        console.warn('❌ Could not parse locations data:', e);
        window.locations = {};
      }
    } else {
      console.warn('❌ Locations data element not found');
    }
  }

  if (!window.locations || typeof window.locations !== 'object') {
    window.locations = {};
  }

  // City dropdown only if we have locations (for pages that use #country, #city, #neighborhood)
  if (Object.keys(window.locations).length > 0) {
    initializeCityDropdown();
  }

  initializeSearchForm();
  initContactForm();
  initOfficeCardParallax();
});

function initOfficeCardParallax() {
  const card = document.getElementById('contactOfficeCard');
  if (!card) return;

  const maxTilt = 8;

  card.addEventListener('mousemove', function(e) {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const rotateY = x * maxTilt;
    const rotateX = -y * maxTilt;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });

  card.addEventListener('mouseleave', function() {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
  });
}

function initContactForm() {
  const form = document.getElementById('homeContactForm');
  if (!form) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = form.querySelector('.contact-submit');
    if (btn) btn.disabled = true;
    const fd = new FormData(form);
    const data = Object.fromEntries([...fd].filter(([, v]) => v !== ''));
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(r => r.json())
      .then(function(res) {
        if (res.success) {
          form.reset();
          alert(res.message || 'Thank you! We will be in touch soon.');
        } else {
          alert(res.message || 'Something went wrong. Please try again.');
        }
      })
      .catch(function() {
        alert('Something went wrong. Please try again.');
      })
      .finally(function() {
        if (btn) btn.disabled = false;
      });
  });
}

function initHeroDestinationTabs() {
  const tabsContainer = document.querySelector('.hero-tabs');
  const tabs = document.querySelectorAll('.hero-tab');
  const indicator = document.querySelector('.hero-tab-indicator');
  const heroBackgrounds = document.querySelectorAll('.hero-bg');
  if (!tabsContainer || !tabs.length || !indicator) return;
  // Ensure first background is visible on load (in case CSS hasn't applied yet)
  if (heroBackgrounds.length) {
    heroBackgrounds[0].classList.add('active');
  }

  function setActiveDestination(tab) {
    const destId = tab.getAttribute('data-destination');
    if (!destId) return;

    // Switch hero background (smooth crossfade)
    heroBackgrounds.forEach(function(bg) {
      bg.classList.toggle('active', bg.getAttribute('data-destination') === destId);
    });

    // Update tab active state and indicator position
    tabs.forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    var left = tab.offsetLeft;
    var width = tab.offsetWidth;
    indicator.style.left = left + 'px';
    indicator.style.width = width + 'px';
    indicator.style.opacity = '1';
    // On mobile (scrollable tabs), scroll active tab into view
    if (tabsContainer && tabsContainer.scrollWidth > tabsContainer.clientWidth) {
      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  function positionIndicator(tab) {
    if (!tab) tab = document.querySelector('.hero-tab.active') || tabs[0];
    if (!tab) return;
    indicator.style.left = tab.offsetLeft + 'px';
    indicator.style.width = tab.offsetWidth + 'px';
    indicator.style.opacity = '1';
  }

  setActiveDestination(tabs[0]);

  tabsContainer.addEventListener('click', function(e) {
    var tab = e.target.closest('.hero-tab');
    if (tab) {
      e.preventDefault();
      e.stopPropagation();
      setActiveDestination(tab);
    }
  });

  window.addEventListener('resize', function() {
    positionIndicator(document.querySelector('.hero-tab.active') || tabs[0]);
  });

  // Auto-advance destinations every 3 seconds (respect reduced motion)
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && tabs.length > 1) {
    setInterval(function() {
      var active = document.querySelector('.hero-tab.active');
      var idx = Array.prototype.indexOf.call(tabs, active);
      var nextIdx = (idx + 1) % tabs.length;
      setActiveDestination(tabs[nextIdx]);
    }, 3000);
  }
}

function initFavoritePropertiesGallery() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const galleryTrack = document.getElementById('favoritePropertiesTrack');
  if (!galleryTrack || prefersReducedMotion) return;

  const frames = galleryTrack.querySelectorAll('.gallery-frame--property');
  if (!frames.length) return;

  if (!galleryTrack.dataset.loopReady) {
    const originalFrames = Array.from(frames);
    originalFrames.forEach(function(frame) {
      const clone = frame.cloneNode(true);
      galleryTrack.appendChild(clone);
    });
    galleryTrack.dataset.loopReady = 'true';
  }

  let galleryOffset = 0;
  const gallerySpeed = 1.2;
  let resetThreshold = galleryTrack.scrollWidth / 2;
  let isPaused = false;
  let rafId = null;

  function recalcThreshold() {
    resetThreshold = galleryTrack.scrollWidth / 2;
  }

  function galleryLoop() {
    if (!isPaused) {
      galleryOffset -= gallerySpeed;
      galleryTrack.style.transform = 'translateX(' + galleryOffset + 'px)';
      if (Math.abs(galleryOffset) >= resetThreshold) {
        galleryOffset = 0;
      }
    }
    rafId = requestAnimationFrame(galleryLoop);
  }

  const strip = galleryTrack.closest('.gallery-strip');
  if (strip) {
    strip.addEventListener('mouseenter', function() {
      isPaused = true;
    });
    strip.addEventListener('mouseleave', function() {
      isPaused = false;
    });
  }

  galleryLoop();
  window.addEventListener('resize', recalcThreshold);
}

function initArticlesCarousel() {
  const carousel = document.getElementById('articlesCarousel');
  const prevBtn = document.querySelector('.articles-nav-prev');
  const nextBtn = document.querySelector('.articles-nav-next');
  if (!carousel || !prevBtn || !nextBtn) return;

  const cards = Array.from(carousel.querySelectorAll('.article-card'));
  const n = cards.length;
  if (n === 0) return;

  let activeIndex = 0;

  var relToPos = { '-2': 2, '-1': 1, '0': 0, '1': 3, '2': 4 };

  function updatePositions() {
    cards.forEach(function(card, i) {
      card.classList.remove('pos-0', 'pos-1', 'pos-2', 'pos-3', 'pos-4');
      var rel = i - activeIndex;
      if (rel > 2) rel -= n;
      if (rel < -2) rel += n;
      var pos = relToPos[String(rel)];
      if (pos !== undefined) card.classList.add('pos-' + pos);
    });
  }

  updatePositions();

  prevBtn.addEventListener('click', function() {
    activeIndex = (activeIndex - 1 + n) % n;
    updatePositions();
  });

  nextBtn.addEventListener('click', function() {
    activeIndex = (activeIndex + 1) % n;
    updatePositions();
  });
}

// Initialize city dropdown functionality
function initializeCityDropdown() {
  console.log('🔍 Starting dropdown initialization...');
  
  const countrySelect = document.getElementById('country');
  const citySelect = document.getElementById('city');
  const neighborhoodSelect = document.getElementById('neighborhood');
  
  console.log('🔍 Found dropdown elements:', { 
    countrySelect: countrySelect ? `✅ ${countrySelect.id}` : '❌ Not found',
    citySelect: citySelect ? `✅ ${citySelect.id}` : '❌ Not found',
    neighborhoodSelect: neighborhoodSelect ? `✅ ${neighborhoodSelect.id}` : '❌ Not found'
  });
  
  if (!countrySelect || !citySelect || !neighborhoodSelect) {
    console.error('❌ One or more dropdown elements not found');
    return;
  }
  
  // Verify locations data structure
  console.log('📊 Locations data structure:', window.locations);
  console.log('🌍 Available countries:', Object.keys(window.locations));
  
  // Set initial state - city and neighborhood should be disabled initially
  citySelect.disabled = true;
  neighborhoodSelect.disabled = true;
  console.log('🔒 Initial state: City and neighborhood dropdowns disabled');
  
  // Keep default as "Any country"; do not auto-select the first country
  
  // Initialize city dropdown when country changes
  countrySelect.addEventListener('change', function() {
    const selectedCountry = this.value;
    console.log('🌍 Country selected:', selectedCountry);
    
    // Reset city and neighborhood dropdowns
    citySelect.innerHTML = '<option value="">Any City</option>';
    neighborhoodSelect.innerHTML = '<option value="">Any Neighborhood</option>';
    console.log('🔄 Reset city and neighborhood dropdowns');
    
    if (selectedCountry && window.locations[selectedCountry]) {
      console.log('✅ Found cities for country:', selectedCountry);
      const cities = Object.keys(window.locations[selectedCountry]);
      console.log('🏙️ Available cities:', cities);
      
      // Populate cities
      cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
        console.log(`➕ Added city option: ${city}`);
      });
      citySelect.disabled = false;
      neighborhoodSelect.disabled = true; // Keep neighborhood disabled until city is selected
      console.log(`✅ Populated ${cities.length} cities, city dropdown enabled`);
      
      // Add a default city selection to trigger the neighborhood dropdown
      if (cities.length > 0) {
        const firstCity = cities[0];
        console.log('🏙️ Setting default city:', firstCity);
        citySelect.value = firstCity;
        
        // Trigger the change event to populate neighborhoods
        const event = new Event('change');
        citySelect.dispatchEvent(event);
      }
    } else {
      console.log('❌ No cities found for country:', selectedCountry);
      citySelect.disabled = true;
      neighborhoodSelect.disabled = true;
    }
  });
  
  // Initialize neighborhood dropdown when city changes
  citySelect.addEventListener('change', function() {
    const selectedCountry = countrySelect.value;
    const selectedCity = this.value;
    console.log('🏙️ City selected:', selectedCity, 'for country:', selectedCountry);
    
    // Reset neighborhood dropdown
    neighborhoodSelect.innerHTML = '<option value="">Any Neighborhood</option>';
    
    if (selectedCity && window.locations[selectedCountry] && window.locations[selectedCountry][selectedCity]) {
      console.log('✅ Found neighborhoods for city:', selectedCity);
      const neighborhoods = window.locations[selectedCountry][selectedCity];
      console.log('🏘️ Available neighborhoods:', neighborhoods);
      
      // Populate neighborhoods
      neighborhoods.forEach(neighborhood => {
        const option = document.createElement('option');
        option.value = neighborhood;
        option.textContent = neighborhood;
        neighborhoodSelect.appendChild(option);
        console.log(`➕ Added neighborhood option: ${neighborhood}`);
      });
      neighborhoodSelect.disabled = false;
      console.log(`✅ Populated ${neighborhoods.length} neighborhoods, neighborhood dropdown enabled`);
    } else {
      console.log('❌ No neighborhoods found for city:', selectedCity);
      neighborhoodSelect.disabled = true;
    }
  });
  
  console.log('✅ Dropdown initialization complete');
  console.log('🎯 Event listeners attached to country and city dropdowns');
}

// Add test function for debugging
function testDropdowns() {
  console.log('🧪 Testing dropdowns...');
  
  const countrySelect = document.getElementById('country');
  const citySelect = document.getElementById('city');
  const neighborhoodSelect = document.getElementById('neighborhood');
  
  console.log('🔍 Dropdown elements found:', {
    country: countrySelect ? countrySelect.value : 'Not found',
    city: citySelect ? citySelect.value : 'Not found',
    neighborhood: neighborhoodSelect ? neighborhoodSelect.value : 'Not found'
  });
  
  console.log('🔍 Dropdown states:', {
    countryDisabled: countrySelect ? countrySelect.disabled : 'N/A',
    cityDisabled: citySelect ? citySelect.disabled : 'N/A',
    neighborhoodDisabled: neighborhoodSelect ? neighborhoodSelect.disabled : 'N/A'
  });
  
  console.log('🔍 Dropdown options:', {
    countryOptions: countrySelect ? countrySelect.options.length : 'N/A',
    cityOptions: citySelect ? citySelect.options.length : 'N/A',
    neighborhoodOptions: neighborhoodSelect ? neighborhoodSelect.options.length : 'N/A'
  });
  
  console.log('🔍 Locations data available:', window.locations);
  
  // Try to manually populate city dropdown
  if (countrySelect && countrySelect.value && window.locations[countrySelect.value]) {
    console.log('🧪 Manually populating city dropdown...');
    const cities = Object.keys(window.locations[countrySelect.value]);
    citySelect.innerHTML = '<option value="">Any City</option>';
    cities.forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      option.textContent = city;
      citySelect.appendChild(option);
    });
    citySelect.disabled = false;
    console.log('✅ City dropdown populated with', cities.length, 'cities');
  }
}

// Load featured properties
async function loadFeaturedProperties() {
  const featuredContainer = document.getElementById('featuredProperties');
  if (!featuredContainer) return;
  
  try {
    // Show loading state
    featuredContainer.innerHTML = `
      <div class="property-card loading-placeholder">
        <div class="property-image"></div>
        <div class="property-content">
          <div class="property-title"></div>
          <div class="property-location"></div>
          <div class="property-price"></div>
        </div>
      </div>
      <div class="property-card loading-placeholder">
        <div class="property-image"></div>
        <div class="property-content">
          <div class="property-title"></div>
          <div class="property-location"></div>
          <div class="property-price"></div>
        </div>
      </div>
      <div class="property-card loading-placeholder">
        <div class="property-image"></div>
        <div class="property-content">
          <div class="property-title"></div>
          <div class="property-location"></div>
          <div class="property-price"></div>
        </div>
      </div>
    `;
    
    // Fetch featured properties from API (always 200 with JSON array)
    const response = await fetch('/api/featured');
    let properties = [];
    try {
      const data = await response.json();
      properties = Array.isArray(data) ? data : [];
    } catch (_) {
      properties = [];
    }
    
    // Render properties
    if (properties.length > 0) {
      featuredContainer.innerHTML = properties.map(property => `
        <div class="property-card" onclick="window.location.href='${property.slug ? '/properties/' + property.slug : '/properties'}'">
          <div class="property-image">
            <img src="${property.photos && property.photos[0] ? property.photos[0] : '/img/property-placeholder.jpg'}" 
                 alt="${property.title}" loading="lazy" decoding="async"
                 onerror="this.src='/img/property-placeholder.jpg'">
          </div>
          <div class="property-content">
            <h3 class="property-title">${property.title}</h3>
            <div class="property-location">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              ${property.city}, ${property.country}
            </div>
            <div class="property-price">€${formatPrice(property.price)}</div>
          </div>
        </div>
      `).join('');
    } else {
      // Show fallback content if no properties
      featuredContainer.innerHTML = `
        <div class="no-properties">
          <p>No featured properties available at the moment.</p>
          <a href="/properties" class="btn btn-primary">Browse All Properties</a>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading featured properties:', error);
    // Show error state
    featuredContainer.innerHTML = `
      <div class="error-state">
        <p>Unable to load featured properties.</p>
        <button onclick="loadFeaturedProperties()" class="btn btn-secondary">Try Again</button>
      </div>
    `;
  }
}

// Initialize search form
function initializeSearchForm() {
  const searchForm = document.querySelector('.search-form');
  if (!searchForm) {
    console.warn('❌ Search form not found');
    return;
  }
  
  console.log('🔍 Initializing search form...');
  
  searchForm.addEventListener('submit', function(e) {
    e.preventDefault();
    console.log('🔍 Search form submitted');
    
    const formData = new FormData(this);
    const searchParams = new URLSearchParams();
    
    // Build search query
    for (let [key, value] of formData.entries()) {
      if (value && value.trim() !== '') {
        searchParams.append(key, value);
        console.log(`🔍 Adding search parameter: ${key} = ${value}`);
      }
    }
    
    // Redirect to properties page with search parameters
    const searchUrl = `/properties?${searchParams.toString()}`;
    console.log('🔍 Redirecting to:', searchUrl);
    window.location.href = searchUrl;
  });
  
  console.log('✅ Search form initialized');
}

// Format price with commas
function formatPrice(price) {
  if (!price) return '0';
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Add intersection observer for animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('fade-in');
    }
  });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', function() {
  const animatedElements = document.querySelectorAll('.service-card, .property-card');
  animatedElements.forEach(el => observer.observe(el));
});

// Mortgage Calculator Functions
function calculateMortgage() {
  const propertyPrice = parseFloat(document.getElementById('propertyPrice').value) || 0;
  const downPayment = parseFloat(document.getElementById('downPayment').value) || 0;
  const loanTerm = parseInt(document.getElementById('loanTerm').value) || 30;
  const interestRate = parseFloat(document.getElementById('interestRate').value) || 0;
  
  if (propertyPrice <= 0 || downPayment < 0 || interestRate <= 0) {
    alert('Please enter valid values for all fields.');
    return;
  }
  
  if (downPayment >= propertyPrice) {
    alert('Down payment cannot be greater than or equal to property price.');
    return;
  }
  
  const loanAmount = propertyPrice - downPayment;
  const monthlyInterestRate = interestRate / 100 / 12;
  const numberOfPayments = loanTerm * 12;
  
  // Calculate monthly payment using the mortgage formula
  let monthlyPayment = 0;
  if (monthlyInterestRate > 0) {
    monthlyPayment = loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) / 
                     (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);
  }
  
  // Calculate total interest and cost
  const totalInterest = (monthlyPayment * numberOfPayments) - loanAmount;
  const totalCost = monthlyPayment * numberOfPayments;
  
  // Estimate property tax (typically 1-2% of property value annually)
  const annualPropertyTax = propertyPrice * 0.015; // 1.5% estimate
  const monthlyPropertyTax = annualPropertyTax / 12;
  
  // Estimate insurance (typically 0.5-1% of property value annually)
  const annualInsurance = propertyPrice * 0.0075; // 0.75% estimate
  const monthlyInsurance = annualInsurance / 12;
  
  const totalMonthlyPayment = monthlyPayment + monthlyPropertyTax + monthlyInsurance;
  
  // Display results
  document.getElementById('monthlyPayment').textContent = `€${formatPrice(Math.round(monthlyPayment))}`;
  document.getElementById('propertyTax').textContent = `€${formatPrice(Math.round(monthlyPropertyTax))}`;
  document.getElementById('insurance').textContent = `€${formatPrice(Math.round(monthlyInsurance))}`;
  document.getElementById('totalPayment').textContent = `€${formatPrice(Math.round(totalMonthlyPayment))}`;
  
  document.getElementById('loanAmount').textContent = `€${formatPrice(Math.round(loanAmount))}`;
  document.getElementById('totalInterest').textContent = `€${formatPrice(Math.round(totalInterest))}`;
  document.getElementById('totalCost').textContent = `€${formatPrice(Math.round(totalCost))}`;
  
  // Hide form, show results (same centered spot)
  document.getElementById('calculatorForm').classList.add('calculator-hidden');
  document.getElementById('calculatorResults').classList.add('calculator-visible');
}

function resetMortgageCalculator() {
  document.getElementById('calculatorResults').classList.remove('calculator-visible');
  document.getElementById('calculatorForm').classList.remove('calculator-hidden');
}

// Add input validation for calculator
document.addEventListener('DOMContentLoaded', function() {
  const calculatorInputs = document.querySelectorAll('#propertyPrice, #downPayment, #interestRate');
  
  calculatorInputs.forEach(input => {
    input.addEventListener('input', function() {
      const value = parseFloat(this.value);
      const min = parseFloat(this.min) || 0;
      const max = parseFloat(this.max) || Infinity;
      
      if (value < min) {
        this.value = min;
      } else if (value > max) {
        this.value = max;
      }
    });
  });
  
  // Auto-calculate when down payment changes
  const downPaymentInput = document.getElementById('downPayment');
  const propertyPriceInput = document.getElementById('propertyPrice');
  
  if (downPaymentInput && propertyPriceInput) {
    downPaymentInput.addEventListener('input', function() {
      const downPayment = parseFloat(this.value) || 0;
      const propertyPrice = parseFloat(propertyPriceInput.value) || 0;
      
      if (downPayment > propertyPrice) {
        this.value = propertyPrice;
      }
    });
  }
});
