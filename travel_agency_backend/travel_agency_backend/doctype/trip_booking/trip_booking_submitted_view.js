// Functions to enhance the submitted view of Trip Booking
frappe.provide("travel_agency.trip_booking.submitted_view");

// Display passenger segments in the submitted view
travel_agency.trip_booking.submitted_view.show_passenger_segments = function(frm) {
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

// Ensure invoice creation buttons are visible
travel_agency.trip_booking.submitted_view.ensure_invoice_buttons = function(frm) {
    if (frm.doc.docstatus !== 1) return;
    
    // Check if invoices already exist
    const salesInvoiceExists = frm.doc.sales_invoice_id;
    const purchaseInvoiceExists = frm.doc.purchase_invoice_ids && frm.doc.purchase_invoice_ids.length > 0;
    
    // Create group for invoice creation buttons
    const createGroup = __('Create');
    
    // Set button color based on invoice existence
    if (!salesInvoiceExists) {
        // Add Sales Invoice button (red if no invoice exists)
        frm.add_custom_button(__('Sales Invoice'), function() {
            frappe.model.open_mapped_doc({
                method: "travel_agency_backend.travel_agency_backend.doctype.trip_booking.trip_booking.make_sales_invoice_from_trip",
                frm: frm,
                callback: function(doc) {
                    // Refresh the form after invoice creation
                    frm.reload_doc();
                }
            });
        }, createGroup).addClass('btn-danger');
    }
    
    if (!purchaseInvoiceExists) {
        // Add Purchase Invoices button (red if no invoices exist)
        frm.add_custom_button(__('Purchase Invoices'), function() {
            frappe.call({
                method: "travel_agency_backend.travel_agency_backend.doctype.trip_booking.trip_booking.make_purchase_invoices_from_trip",
                args: {
                    source_name: frm.doc.name
                },
                callback: function(r) {
                    if (r.message && r.message.length) {
                        frappe.msgprint({
                            title: __('Purchase Invoices Created'),
                            message: __('Created {0} Purchase Invoice(s)', [r.message.length]),
                            indicator: 'green'
                        });
                        // Refresh the form after invoice creation
                        frm.reload_doc();
                    } else {
                        frappe.msgprint({
                            title: __('No Invoices Created'),
                            message: __('No Purchase Invoices were created. Please check supplier and cost details.'),
                            indicator: 'orange'
                        });
                    }
                }
            });
        }, createGroup).addClass('btn-danger');
    }
};
