/**
 * Modern implementation of the Amadeus API Showcase
 * Uses proper tab navigation and formats responses into user-friendly displays
 */
frappe.pages['amadeus-demo'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Amadeus API Showcase',
        single_column: true
    });

    // Setup the demo directly - formatter.js will be loaded by the main file
    setupAmadeusDemo(page);
};

function setupAmadeusDemo(page) {
    // Add CSS
    const customCSS = `
        .api-tabs-container {
            margin: 20px 0;
        }
        
        .api-tab-content {
            padding: 20px 0;
        }
        
        .input-section {
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        
        .results-section {
            margin-top: 20px;
            border: 1px solid #e9e9e9;
            border-radius: 5px;
        }
        
        .hotel-card {
            margin-bottom: 20px;
        }
        
        .hotel-card .price-tag {
            margin-top: 15px;
            text-align: right;
        }
        
        .hotel-card .price {
            font-size: 18px;
            font-weight: bold;
            color: #5e64ff;
        }
        
        .response-toggle {
            margin-top: 10px;
            font-size: 12px;
        }
        
        .response-raw {
            display: none;
            margin-top: 10px;
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            white-space: pre-wrap;
            overflow-x: auto;
            max-height: 400px;
        }
    `;
    frappe.dom.set_style(customCSS);
    
    // Create base layout with proper tabs
    const layoutHTML = `
        <div class="api-tabs-container">
            <ul class="nav nav-tabs" id="amadeus-api-tabs">
                <li class="active"><a href="#flight-tab" data-toggle="tab">Flight Search</a></li>
                <li><a href="#airport-tab" data-toggle="tab">Airport Search</a></li>
                <li><a href="#hotel-tab" data-toggle="tab">Hotel Search</a></li>
            </ul>
            
            <div class="tab-content api-tab-content">
                <!-- Flight Search Tab -->
                <div class="tab-pane active" id="flight-tab">
                    <h3>Flight Search</h3>
                    <div class="input-section">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="flight-origin">Origin (Airport Code)</label>
                                    <input type="text" class="form-control" id="flight-origin" placeholder="e.g. JFK">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="flight-destination">Destination (Airport Code)</label>
                                    <input type="text" class="form-control" id="flight-destination" placeholder="e.g. LHR">
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="flight-departure">Departure Date</label>
                                    <input type="date" class="form-control" id="flight-departure">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="flight-return">Return Date (Optional)</label>
                                    <input type="date" class="form-control" id="flight-return">
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-primary" id="search-flights-btn">Search Flights</button>
                    </div>
                    <div id="flight-results" class="results-section" style="display:none;"></div>
                </div>
                
                <!-- Airport Search Tab -->
                <div class="tab-pane" id="airport-tab">
                    <h3>Airport Search</h3>
                    <div class="input-section">
                        <div class="row">
                            <div class="col-md-12">
                                <div class="form-group">
                                    <label for="airport-query">Search Query</label>
                                    <input type="text" class="form-control" id="airport-query" placeholder="e.g. London, Dubai, JFK">
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-primary" id="search-airports-btn">Search Airports</button>
                    </div>
                    <div id="airport-results" class="results-section" style="display:none;"></div>
                </div>
                
                <!-- Hotel Search Tab -->
                <div class="tab-pane" id="hotel-tab">
                    <h3>Hotel Search</h3>
                    <div class="input-section">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="hotel-city">City Code</label>
                                    <input type="text" class="form-control" id="hotel-city" placeholder="e.g. PAR">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="hotel-adults">Adults</label>
                                    <input type="number" class="form-control" id="hotel-adults" value="1" min="1">
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="hotel-checkin">Check-in Date</label>
                                    <input type="date" class="form-control" id="hotel-checkin">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="hotel-checkout">Check-out Date</label>
                                    <input type="date" class="form-control" id="hotel-checkout">
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-primary" id="search-hotels-btn">Search Hotels</button>
                    </div>
                    <div id="hotel-results" class="results-section" style="display:none;"></div>
                </div>
            </div>
        </div>
    `;
    
    // Append the layout to the page
    $(layoutHTML).appendTo(page.body);
    
    // Setup event handlers for the tabs to ensure they work correctly
    $('#amadeus-api-tabs a').on('click', function(e) {
        e.preventDefault();
        $(this).tab('show');
    });
    
    // Flight search form submission
    $('#search-flights-btn').on('click', function() {
        const origin = $('#flight-origin').val();
        const destination = $('#flight-destination').val();
        const departureDate = $('#flight-departure').val();
        const returnDate = $('#flight-return').val();
        
        if (!origin || !destination || !departureDate) {
            frappe.msgprint('Please fill all required fields');
            return;
        }
        
        const args = {
            origin: origin,
            destination: destination,
            departure_date: departureDate
        };
        
        if (returnDate) {
            args.return_date = returnDate;
        }
        
        // Show loading indicator
        $('#flight-results').html('<div class="text-center"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Searching flights...</p></div>').show();
        
        frappe.call({
            method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_flights',
            args: args,
            callback: function(r) {
                // Format the results using our formatter
                const formattedResults = formatFlightResults(r.message);
                
                // Display formatted results
                $('#flight-results').html(formattedResults);
                
                // Add raw response toggle
                const rawResponseToggle = $(`
                    <div class="response-toggle">
                        <a href="#" class="toggle-raw">Show raw JSON response</a>
                        <div class="response-raw">${JSON.stringify(r.message, null, 2)}</div>
                    </div>
                `);
                
                $('#flight-results').append(rawResponseToggle);
                
                // Toggle raw response
                $('.toggle-raw').on('click', function(e) {
                    e.preventDefault();
                    const $raw = $(this).next('.response-raw');
                    $raw.toggle();
                    $(this).text($raw.is(':visible') ? 'Hide raw JSON response' : 'Show raw JSON response');
                });
                
                // Bind book now buttons
                $('.book-flight').on('click', function() {
                    const offerId = $(this).data('offer-id');
                    frappe.msgprint(`Booking flight offer ${offerId}. This would be integrated with your booking system.`);
                });
                
                // Bind view details buttons
                $('.view-details').on('click', function() {
                    const offerId = $(this).data('offer-id');
                    frappe.msgprint(`Viewing details for flight offer ${offerId}.`);
                    // Here you could show a modal with detailed flight information
                });
            }
        });
    });
    
    // Airport search form submission
    $('#search-airports-btn').on('click', function() {
        const query = $('#airport-query').val();
        
        if (!query) {
            frappe.msgprint('Please enter a search term');
            return;
        }
        
        // Show loading indicator
        $('#airport-results').html('<div class="text-center"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Searching airports...</p></div>').show();
        
        frappe.call({
            method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_airports',
            args: { query: query },
            callback: function(r) {
                // Format the results
                const formattedResults = formatAirportResults(r.message);
                
                // Display formatted results
                $('#airport-results').html(formattedResults);
                
                // Add raw response toggle
                const rawResponseToggle = $(`
                    <div class="response-toggle">
                        <a href="#" class="toggle-raw">Show raw JSON response</a>
                        <div class="response-raw">${JSON.stringify(r.message, null, 2)}</div>
                    </div>
                `);
                
                $('#airport-results').append(rawResponseToggle);
                
                // Toggle raw response
                $('.toggle-raw').on('click', function(e) {
                    e.preventDefault();
                    const $raw = $(this).next('.response-raw');
                    $raw.toggle();
                    $(this).text($raw.is(':visible') ? 'Hide raw JSON response' : 'Show raw JSON response');
                });
            }
        });
    });
    
    // Hotel search form submission
    $('#search-hotels-btn').on('click', function() {
        const cityCode = $('#hotel-city').val();
        const checkinDate = $('#hotel-checkin').val();
        const checkoutDate = $('#hotel-checkout').val();
        const adults = $('#hotel-adults').val();
        
        if (!cityCode || !checkinDate || !checkoutDate) {
            frappe.msgprint('Please fill all required fields');
            return;
        }
        
        // Show loading indicator
        $('#hotel-results').html('<div class="text-center"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Searching hotels...</p></div>').show();
        
        frappe.call({
            method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_hotels',
            args: {
                cityCode: cityCode,
                checkInDate: checkinDate,
                checkOutDate: checkoutDate,
                adults: adults
            },
            callback: function(r) {
                // Format the results
                const formattedResults = formatHotelResults(r.message);
                
                // Display formatted results
                $('#hotel-results').html(formattedResults);
                
                // Add raw response toggle
                const rawResponseToggle = $(`
                    <div class="response-toggle">
                        <a href="#" class="toggle-raw">Show raw JSON response</a>
                        <div class="response-raw">${JSON.stringify(r.message, null, 2)}</div>
                    </div>
                `);
                
                $('#hotel-results').append(rawResponseToggle);
                
                // Toggle raw response
                $('.toggle-raw').on('click', function(e) {
                    e.preventDefault();
                    const $raw = $(this).next('.response-raw');
                    $raw.toggle();
                    $(this).text($raw.is(':visible') ? 'Hide raw JSON response' : 'Show raw JSON response');
                });
                
                // Bind book now buttons
                $('.book-hotel').on('click', function() {
                    const hotelId = $(this).data('hotel-id');
                    frappe.msgprint(`Booking hotel ${hotelId}. This would be integrated with your booking system.`);
                });
                
                // Bind view details buttons
                $('.view-hotel-details').on('click', function() {
                    const hotelId = $(this).data('hotel-id');
                    frappe.msgprint(`Viewing details for hotel ${hotelId}.`);
                    // Here you could show a modal with detailed hotel information
                });
            }
        });
    });
    
    // Set today's date as the minimum for all date inputs
    const today = new Date().toISOString().split('T')[0];
    $('#flight-departure, #flight-return, #hotel-checkin, #hotel-checkout').attr('min', today);
    
    // Set default dates (today + 7 days for departure, today + 14 days for return)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    
    const twoWeeks = new Date();
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    const twoWeeksStr = twoWeeks.toISOString().split('T')[0];
    
    $('#flight-departure, #hotel-checkin').val(nextWeekStr);
    $('#flight-return, #hotel-checkout').val(twoWeeksStr);
}
