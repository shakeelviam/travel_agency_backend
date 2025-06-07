// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Booking Entry Online', {
    trip_type: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        // Show/hide return sector based on trip type
        if (row.trip_type === 'One Way') {
            // For grid forms, we need to use the grid_row API
            const grid_row = cur_frm.fields_dict.flight_booking_entry_online.grid.grid_rows_by_docname[cdn];
            if (grid_row) {
                grid_row.toggle_editable('return_sector', false);
                grid_row.toggle_display('return_sector', false);
                grid_row.toggle_editable('return_date', false);
                grid_row.toggle_display('return_date', false);
                frappe.model.set_value(cdt, cdn, 'return_sector', '');
                frappe.model.set_value(cdt, cdn, 'return_date', '');
            }
        } else if (row.trip_type === 'Return') {
            const grid_row = cur_frm.fields_dict.flight_booking_entry_online.grid.grid_rows_by_docname[cdn];
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
        if (row.trip_type === 'One Way') {
            const grid_row = cur_frm.fields_dict.flight_booking_entry_online.grid.grid_rows_by_docname[cdn];
            if (grid_row) {
                grid_row.toggle_editable('return_sector', false);
                grid_row.toggle_display('return_sector', false);
                grid_row.toggle_editable('return_date', false);
                grid_row.toggle_display('return_date', false);
            }
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
    }
});
