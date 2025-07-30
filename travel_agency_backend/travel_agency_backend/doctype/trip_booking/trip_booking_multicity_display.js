// Function to display passenger segments in submitted view
frappe.provide("travel_agency.trip_booking.display");

// Show passenger segments in the submitted view
travel_agency.trip_booking.display.show_passenger_segments_after_submit = function(frm) {
    if (frm.doc.docstatus !== 1) return;
    
    // Check if we have Flight Multi City segments
    if (!frm.doc.flight_booking_entry_multicity || frm.doc.flight_booking_entry_multicity.length === 0) return;
    
    // Get unique passengers
    let passengers = [...new Set(frm.doc.flight_booking_entry_multicity.map(row => row.passenger))];
    
    // Create HTML for passenger segments
    let html = `
        <div class="form-group">
            <div class="clearfix">
                <h4 class="form-section-heading uppercase">Flight Multi City Passengers</h4>
            </div>
            <div class="passenger-segments-container">
    `;
    
    // Add each passenger's segments
    passengers.forEach(passenger => {
        // Get segments for this passenger
        let segments = frm.doc.flight_booking_entry_multicity.filter(
            row => row.passenger === passenger
        );
        
        // Sort segments by segment number
        segments.sort((a, b) => a.segment_number - b.segment_number);
        
        // Create route summary
        let routePoints = segments.map(s => s.from_location);
        // Add the last destination
        if (segments.length > 0) {
            routePoints.push(segments[segments.length - 1].to_location);
        }
        let routeSummary = routePoints.join(' → ');
        
        // Add passenger section
        html += `
            <div class="passenger-section" style="margin-bottom: 20px; border: 1px solid #d1d8dd; border-radius: 4px; padding: 15px;">
                <h5 style="margin-top: 0;">${passenger}</h5>
                <div class="route-summary" style="background-color: #f9f9f9; padding: 8px; margin-bottom: 10px; border-radius: 4px;">
                    <strong>Route:</strong> ${routeSummary}
                </div>
                <table class="table table-bordered table-hover">
                    <thead>
                        <tr>
                            <th>Segment</th>
                            <th>From</th>
                            <th>To</th>
                            <th>Date</th>
                            <th>Airline</th>
                            <th>Flight</th>
                            <th>Class</th>
                            <th>PNR</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add rows for each segment
        segments.forEach(segment => {
            html += `
                <tr>
                    <td>${segment.segment_number || ''}</td>
                    <td>${segment.from_location || ''}</td>
                    <td>${segment.to_location || ''}</td>
                    <td>${segment.date_of_travel ? frappe.datetime.str_to_user(segment.date_of_travel) : ''}</td>
                    <td>${segment.airline || ''}</td>
                    <td>${segment.flight_number || ''}</td>
                    <td>${segment.booking_class || ''}</td>
                    <td>${segment.pnr || ''}</td>
                </tr>
            `;
        });
        
        // Close table
        html += `
                    </tbody>
                </table>
            </div>
        `;
    });
    
    // Close container
    html += `
            </div>
        </div>
    `;
    
    // Add the HTML to the form
    $(frm.fields_dict.flight_multicity_section.wrapper).append(html);
};
