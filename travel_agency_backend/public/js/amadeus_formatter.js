/**
 * Amadeus API Response Formatter
 * Formats JSON responses into user-friendly tables/cards
 */

// Format flight search results
function formatFlightResults(data) {
    if (!data || !data.flight_offers || data.flight_offers.length === 0) {
        return '<div class="alert alert-warning">No flights found matching your criteria</div>';
    }

    let html = '<div class="flight-results">';
    html += '<h4>Found ' + (data.count || data.flight_offers.length) + ' flight options</h4>';
    html += '<table class="table table-bordered table-hover">';
    
    // Table headers
    html += `
        <thead>
            <tr>
                <th>Airline</th>
                <th>Route</th>
                <th>Departure</th>
                <th>Arrival</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
    `;

    // Loop through flight offers
    data.flight_offers.forEach(function(offer) {
        // Extract price
        const price = offer.price ? offer.price.total + ' ' + offer.price.currency : 'N/A';
        
        // Extract first itinerary (outbound)
        const itinerary = offer.itineraries && offer.itineraries.length > 0 ? offer.itineraries[0] : null;
        if (!itinerary) return;
        
        // Get segments
        const segments = itinerary.segments || [];
        if (segments.length === 0) return;
        
        // Get first and last segment for departure/arrival
        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];
        
        // Extract airlines from all segments
        const airlines = segments.map(seg => seg.carrierCode || 'Unknown').filter((v, i, a) => a.indexOf(v) === i).join(', ');
        
        // Format route
        const route = firstSegment.departure.iataCode + ' → ' + lastSegment.arrival.iataCode;
        
        // Format departure/arrival
        const departure = formatDateTime(firstSegment.departure.at);
        const arrival = formatDateTime(lastSegment.arrival.at);
        
        // Format duration
        const duration = formatDuration(itinerary.duration || '');
        
        // Add table row
        html += `
            <tr>
                <td>${airlines}</td>
                <td>${route}</td>
                <td>${departure}</td>
                <td>${arrival}</td>
                <td>${duration}</td>
                <td><strong>${price}</strong></td>
                <td>
                    <button class="btn btn-primary btn-sm book-flight" data-offer-id="${offer.id}">Book Now</button>
                    <button class="btn btn-default btn-sm view-details" data-offer-id="${offer.id}">Details</button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    return html;
}

// Format airport search results
function formatAirportResults(data) {
    if (!data || !data.data || data.data.length === 0) {
        return '<div class="alert alert-warning">No airports found matching your criteria</div>';
    }

    let html = '<div class="airport-results">';
    html += '<h4>Found ' + data.data.length + ' airports/cities</h4>';
    html += '<table class="table table-bordered table-hover">';
    
    // Table headers
    html += `
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

    // Loop through airports
    data.data.forEach(function(airport) {
        const address = airport.address || {};
        
        // Add table row
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

    html += '</tbody></table></div>';
    return html;
}

// Format hotel search results
function formatHotelResults(data) {
    if (!data || !data.data || data.data.length === 0) {
        return '<div class="alert alert-warning">No hotels found matching your criteria</div>';
    }

    let html = '<div class="hotel-results row">';

    // Loop through hotels
    data.data.forEach(function(hotelOffer) {
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
        
        // Create hotel card
        html += `
            <div class="col-md-6">
                <div class="panel panel-default hotel-card">
                    <div class="panel-heading">
                        <h4>${hotelName}</h4>
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
                        <div class="price-tag">
                            <span class="price">${price}</span>
                        </div>
                    </div>
                    <div class="panel-footer">
                        <button class="btn btn-primary book-hotel" data-hotel-id="${hotel.hotelId}">Book Now</button>
                        <button class="btn btn-default view-hotel-details" data-hotel-id="${hotel.hotelId}">View Details</button>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

// Helper function: Format date and time
function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return 'N/A';
    
    try {
        const date = new Date(dateTimeStr);
        return date.toLocaleString(undefined, {
            dateStyle: 'short',
            timeStyle: 'short'
        });
    } catch (e) {
        return dateTimeStr;
    }
}

// Helper function: Format date only
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
}

// Helper function: Format duration (e.g. PT2H45M to 2h 45m)
function formatDuration(durationStr) {
    if (!durationStr) return 'N/A';
    
    // Format PT2H55M to "2h 55m"
    const hourMatch = durationStr.match(/(\d+)H/);
    const minuteMatch = durationStr.match(/(\d+)M/);
    
    const hours = hourMatch ? hourMatch[1] : '0';
    const minutes = minuteMatch ? minuteMatch[1] : '0';
    
    return `${hours}h ${minutes}m`;
}
