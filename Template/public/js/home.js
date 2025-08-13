// Home Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
  console.log('=== JavaScript is loading! ===');
  
  // Get locations data from the page
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

  // Validate locations data structure
  if (!window.locations || typeof window.locations !== 'object' || Object.keys(window.locations).length === 0) {
    console.error('❌ Invalid or empty locations data:', window.locations);
    return;
  }

  // Initialize city dropdown functionality
  console.log('🚀 Initializing dropdowns...');
  initializeCityDropdown();
  
  // Load featured properties
  loadFeaturedProperties();
  
  // Initialize search form
  initializeSearchForm();
  
  console.log('=== JavaScript initialization complete ===');
});

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
    
    // Fetch featured properties from API
    const response = await fetch('/api/properties/featured');
    if (!response.ok) {
      throw new Error('Failed to fetch featured properties');
    }
    
    const properties = await response.json();
    
    // Render properties
    if (properties.length > 0) {
      featuredContainer.innerHTML = properties.map(property => `
        <div class="property-card" onclick="window.location.href='/properties/${property.slug}'">
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

// Add scroll effect to hero section
window.addEventListener('scroll', function() {
  const scrolled = window.pageYOffset;
  const hero = document.querySelector('.hero');
  if (hero) {
    const rate = scrolled * -0.5;
    hero.style.transform = `translateY(${rate}px)`;
  }
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
  
  // Show results
  document.getElementById('calculatorResults').style.display = 'block';
  
  // Scroll to results
  document.getElementById('calculatorResults').scrollIntoView({ 
    behavior: 'smooth', 
    block: 'start' 
  });
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
