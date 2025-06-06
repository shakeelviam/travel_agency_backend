// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Booking Entry Online', {
    trip_type: function(frm) {
        // Show/hide return sector based on trip type
        if (frm.doc.trip_type === 'One Way') {
            frm.set_df_property('return_sector', 'hidden', 1);
            frm.set_df_property('return_date', 'hidden', 1);
            frm.set_value('return_sector', '');
            frm.set_value('return_date', '');
        } else if (frm.doc.trip_type === 'Return') {
            frm.set_df_property('return_sector', 'hidden', 0);
            frm.set_df_property('return_date', 'hidden', 0);
        }
    },
    
    refresh: function(frm) {
        // Apply the conditional display on refresh as well
        if (frm.doc.trip_type === 'One Way') {
            frm.set_df_property('return_sector', 'hidden', 1);
            frm.set_df_property('return_date', 'hidden', 1);
        } else if (frm.doc.trip_type === 'Return') {
            frm.set_df_property('return_sector', 'hidden', 0);
            frm.set_df_property('return_date', 'hidden', 0);
        }
    }
});
