/**
 * Simple Amadeus API Showcase with just 3-4 buttons
 */
frappe.pages['amadeus-demo'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Amadeus API Showcase',
        single_column: true
    });

    // Set default dates
    initializeDates();
    
    // Set up event handlers for buttons
    setupEventHandlers();
};

// Set default dates
function initializeDates() {
    // Get dates for next week and next week + 3 days
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    
    const nextWeekPlus3 = new Date();
    nextWeekPlus3.setDate(nextWeekPlus3.getDate() + 10);
    const nextWeekPlus3Str = nextWeekPlus3.toISOString().split('T')[0];
    
    // Set default dates for all date inputs
    $('#flight-date').val(nextWeekStr);
    $('#hotel-checkin').val(nextWeekStr);
    $('#hotel-checkout').val(nextWeekPlus3Str);
}

// Set up event handlers
function setupEventHandlers() {
    // Flight search button
    $('#btn-search-flights').on('click', function() {
        searchFlights();
    });
    
    // Airport search button
    $('#btn-search-airports').on('click', function() {
        searchAirports();
    });
    
    // Hotel search button
    $('#btn-search-hotels').on('click', function() {
        searchHotels();
    });
}

// Flight search function
function searchFlights() {
    const origin = $('#flight-origin').val();
    const destination = $('#flight-destination').val();
    const departureDate = $('#flight-date').val();
    
    if (!origin || !destination || !departureDate) {
        frappe.msgprint('Please fill all required fields');
        return;
    }
    
    // Show loading indicator
    $('#flight-results').html('<div class="text-center"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Searching flights...</p></div>');
    
    // Call the API
    frappe.call({
        method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_flights',
        args: {
            origin: origin,
            destination: destination,
            departure_date: departureDate
        },
        callback: function(response) {
            if (response.message && response.message.flight_offers) {
                displayFlightResults(response.message);
            } else {
                $('#flight-results').html('<div class="alert alert-warning">No flights found matching your criteria</div>');
            }
        },
        error: function() {
            $('#flight-results').html('<div class="alert alert-danger">Error fetching flight data</div>');
        }
    });
}

// Airport search function
function searchAirports() {
    const query = $('#airport-query').val();
    
    if (!query) {
        frappe.msgprint('Please enter a search term');
        return;
    }
    
    // Show loading indicator
    $('#airport-results').html('<div class="text-center"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Searching airports...</p></div>');
    
    // Call the API
    frappe.call({
        method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_airports',
        args: {
            query: query
        },
        callback: function(response) {
            if (response.message && response.message.data) {
                displayAirportResults(response.message);
            } else {
                $('#airport-results').html('<div class="alert alert-warning">No airports found matching your criteria</div>');
            }
        },
        error: function() {
            $('#airport-results').html('<div class="alert alert-danger">Error fetching airport data</div>');
        }
    });
}

// Hotel search function
function searchHotels() {
    const cityCode = $('#hotel-city').val();
    const checkInDate = $('#hotel-checkin').val();
    const checkOutDate = $('#hotel-checkout').val();
    
    if (!cityCode || !checkInDate || !checkOutDate) {
        frappe.msgprint('Please fill all required fields');
        return;
    }
    
    // Show loading indicator
    $('#hotel-results').html('<div class="text-center"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Searching hotels...</p></div>');
    
    // Call the API
    frappe.call({
        method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_hotels',
        args: {
            cityCode: cityCode,
            checkInDate: checkInDate,
            checkOutDate: checkOutDate,
            adults: 1
        },
        callback: function(response) {
            if (response.message && response.message.data) {
                displayHotelResults(response.message);
            } else {
                $('#hotel-results').html('<div class="alert alert-warning">No hotels found matching your criteria</div>');
            }
        },
        error: function() {
            $('#hotel-results').html('<div class="alert alert-danger">Error fetching hotel data</div>');
        }
    });
}

// Format and display flight results
function displayFlightResults(data) {
    const flights = data.flight_offers;
    
    let html = `
        <h4>${flights.length} Flights Found</h4>
        <table class="table table-bordered table-hover">
            <thead>
                <tr>
                    <th>Airline</th>
                    <th>Route</th>
                    <th>Departure</th>
                    <th>Duration</th>
                    <th>Price</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    flights.forEach(flight => {
        const firstItinerary = flight.itineraries[0];
        const firstSegment = firstItinerary.segments[0];
        const lastSegment = firstItinerary.segments[firstItinerary.segments.length - 1];
        
        // Format departure time
        const departure = formatDateTime(firstSegment.departure.at);
        
        // Format duration
        const duration = formatDuration(firstItinerary.duration);
        
        // Format price
        const price = flight.price.total + ' ' + flight.price.currency;
        
        html += `
            <tr>
                <td>${firstSegment.carrierCode}</td>
                <td>${firstSegment.departure.iataCode} → ${lastSegment.arrival.iataCode}</td>
                <td>${departure}</td>
                <td>${duration}</td>
                <td class="price-tag">${price}</td>
                <td><button class="btn btn-sm btn-primary book-flight" data-flight-id="${flight.id}">Book Now</button></td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    
    // Add a toggle for raw JSON response
    html += `
        <div class="text-right">
            <a href="#" id="show-raw-flight">Show raw JSON</a>
        </div>
        <div id="raw-flight-response" style="display:none; margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 5px; font-family: monospace; white-space: pre-wrap; overflow-x: auto;">
            ${JSON.stringify(data, null, 2)}
        </div>
    `;
    
    $('#flight-results').html(html);
    
    // Add event handlers for the Book Now buttons
    $('.book-flight').on('click', function() {
        const flightId = $(this).data('flight-id');
        frappe.msgprint(`Booking flight ${flightId}`);
    });
    
    // Add event handler for raw JSON toggle
    $('#show-raw-flight').on('click', function(e) {
        e.preventDefault();
        $('#raw-flight-response').toggle();
        $(this).text($('#raw-flight-response').is(':visible') ? 'Hide raw JSON' : 'Show raw JSON');
    });
}

// Format and display airport results
function displayAirportResults(data) {
    const airports = data.data;
    
    let html = `
        <h4>${airports.length} Airports/Cities Found</h4>
        <table class="table table-bordered table-hover">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>IATA Code</th>
                    <th>City</th>
                    <th>Country</th>
                    <th>Type</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    airports.forEach(airport => {
        const address = airport.address || {};
        
        html += `
            <tr>
                <td>${airport.name || 'N/A'}</td>
                <td><strong>${airport.iataCode || 'N/A'}</strong></td>
                <td>${address.cityName || 'N/A'}</td>
                <td>${address.countryName || address.countryCode || 'N/A'}</td>
                <td>${airport.subType || airport.type || 'N/A'}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    
    // Add a toggle for raw JSON response
    html += `
        <div class="text-right">
            <a href="#" id="show-raw-airport">Show raw JSON</a>
        </div>
        <div id="raw-airport-response" style="display:none; margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 5px; font-family: monospace; white-space: pre-wrap; overflow-x: auto;">
            ${JSON.stringify(data, null, 2)}
        </div>
    `;
    
    $('#airport-results').html(html);
    
    // Add event handler for raw JSON toggle
    $('#show-raw-airport').on('click', function(e) {
        e.preventDefault();
        $('#raw-airport-response').toggle();
        $(this).text($('#raw-airport-response').is(':visible') ? 'Hide raw JSON' : 'Show raw JSON');
    });
}

// Format and display hotel results
function displayHotelResults(data) {
    const hotels = data.data;
    
    let html = `<h4>${hotels.length} Hotels Found</h4><div class="row">`;
    
    hotels.forEach(hotelOffer => {
        const hotel = hotelOffer.hotel || {};
        const offer = hotelOffer.offers && hotelOffer.offers.length > 0 ? hotelOffer.offers[0] : {};
        const price = offer.price ? offer.price.total + ' ' + offer.price.currency : 'Price not available';
        const hotelName = hotel.name || 'Unnamed Hotel';
        
        // Get address
        const address = hotel.address || {};
        const location = [address.lines, address.cityName, address.postalCode, address.countryName]
            .filter(Boolean)
            .join(', ');
        
        // Get check-in/out dates
        const checkIn = formatDate(offer.checkInDate || '');
        const checkOut = formatDate(offer.checkOutDate || '');
        
        html += `
            <div class="col-md-6">
                <div class="panel panel-default" style="margin-bottom: 20px;">
                    <div class="panel-heading">
                        <h4 style="margin: 5px 0;">${hotelName}</h4>
                    </div>
                    <div class="panel-body">
                        <p><i class="fa fa-map-marker"></i> ${location}</p>
                        <div class="row">
                            <div class="col-xs-6">
                                <p><strong>Check-in:</strong> ${checkIn}</p>
                            </div>
                            <div class="col-xs-6">
                                <p><strong>Check-out:</strong> ${checkOut}</p>
                            </div>
                        </div>
                        <div style="margin-top: 10px; text-align: right;">
                            <span style="font-size: 18px; font-weight: bold; color: #5e64ff;">${price}</span>
                        </div>
                    </div>
                    <div class="panel-footer">
                        <button class="btn btn-primary book-hotel" data-hotel-id="${hotel.hotelId}">Book Now</button>
                        <button class="btn btn-default view-hotel" data-hotel-id="${hotel.hotelId}">View Details</button>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // Add a toggle for raw JSON response
    html += `
        <div class="text-right">
            <a href="#" id="show-raw-hotel">Show raw JSON</a>
        </div>
        <div id="raw-hotel-response" style="display:none; margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 5px; font-family: monospace; white-space: pre-wrap; overflow-x: auto;">
            ${JSON.stringify(data, null, 2)}
        </div>
    `;
    
    $('#hotel-results').html(html);
    
    // Add event handlers for the Book Now buttons
    $('.book-hotel').on('click', function() {
        const hotelId = $(this).data('hotel-id');
        frappe.msgprint(`Booking hotel ${hotelId}`);
    });
    
    // Add event handlers for the View Details buttons
    $('.view-hotel').on('click', function() {
        const hotelId = $(this).data('hotel-id');
        frappe.msgprint(`Viewing details for hotel ${hotelId}`);
    });
    
    // Add event handler for raw JSON toggle
    $('#show-raw-hotel').on('click', function(e) {
        e.preventDefault();
        $('#raw-hotel-response').toggle();
        $(this).text($('#raw-hotel-response').is(':visible') ? 'Hide raw JSON' : 'Show raw JSON');
    });
}

// Format date and time
function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return 'N/A';
    
    try {
        const date = new Date(dateTimeStr);
        return date.toLocaleString();
    } catch (e) {
        return dateTimeStr;
    }
}

// Format date only
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    } catch (e) {
        return dateStr;
    }
}

// Format duration
function formatDuration(durationStr) {
    if (!durationStr) return 'N/A';
    
    // Format PT2H55M to "2h 55m"
    const hourMatch = durationStr.match(/(\d+)H/);
    const minuteMatch = durationStr.match(/(\d+)M/);
    
    const hours = hourMatch ? hourMatch[1] : '0';
    const minutes = minuteMatch ? minuteMatch[1] : '0';
    
    return `${hours}h ${minutes}m`;
}
