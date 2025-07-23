// Segment reordering functionality for multi-city flight booking
frappe.provide("travel_agency.trip_booking.reorder");

// Reorder segments for a passenger
travel_agency.trip_booking.reorder.reorder_segments = function(frm, passenger) {
    if (!frm.doc.flight_booking_entry_multicity || !passenger) {
        frappe.msgprint(__("No segments found for reordering."));
        return;
    }
    
    // Get segments for this passenger
    let segments = frm.doc.flight_booking_entry_multicity.filter(
        row => row.passenger === passenger
    );
    
    if (segments.length <= 1) {
        frappe.msgprint(__("Need at least two segments to reorder."));
        return;
    }
    
    // Sort segments by segment number
    segments.sort((a, b) => a.segment_number - b.segment_number);
    
    // Create HTML for reordering
    let html = `
        <div class="segment-reorder-container">
            <div class="alert alert-info">
                Drag and drop segments to reorder. The segment numbers will be updated automatically.
            </div>
            <table class="table table-bordered segment-reorder-table">
                <thead>
                    <tr>
                        <th style="width: 10%">Segment</th>
                        <th style="width: 20%">From</th>
                        <th style="width: 20%">To</th>
                        <th style="width: 20%">Date</th>
                        <th style="width: 15%">Airline</th>
                        <th style="width: 15%">Flight #</th>
                    </tr>
                </thead>
                <tbody id="reorder_segments_tbody">
                    ${segments.map((segment, idx) => `
                        <tr data-idx="${segment.idx}" data-segment-number="${segment.segment_number}">
                            <td class="segment-number">${segment.segment_number}</td>
                            <td>${segment.from_location || ''}</td>
                            <td>${segment.to_location || ''}</td>
                            <td>${segment.date_of_travel ? frappe.format(segment.date_of_travel, {fieldtype: 'Date'}) : ''}</td>
                            <td>${segment.airline || ''}</td>
                            <td>${segment.flight_number || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    // Create dialog
    let d = new frappe.ui.Dialog({
        title: `Reorder Segments for ${passenger}`,
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'segment_reorder',
                options: html
            }
        ],
        primary_action_label: 'Update Order',
        primary_action: function() {
            // Get the new order
            const newOrder = [];
            d.$wrapper.find('#reorder_segments_tbody tr').each(function(index) {
                const idx = $(this).data('idx');
                newOrder.push({
                    idx: idx,
                    segment_number: index + 1
                });
            });
            
            // Update segment numbers
            newOrder.forEach(item => {
                const rowIdx = item.idx - 1;
                if (frm.doc.flight_booking_entry_multicity[rowIdx]) {
                    frappe.model.set_value(
                        'Flight Booking Entry Multicity',
                        frm.doc.flight_booking_entry_multicity[rowIdx].name,
                        'segment_number',
                        item.segment_number
                    );
                }
            });
            
            frm.refresh_field('flight_booking_entry_multicity');
            
            // Update totals
            if (travel_agency.trip_booking.totals && travel_agency.trip_booking.totals.update_trip_booking_totals) {
                travel_agency.trip_booking.totals.update_trip_booking_totals(frm);
            }
            
            frappe.show_alert({
                message: __(`Segments reordered for passenger ${passenger}`),
                indicator: 'green'
            }, 5);
            
            d.hide();
            
            // Validate segment connections
            travel_agency.trip_booking.reorder.validate_segment_connections(frm, passenger);
        }
    });
    
    d.show();
    
    // Make the tbody sortable
    d.$wrapper.find('#reorder_segments_tbody').sortable({
        items: 'tr',
        cursor: 'move',
        axis: 'y',
        update: function() {
            // Update segment numbers in the UI
            d.$wrapper.find('#reorder_segments_tbody tr').each(function(index) {
                $(this).find('.segment-number').text(index + 1);
            });
        }
    });
};

// Validate segment connections after reordering
travel_agency.trip_booking.reorder.validate_segment_connections = function(frm, passenger) {
    if (!frm.doc.flight_booking_entry_multicity || !passenger) return;
    
    // Get segments for this passenger
    let segments = frm.doc.flight_booking_entry_multicity.filter(
        row => row.passenger === passenger
    );
    
    // Sort segments by segment number
    segments.sort((a, b) => a.segment_number - b.segment_number);
    
    // Check connections
    let issues = [];
    
    for (let i = 1; i < segments.length; i++) {
        const prevSegment = segments[i-1];
        const currSegment = segments[i];
        
        // Check location connections
        if (prevSegment.to_location !== currSegment.from_location) {
            issues.push(`Segment ${currSegment.segment_number} should start from ${prevSegment.to_location} (end of segment ${prevSegment.segment_number}), but starts from ${currSegment.from_location} instead.`);
        }
        
        // Check dates
        if (prevSegment.date_of_travel && currSegment.date_of_travel) {
            const prevDate = new Date(prevSegment.date_of_travel);
            const currDate = new Date(currSegment.date_of_travel);
            
            if (currDate < prevDate) {
                issues.push(`Segment ${currSegment.segment_number} date (${frappe.format(currSegment.date_of_travel, {fieldtype: 'Date'})}) is earlier than segment ${prevSegment.segment_number} date (${frappe.format(prevSegment.date_of_travel, {fieldtype: 'Date'})}).`);
            }
        }
    }
    
    // Show issues if any
    if (issues.length > 0) {
        frappe.msgprint({
            title: __('Segment Connection Issues'),
            indicator: 'orange',
            message: __('The following issues were found with the segment connections:') + 
                '<ul>' + issues.map(issue => `<li>${issue}</li>`).join('') + '</ul>' +
                '<p>You may want to edit the segments to fix these issues.</p>'
        });
    }
};

// Add reorder button to passenger segments view
travel_agency.trip_booking.reorder.enhance_view_passenger_segments = function() {
    // Store the original function
    const original_view_passenger_segments = travel_agency.trip_booking.view_passenger_segments;
    
    // Replace with enhanced version
    travel_agency.trip_booking.view_passenger_segments = function(frm, passenger) {
        // Call the original function
        original_view_passenger_segments(frm, passenger);
        
        // Add reorder button to the dialog
        setTimeout(() => {
            const dialogs = $('.modal-dialog:visible');
            if (dialogs.length > 0) {
                const dialog = dialogs.last();
                const title = dialog.find('.modal-title').text();
                
                if (title.includes('Segments for')) {
                    const footer = dialog.find('.modal-footer');
                    
                    // Add reorder button if not already added
                    if (footer.find('.reorder-segments-btn').length === 0) {
                        const reorderBtn = $(`
                            <button class="btn btn-default reorder-segments-btn">
                                <i class="fa fa-sort"></i> Reorder Segments
                            </button>
                        `);
                        
                        footer.prepend(reorderBtn);
                        
                        reorderBtn.on('click', function() {
                            // Close the current dialog
                            dialog.find('.btn-modal-close').click();
                            
                            // Open reorder dialog
                            setTimeout(() => {
                                travel_agency.trip_booking.reorder.reorder_segments(frm, passenger);
                            }, 300);
                        });
                    }
                }
            }
        }, 300);
    };
};

// Initialize the enhancements
$(document).ready(function() {
    travel_agency.trip_booking.reorder.enhance_view_passenger_segments();
});

// Add reorder button to Trip Booking form
frappe.ui.form.on('Trip Booking', {
    refresh: function(frm) {
        if (frm.doc.flight_multicity_supplier && frm.doc.flight_booking_entry_multicity && frm.doc.flight_booking_entry_multicity.length > 0) {
            // Get unique passengers
            let passengers = [...new Set(frm.doc.flight_booking_entry_multicity.map(row => row.passenger))];
            
            if (passengers.length > 0) {
                frm.add_custom_button(__('Reorder Segments'), function() {
                    // If only one passenger, open reorder directly
                    if (passengers.length === 1) {
                        travel_agency.trip_booking.reorder.reorder_segments(frm, passengers[0]);
                    } else {
                        // Show passenger selection dialog
                        frappe.prompt([
                            {
                                fieldname: 'passenger',
                                fieldtype: 'Select',
                                label: 'Select Passenger',
                                options: passengers,
                                reqd: 1
                            }
                        ], function(values) {
                            travel_agency.trip_booking.reorder.reorder_segments(frm, values.passenger);
                        }, 'Select Passenger for Segment Reordering');
                    }
                }, __('Flight Multi City'));
            }
        }
    }
});
