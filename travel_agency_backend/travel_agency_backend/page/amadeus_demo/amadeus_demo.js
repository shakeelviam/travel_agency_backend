frappe.pages['amadeus-demo'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Amadeus API Showcase',
        single_column: true
    });

    // Add the page content
    $(frappe.render_template('amadeus_demo', {})).appendTo(page.body);
    
    // Initialize the demo page
    initAmadeusDemoPage(page);
};

function initAmadeusDemoPage(page) {
    // API categories and endpoints
    const apiCategories = [
        {
            name: "Flight",
            icon: "airplane",
            endpoints: [
                { name: "Flight Offers Search", id: "flight_search", method: "search_flights" },
                { name: "Flight Cheapest Date Search", id: "flight_cheapest", method: "search_cheapest_flights" },
                { name: "Flight Inspiration Search", id: "flight_inspiration", method: "search_flight_inspiration" },
                { name: "Flight Order Creation", id: "flight_order", method: "create_flight_order" }
            ]
        },
        {
            name: "Airport & City",
            icon: "map-pin",
            endpoints: [
                { name: "Airport & City Search", id: "airport_search", method: "search_airports" },
                { name: "Airport Nearest Relevant", id: "airport_nearest", method: "find_nearest_airports" },
                { name: "City Search", id: "city_search", method: "search_cities" }
            ]
        },
        {
            name: "Hotel",
            icon: "home",
            endpoints: [
                { name: "Hotel Search", id: "hotel_search", method: "search_hotels" },
                { name: "Hotel Booking", id: "hotel_booking", method: "book_hotel" },
                { name: "Hotel Ratings", id: "hotel_ratings", method: "get_hotel_ratings" }
            ]
        }
    ];

    // Initialize the sidebar navigation
    initSidebar(page, apiCategories);
    
    // Setup the main content area
    setupMainContentArea(page);
    
    // Show welcome screen initially
    showWelcomeScreen();
    
    // Register module endpoints
    registerEndpoints();
}

function initSidebar(page, apiCategories) {
    // Add sidebar section
    page.sidebar.addClass('amadeus-demo-sidebar');
    
    const sidebarHTML = `
        <div class="amadeus-sidebar-content">
            <div class="search-field">
                <input type="text" placeholder="Search APIs..." class="form-control api-search-box">
            </div>
            <div class="sidebar-categories"></div>
        </div>
    `;
    
    $(sidebarHTML).appendTo(page.sidebar);
    
    // Populate sidebar with categories and endpoints
    const $categoriesContainer = page.sidebar.find('.sidebar-categories');
    
    apiCategories.forEach(category => {
        const $categorySection = $(`
            <div class="category-section">
                <div class="category-header">
                    <span class="category-icon"><i class="fa fa-${category.icon}"></i></span>
                    <span class="category-name">${category.name}</span>
                </div>
                <div class="category-endpoints"></div>
            </div>
        `);
        
        const $endpointsContainer = $categorySection.find('.category-endpoints');
        
        category.endpoints.forEach(endpoint => {
            const $endpoint = $(`
                <div class="endpoint-item" data-endpoint-id="${endpoint.id}">
                    <span>${endpoint.name}</span>
                </div>
            `);
            
            $endpoint.on('click', () => {
                loadEndpoint(endpoint);
                
                // Update active state
                page.sidebar.find('.endpoint-item').removeClass('active');
                $endpoint.addClass('active');
            });
            
            $endpoint.appendTo($endpointsContainer);
        });
        
        $categorySection.appendTo($categoriesContainer);
    });
    
    // Implement search functionality
    const $searchBox = page.sidebar.find('.api-search-box');
    
    $searchBox.on('input', () => {
        const searchTerm = $searchBox.val().toLowerCase();
        
        page.sidebar.find('.endpoint-item').each(function() {
            const endpointText = $(this).text().toLowerCase();
            if (endpointText.includes(searchTerm)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
        
        // Show/hide categories based on visible endpoints
        page.sidebar.find('.category-section').each(function() {
            const visibleEndpoints = $(this).find('.endpoint-item:visible').length;
            if (visibleEndpoints > 0) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    });
}

function setupMainContentArea(page) {
    // Add main content container
    const mainContentHTML = `
        <div class="amadeus-demo-content">
            <div class="welcome-screen"></div>
            <div class="endpoint-container" style="display:none;">
                <div class="endpoint-header">
                    <h4 class="endpoint-title"></h4>
                    <div class="endpoint-description"></div>
                </div>
                <div class="form-container"></div>
                <div class="response-container">
                    <div class="response-header">
                        <h5>Response</h5>
                        <div class="response-actions">
                            <button class="btn btn-xs btn-default copy-response">
                                <i class="fa fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                    <div class="response-body">
                        <pre><code class="response-code json"></code></pre>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $(mainContentHTML).appendTo(page.main);
    
    // Setup copy button
    page.main.find('.copy-response').on('click', () => {
        const responseText = page.main.find('.response-code').text();
        navigator.clipboard.writeText(responseText).then(() => {
            frappe.show_alert({
                message: __('Response copied to clipboard'),
                indicator: 'green'
            }, 3);
        });
    });
}

function showWelcomeScreen() {
    const $welcomeScreen = $('.welcome-screen');
    $welcomeScreen.empty();
    
    const welcomeHTML = `
        <div class="jumbotron text-center">
            <h1>Amadeus API Showcase</h1>
            <p class="lead">Explore and test Amadeus Travel APIs directly from your ERPNext system</p>
            <div class="welcome-icons">
                <div class="welcome-icon">
                    <i class="fa fa-airplane fa-3x"></i>
                    <span>Flights</span>
                </div>
                <div class="welcome-icon">
                    <i class="fa fa-home fa-3x"></i>
                    <span>Hotels</span>
                </div>
                <div class="welcome-icon">
                    <i class="fa fa-map-pin fa-3x"></i>
                    <span>Destinations</span>
                </div>
            </div>
            <p>Select an API endpoint from the sidebar to begin exploring the capabilities.</p>
        </div>
    `;
    
    $(welcomeHTML).appendTo($welcomeScreen);
    $('.endpoint-container').hide();
    $('.welcome-screen').show();
}

function loadEndpoint(endpoint) {
    $('.welcome-screen').hide();
    const $endpointContainer = $('.endpoint-container');
    const $formContainer = $endpointContainer.find('.form-container');
    
    // Reset form and response
    $formContainer.empty();
    $('.response-code').empty();
    
    // Set endpoint title
    $('.endpoint-title').text(endpoint.name);
    
    // Load form based on endpoint
    if (endpoint.method && typeof endpointForms[endpoint.method] === 'function') {
        endpointForms[endpoint.method]($formContainer);
    } else {
        $formContainer.html(`<div class="alert alert-warning">Form definition for ${endpoint.name} not found.</div>`);
    }
    
    $endpointContainer.show();
}

// Collection of form definitions for each endpoint
const endpointForms = {
    search_flights: function($container) {
        const formHTML = `
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Origin (Airport Code)</label>
                        <input type="text" class="form-control" name="origin" placeholder="e.g. JFK" required>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Destination (Airport Code)</label>
                        <input type="text" class="form-control" name="destination" placeholder="e.g. LHR" required>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Departure Date</label>
                        <div class="datepicker-container">
                            <input type="date" class="form-control" name="departure_date" required>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Return Date (Optional)</label>
                        <div class="datepicker-container">
                            <input type="date" class="form-control" name="return_date">
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-4">
                    <div class="form-group">
                        <label>Adults</label>
                        <input type="number" class="form-control" name="adults" value="1" min="1" max="9">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="form-group">
                        <label>Children</label>
                        <input type="number" class="form-control" name="children" value="0" min="0" max="9">
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="form-group">
                        <label>Infants</label>
                        <input type="number" class="form-control" name="infants" value="0" min="0" max="9">
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-12 text-right">
                    <button class="btn btn-primary btn-submit">Search Flights</button>
                </div>
            </div>
        `;
        
        $container.html(formHTML);
        
        // Handle form submission
        $container.find('.btn-submit').on('click', function() {
            const formData = {};
            $container.find('input').each(function() {
                const $input = $(this);
                if ($input.val()) {
                    formData[$input.attr('name')] = $input.val();
                }
            });
            
            // Validate required fields
            if (!formData.origin || !formData.destination || !formData.departure_date) {
                frappe.throw(__('Please fill all required fields'));
                return;
            }
            
            // Show loading
            frappe.show_alert({
                message: __('Searching flights...'),
                indicator: 'blue'
            });
            
            // Call API
            frappe.call({
                method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_flights',
                args: formData,
                callback: function(r) {
                    displayResponse(r.message);
                }
            });
        });
    },
    
    search_airports: function($container) {
        const formHTML = `
            <div class="row">
                <div class="col-md-12">
                    <div class="form-group">
                        <label>Search Query</label>
                        <input type="text" class="form-control" name="query" placeholder="e.g. London, Paris, JFK" required>
                        <small class="text-muted">Search by city name, airport name, or airport code</small>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Subtype</label>
                        <select class="form-control" name="subType">
                            <option value="AIRPORT">Airport</option>
                            <option value="CITY">City</option>
                            <option value="ANY">Any</option>
                        </select>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Results Limit</label>
                        <input type="number" class="form-control" name="limit" value="10" min="1" max="100">
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-12 text-right">
                    <button class="btn btn-primary btn-submit">Search</button>
                </div>
            </div>
        `;
        
        $container.html(formHTML);
        
        // Handle form submission
        $container.find('.btn-submit').on('click', function() {
            const formData = {};
            $container.find('input, select').each(function() {
                const $input = $(this);
                if ($input.val()) {
                    formData[$input.attr('name')] = $input.val();
                }
            });
            
            // Validate required fields
            if (!formData.query) {
                frappe.throw(__('Please enter a search query'));
                return;
            }
            
            // Show loading
            frappe.show_alert({
                message: __('Searching...'),
                indicator: 'blue'
            });
            
            // Call API
            frappe.call({
                method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_airports',
                args: { query: formData.query },
                callback: function(r) {
                    displayResponse(r.message);
                }
            });
        });
    }
};

// Register additional endpoint methods
function registerEndpoints() {
    // We'll implement these as needed
}

// Display API response
function displayResponse(response) {
    const $responseCode = $('.response-code');
    $responseCode.html(JSON.stringify(response, null, 2));
    
    // Highlight syntax
    if (typeof hljs !== 'undefined') {
        hljs.highlightElement($responseCode[0]);
    }
    
    // Scroll to response
    $('html, body').animate({
        scrollTop: $('.response-container').offset().top - 100
    }, 500);
}
