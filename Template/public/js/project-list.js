// Project List Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Initialize the page
  initializeProjectList();
  // Pre-populate cascading selects if present
  try {
    const fc = document.getElementById('filterCountry');
    const fci = document.getElementById('filterCity');
    if (fc && fci && typeof window.updateCities === 'function') {
      window.updateCities(true);
      if (typeof window.updateNeighborhoods === 'function') window.updateNeighborhoods(true);
    }
  } catch (_) {}
});

function initializeProjectList() {
  // Initialize filters
  initializeFilters();
  
  // Initialize search functionality
  initializeSearch();
  
  // Initialize sorting
  initializeSorting();
  
  // Initialize pagination
  initializePagination();
  
  // Initialize project cards
  initializeProjectCards();

  // Bind euro formatting for unit price filters if present
  bindEuroFilter('minUnitPriceDisplay', 'minUnitPrice');
  bindEuroFilter('maxUnitPriceDisplay', 'maxUnitPrice');
}

// Filter Management
function initializeFilters() {
  // Do NOT auto-apply on input changes; wait for explicit submit
  // Handle clear filters buttons/links anywhere on page
  document.addEventListener('click', function(e) {
    const target = e.target.closest('.clear-filters');
    if (target) {
      e.preventDefault();
      clearAllFilters();
    }
  });

  // Handle location cascading (supports both old and new IDs)
  initializeLocationCascading();
}

function initializeLocationCascading() {
  const countrySelect = document.getElementById('country') || document.getElementById('filterCountry');
  const citySelect = document.getElementById('city') || document.getElementById('filterCity');
  const neighborhoodSelect = document.getElementById('neighborhood') || document.getElementById('filterNeighborhood');
  
  if (!countrySelect || !citySelect || !neighborhoodSelect) return;
  
  // Get locations data
  const locationsData = getLocationsData();
  
  // Populate countries when using legacy IDs only; for new IDs the server renders countries
  if (countrySelect && countrySelect.id === 'country') {
    populateCountries(countrySelect, locationsData);
  }
  
  // Handle country change
  countrySelect.addEventListener('change', function() {
    const selectedCountry = this.value;
    populateCities(citySelect, locationsData, selectedCountry);
    neighborhoodSelect.innerHTML = '<option value="">All Neighborhoods</option>';
    // Do not submit automatically; wait for Apply Filters button
  });
  
  // Handle city change
  citySelect.addEventListener('change', function() {
    const selectedCity = this.value;
    populateNeighborhoods(neighborhoodSelect, locationsData, countrySelect.value, selectedCity);
    // Do not submit automatically; wait for Apply Filters button
  });
  
  // Handle neighborhood change
  neighborhoodSelect.addEventListener('change', function() {
    // Do not submit automatically; wait for Apply Filters button
  });
}

function getLocationsData() {
  const locationsElement = document.getElementById('locations-data');
  if (!locationsElement) return {};
  
  try {
    return JSON.parse(locationsElement.dataset.locations);
  } catch (e) {
    console.error('Error parsing locations data:', e);
    return {};
  }
}

function populateCountries(select, locations) {
  select.innerHTML = '<option value="">All Countries</option>';
  
  Object.keys(locations).forEach(country => {
    const option = document.createElement('option');
    option.value = country;
    option.textContent = country;
    select.appendChild(option);
  });
}

function populateCities(select, locations, country) {
  select.innerHTML = '<option value="">All Cities</option>';
  
  if (!country || !locations[country]) return;
  
  Object.keys(locations[country]).forEach(city => {
    const option = document.createElement('option');
    option.value = city;
    option.textContent = city;
    select.appendChild(option);
  });
}

function populateNeighborhoods(select, locations, country, city) {
  select.innerHTML = '<option value="">All Neighborhoods</option>';
  
  if (!country || !city || !locations[country] || !locations[country][city]) return;
  
  locations[country][city].forEach(neighborhood => {
    const option = document.createElement('option');
    option.value = neighborhood;
    option.textContent = neighborhood;
    select.appendChild(option);
  });
}

function applyFilters() {
  const filterForm = document.getElementById('project-filters') || document.getElementById('filtersForm');
  if (!filterForm) return;
  if (typeof filterForm.submit === 'function') filterForm.submit();
}

function fetchFilteredResults(params) {
  // Show loading state
  showLoadingState();
  
  // Fetch from server
  fetch(`/api/projects?${params.toString()}`)
    .then(response => response.json())
    .then(data => {
      updateProjectResults(data);
      updateActiveFilters();
      hideLoadingState();
    })
    .catch(error => {
      console.error('Error fetching filtered results:', error);
      hideLoadingState();
      showErrorMessage('Error loading results. Please try again.');
    });
}

function clearAllFilters() {
  const filterForm = document.getElementById('project-filters') || document.getElementById('filtersForm');
  if (!filterForm) { window.location.href = '/projects'; return; }
  // Reset all form inputs
  const inputs = filterForm.querySelectorAll('input[type="text"], input[type="number"], select');
  inputs.forEach(input => { input.value = ''; });
  // Reset checkboxes
  const checkboxes = filterForm.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => { checkbox.checked = false; });
  // Navigate to base listing (clears URL params) to refresh server-rendered results
  window.location.href = '/projects';
}

// Search Functionality
function initializeSearch() {
  const searchForm = document.querySelector('.quick-search-form');
  if (!searchForm) return;
  
  searchForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const searchInput = this.querySelector('input[name="q"]');
    const searchQuery = searchInput.value.trim();
    
    if (searchQuery) {
      // Update the main search input in filters
      const mainSearchInput = document.getElementById('search-query');
      if (mainSearchInput) {
        mainSearchInput.value = searchQuery;
      }
      
      // Apply filters with search query
      applyFilters();
    }
  });
  
  // Handle search input changes
  const searchInputs = document.querySelectorAll('input[name="q"], #search-query');
  searchInputs.forEach(input => {
    input.addEventListener('input', debounce(function() {
      if (this.value.trim().length >= 2 || this.value.trim().length === 0) {
        applyFilters();
      }
    }, 500));
  });
}

// Sorting Functionality
function initializeSorting() {
  const sortSelect = document.getElementById('sort');
  if (!sortSelect) return;
  
  sortSelect.addEventListener('change', function() {
    applyFilters();
  });
}

// Pagination
function initializePagination() {
  const paginationContainer = document.querySelector('.pagination');
  if (!paginationContainer) return;
  
  // Handle pagination clicks
  paginationContainer.addEventListener('click', function(e) {
    if (e.target.classList.contains('page-link')) {
      e.preventDefault();
      
      const page = e.target.dataset.page;
      if (page) {
        goToPage(parseInt(page));
      }
    }
  });
}

function goToPage(page) {
  const currentUrl = new URL(window.location);
  currentUrl.searchParams.set('page', page);
  
  // Update URL
  window.history.pushState({}, '', currentUrl);
  
  // Show loading state
  showLoadingState();
  
  // Fetch page results
  fetchFilteredResults(currentUrl.searchParams);
}

// Project Cards
function initializeProjectCards() {
  const projectCards = document.querySelectorAll('.project-card');
  
  projectCards.forEach(card => {
    // Add click handler for navigation
    card.addEventListener('click', function() {
      const projectId = this.dataset.projectId;
      const projectSlug = this.dataset.projectSlug;
      
      if (projectSlug) {
        window.location.href = `/projects/${projectSlug}`;
      }
    });
    
    // Add hover effects
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-4px)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });
}

// Results Update
function updateProjectResults(data) {
  const projectsContainer = document.querySelector('.projects-container');
  if (!projectsContainer) return;
  
  if (data.projects && data.projects.length > 0) {
    // Update results count
    updateResultsCount(data.total, data.projects.length);
    
    // Render projects
    renderProjects(data.projects);
    
    // Update pagination
    updatePagination(data.currentPage, data.totalPages, data.total);
    
    // Show results
    projectsContainer.style.display = 'block';
  } else {
    // Show no results
    showNoResults();
  }
}

function renderProjects(projects) {
  const projectsGrid = document.querySelector('.projects-grid');
  if (!projectsGrid) return;
  
  projectsGrid.innerHTML = '';
  
  projects.forEach(project => {
    const projectCard = createProjectCard(project);
    projectsGrid.appendChild(projectCard);
  });
  
  // Reinitialize project cards
  initializeProjectCards();
}

function createProjectCard(project) {
  const card = document.createElement('div');
  card.className = 'project-card';
  card.dataset.projectId = project.id;
  card.dataset.projectSlug = project.slug;
  
  const imageUrl = project.photos && project.photos.length > 0 
    ? `/uploads/projects/${project.id}/${project.photos[0]}` 
    : '/images/placeholder-project.jpg';
  
  const completionStatus = getCompletionStatus(project.completion_date);
  const projectType = project.type || 'Development';
  
  card.innerHTML = `
    <div class="project-image">
      <img src="${imageUrl}" alt="${project.title}" loading="lazy">
      <div class="project-badges">
        <span class="badge badge-type">${projectType}</span>
        ${completionStatus ? `<span class="badge badge-completion">${completionStatus}</span>` : ''}
      </div>
    </div>
    <div class="project-content">
      <h3 class="project-title">${project.title}</h3>
      <div class="project-location">
        <i class="fas fa-map-marker-alt"></i>
        <span>${project.city}, ${project.country}</span>
      </div>
      <div class="project-details">
        ${project.total_units ? `<div class="detail-item"><i class="fas fa-building"></i><span>${project.total_units} units</span></div>` : ''}
        ${project.completion_date ? `<div class="detail-item"><i class="fas fa-calendar"></i><span>${project.completion_date}</span></div>` : ''}
      </div>
      <p class="project-description">${truncateText(project.description, 120)}</p>
      <div class="project-footer">
        <button class="btn btn-outline btn-sm">View Details</button>
      </div>
    </div>
  `;
  
  return card;
}

// Simple modal to show unit types for a project
function openUnitTypes(projectId) {
  const card = document.querySelector(`.project-card[data-project-id="${projectId}"]`);
  let types = [];
  try { types = JSON.parse(card?.dataset.unitTypes || '[]'); } catch (_) { types = []; }

  const existing = document.getElementById('unit-types-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'unit-types-modal';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.45)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '2000';

  const modal = document.createElement('div');
  modal.style.background = '#fff';
  modal.style.borderRadius = '12px';
  modal.style.boxShadow = '0 20px 40px rgba(0,0,0,0.2)';
  modal.style.width = 'min(92vw, 420px)';
  modal.style.padding = '20px';

  const title = document.createElement('h3');
  title.textContent = 'Unit Types';
  title.style.margin = '0 0 12px 0';
  modal.appendChild(title);

  const list = document.createElement('ul');
  list.style.margin = '0';
  list.style.padding = '0 0 10px 18px';
  list.style.color = '#334155';
  (types.length ? types : ['Villas','Apartments','Houses']).forEach(t => {
    const li = document.createElement('li'); li.textContent = t; list.appendChild(li);
  });
  modal.appendChild(list);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-primary';
  closeBtn.textContent = 'Close';
  closeBtn.style.marginTop = '8px';
  closeBtn.addEventListener('click', () => overlay.remove());
  modal.appendChild(closeBtn);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}
window.openUnitTypes = openUnitTypes;

function getCompletionStatus(completionDate) {
  if (!completionDate) return null;
  
  const today = new Date();
  const completion = new Date(completionDate);
  
  if (completion < today) {
    return 'Completed';
  } else if (completion.getTime() - today.getTime() < 30 * 24 * 60 * 60 * 1000) {
    return 'Soon';
  } else {
    return 'In Progress';
  }
}

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Active Filters Display
function updateActiveFilters() {
  const activeFiltersContainer = document.querySelector('.active-filters');
  if (!activeFiltersContainer) return;
  
  const filterForm = document.getElementById('project-filters');
  if (!filterForm) return;
  
  const formData = new FormData(filterForm);
  const activeFilters = [];
  
  // Collect active filters
  for (let [key, value] of formData.entries()) {
    if (value && value.trim() !== '' && key !== 'page') {
      activeFilters.push({ key, value });
    }
  }
  
  // Render active filters
  renderActiveFilters(activeFiltersContainer, activeFilters);
}

function renderActiveFilters(container, filters) {
  if (filters.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  const filtersHtml = filters.map(filter => `
    <span class="filter-tag">
      ${getFilterDisplayName(filter.key)}: ${filter.value}
      <button class="filter-remove" data-filter-key="${filter.key}" data-filter-value="${filter.value}">×</button>
    </span>
  `).join('');
  
  container.innerHTML = `
    <span class="active-filters-label">Active filters:</span>
    ${filtersHtml}
  `;
  
  // Add remove handlers
  const removeButtons = container.querySelectorAll('.filter-remove');
  removeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const key = this.dataset.filterKey;
      const value = this.dataset.filterValue;
      removeFilter(key, value);
    });
  });
}

function getFilterDisplayName(key) {
  const displayNames = {
    'q': 'Search',
    'country': 'Country',
    'city': 'City',
    'neighborhood': 'Neighborhood',
    'type': 'Type',
    'sort': 'Sort'
  };
  
  return displayNames[key] || key;
}

function removeFilter(key, value) {
  const filterForm = document.getElementById('project-filters');
  if (!filterForm) return;
  
  const input = filterForm.querySelector(`[name="${key}"]`);
  if (input) {
    if (input.type === 'checkbox') {
      input.checked = false;
    } else {
      input.value = '';
    }
    
    // Apply filters
    applyFilters();
  }
}

// Utility Functions
function updateResultsCount(total, current) {
  const resultsInfo = document.querySelector('.results-info p');
  if (resultsInfo) {
    resultsInfo.textContent = `Showing ${current} of ${total} projects`;
  }
}

function updatePagination(currentPage, totalPages, total) {
  const paginationContainer = document.querySelector('.pagination');
  if (!paginationContainer) return;
  
  if (totalPages <= 1) {
    paginationContainer.style.display = 'none';
    return;
  }
  
  paginationContainer.style.display = 'flex';
  
  let paginationHtml = '';
  
  // Previous button
  if (currentPage > 1) {
    paginationHtml += `<a href="#" class="page-link" data-page="${currentPage - 1}">Previous</a>`;
  }
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      paginationHtml += `<span class="page-link active">${i}</span>`;
    } else if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      paginationHtml += `<a href="#" class="page-link" data-page="${i}">${i}</a>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      paginationHtml += `<span class="page-link">...</span>`;
    }
  }
  
  // Next button
  if (currentPage < totalPages) {
    paginationHtml += `<a href="#" class="page-link" data-page="${currentPage + 1}">Next</a>`;
  }
  
  paginationContainer.innerHTML = paginationHtml;
}

function showNoResults() {
  const projectsContainer = document.querySelector('.projects-container');
  if (!projectsContainer) return;
  
  projectsContainer.innerHTML = `
    <div class="no-results">
      <div class="no-results-icon">🔍</div>
      <h3>No projects found</h3>
      <p>Try adjusting your search criteria or browse all projects</p>
      <div class="no-results-actions">
        <button class="btn btn-primary" onclick="clearAllFilters()">Clear Filters</button>
        <a href="/projects" class="btn btn-outline">View All Projects</a>
      </div>
    </div>
  `;
}

function showLoadingState() {
  const projectsContainer = document.querySelector('.projects-container');
  if (!projectsContainer) return;
  
  projectsContainer.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading projects...</p>
    </div>
  `;
}

function hideLoadingState() {
  // Loading state will be replaced when results are loaded
}

function showErrorMessage(message) {
  const projectsContainer = document.querySelector('.projects-container');
  if (!projectsContainer) return;
  
  projectsContainer.innerHTML = `
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <h3>Error</h3>
      <p>${message}</p>
      <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
    </div>
  `;
}

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Export functions for global access
window.ProjectList = {
  clearAllFilters,
  applyFilters,
  goToPage
};

// Euro formatter helpers for public filters
function bindEuroFilter(displayId, hiddenId) {
  const display = document.getElementById(displayId);
  const hidden = document.getElementById(hiddenId);
  if (!display || !hidden) return;
  const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

  const parseNumeric = (str) => {
    if (typeof str !== 'string') return null;
    const cleaned = str.replace(/[^0-9,\.]/g, '').replace(/,/g, '.');
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isNaN(num) ? null : num;
  };

  // Reflect initial hidden value
  if (hidden.value) {
    const raw = Number(hidden.value);
    if (!Number.isNaN(raw)) display.value = euro.format(raw);
  }

  display.addEventListener('input', () => {
    const num = parseNumeric(display.value);
    hidden.value = num === null ? '' : String(num.toFixed(2));
  });
  display.addEventListener('blur', () => {
    const num = parseNumeric(display.value);
    if (num === null) { display.value = ''; hidden.value = ''; return; }
    display.value = euro.format(num);
    hidden.value = String(num.toFixed(2));
  });
}

// ===== Cascading filters for Country → City → Neighborhood on public projects page =====
(function attachCascadingHandlers() {
  function getEls() {
    return {
      country: document.getElementById('filterCountry'),
      city: document.getElementById('filterCity'),
      neighborhood: document.getElementById('filterNeighborhood')
    };
  }

  function populateSelect(selectEl, options, placeholder) {
    if (!selectEl) return;
    const current = selectEl.value;
    selectEl.innerHTML = '';
    const first = document.createElement('option');
    first.value = '';
    first.textContent = placeholder;
    selectEl.appendChild(first);
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      selectEl.appendChild(o);
    });
    if (current && options.includes(current)) {
      selectEl.value = current;
    } else {
      selectEl.value = '';
    }
  }

  function updateCitiesImpl() {
    const { country, city, neighborhood } = getEls();
    if (!country || !city || !neighborhood) return;
    const locations = getLocationsData() || {};
    const selectedCountry = country.value;
    const cities = selectedCountry && locations[selectedCountry]
      ? Object.keys(locations[selectedCountry])
      : [];
    populateSelect(city, cities, 'Any City');
    populateSelect(neighborhood, [], 'Any Neighborhood');
    city.disabled = cities.length === 0;
    neighborhood.disabled = true;
  }

  function updateNeighborhoodsImpl() {
    const { country, city, neighborhood } = getEls();
    if (!country || !city || !neighborhood) return;
    const locations = getLocationsData() || {};
    const selectedCountry = country.value;
    const selectedCity = city.value;
    const neighborhoods = (selectedCountry && selectedCity && locations[selectedCountry] && locations[selectedCountry][selectedCity])
      ? locations[selectedCountry][selectedCity]
      : [];
    populateSelect(neighborhood, neighborhoods, 'Any Neighborhood');
    neighborhood.disabled = neighborhoods.length === 0;
  }

  // Expose as globals for inline onchange handlers in the EJS
  window.updateCities = updateCitiesImpl;
  window.updateNeighborhoods = updateNeighborhoodsImpl;
})();
