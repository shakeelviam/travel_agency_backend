// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

// Import flt function for number handling
const flt = frappe.utils.flt;

frappe.ui.form.on('Flight Booking Entry Online', {
    trip_type: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        // Show/hide return sector based on trip type
        if (row.trip_type === 'One Way') {
            // For grid forms, we need to use the grid_row API
            const grid_row = frm.fields_dict.flight_booking_entry_online.grid.grid_rows_by_docname[cdn];
            if (grid_row) {
                grid_row.toggle_editable('return_sector', false);
                grid_row.toggle_display('return_sector', false);
                grid_row.toggle_editable('return_date', false);
                grid_row.toggle_display('return_date', false);
                frappe.model.set_value(cdt, cdn, 'return_sector', '');
                frappe.model.set_value(cdt, cdn, 'return_date', '');
            }
        } else if (row.trip_type === 'Return') {
            const grid_row = frm.fields_dict.flight_booking_entry_online.grid.grid_rows_by_docname[cdn];
            if (grid_row) {
                grid_row.toggle_editable('return_sector', true);
                grid_row.toggle_display('return_sector', true);
                grid_row.toggle_editable('return_date', true);
                grid_row.toggle_display('return_date', true);
            }
        }
    },
    
    form_render: function(frm, cdt, cdn) {
        // This runs when the row form is rendered
        const row = locals[cdt][cdn];
        const grid_row = frm.fields_dict.flight_booking_entry_online.grid.grid_rows_by_docname[cdn];
        if (!grid_row) return;
        
        if (row.trip_type === 'One Way') {
            // Hide return fields for One Way trips
            grid_row.toggle_editable('return_sector', false);
            grid_row.toggle_display('return_sector', false);
            grid_row.toggle_editable('return_date', false);
            grid_row.toggle_display('return_date', false);
        } else if (row.trip_type === 'Return') {
            // Show return fields for Return trips
            grid_row.toggle_editable('return_sector', true);
            grid_row.toggle_display('return_sector', true);
            grid_row.toggle_editable('return_date', true);
            grid_row.toggle_display('return_date', true);
        }
    },
    
    passenger: function(frm, cdt, cdn) {
        // Fetch passenger name when passenger is selected
        const row = locals[cdt][cdn];
        if (row.passenger) {
            frappe.db.get_value('Passenger', row.passenger, 'full_name', function(r) {
                if (r && r.full_name) {
                    frappe.model.set_value(cdt, cdn, 'passenger_name', r.full_name);
                }
            });
        }
    },
    
    supplier_cost: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
    },
    
    markup: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
    },
    
    service_fee: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
    }
});

// Function to calculate total amount
function calculate_total(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const supplier_cost = flt(row.supplier_cost) || 0;
    const markup = flt(row.markup) || 0;
    const service_fee = flt(row.service_fee) || 0;
    
    // Calculate total amount
    const total_amount = supplier_cost + markup + service_fee;
    
    // Update the total amount field
    frappe.model.set_value(cdt, cdn, 'total_amount', total_amount);
}
