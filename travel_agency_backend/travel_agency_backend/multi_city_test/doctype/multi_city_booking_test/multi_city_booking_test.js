// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

frappe.ui.form.on('Multi City Booking Test', {
    refresh: function(frm) {
        // Setup auto-numbering for sectors when the form is refreshed
        setup_sector_auto_numbering(frm);
    },
    
    onload: function(frm) {
        // Toggle fields based on trip type when the form is loaded
        toggle_fields_by_trip_type(frm);
    },
    
    trip_type: function(frm) {
        // Toggle fields when trip type is changed
        toggle_fields_by_trip_type(frm);
    },
    
    base_fare: function(frm) {
        calculate_total(frm);
    },
    
    taxes: function(frm) {
        calculate_total(frm);
    },
    
    fees: function(frm) {
        calculate_total(frm);
    }
});

// Handle child table events
frappe.ui.form.on('Flight Booking Sector Test', {
    sectors_add: function(frm, cdt, cdn) {
        // When a new sector is added, renumber all sectors
        renumber_sectors(frm);
    },
    
    sectors_remove: function(frm, cdt, cdn) {
        // When a sector is removed, renumber all sectors
        renumber_sectors(frm);
    }
});

/**
 * Setup auto-numbering for sectors
 * @param {Object} frm - The form object
 */
function setup_sector_auto_numbering(frm) {
    if (!frm.doc.__islocal) {
        renumber_sectors(frm);
    }
}

/**
 * Renumber all sectors in the table
 * @param {Object} frm - The form object
 */
function renumber_sectors(frm) {
    if (frm.doc.sectors && frm.doc.sectors.length > 0) {
        // Sort sectors by existing sector_number if available
        frm.doc.sectors.sort((a, b) => (a.sector_number || 0) - (b.sector_number || 0));
        
        // Renumber all sectors
        $.each(frm.doc.sectors, function(i, sector) {
            sector.sector_number = i + 1;
        });
        
        refresh_field('sectors');
    }
}

/**
 * Toggle fields visibility based on trip type
 * @param {Object} frm - The form object
 */
function toggle_fields_by_trip_type(frm) {
    // Show/hide fields based on trip type
    if (frm.doc.trip_type === "Multi City") {
        // For multi-city, we need the sectors table
        frm.set_df_property('sectors_section', 'hidden', 0);
        frm.set_df_property('sectors', 'reqd', 1);
    } else if (frm.doc.trip_type === "Round Trip") {
        // For round trip, we still need sectors but with different requirements
        frm.set_df_property('sectors_section', 'hidden', 0);
        frm.set_df_property('sectors', 'reqd', 1);
    } else if (frm.doc.trip_type === "One Way") {
        // For one way, we still show sectors but only need one
        frm.set_df_property('sectors_section', 'hidden', 0);
        frm.set_df_property('sectors', 'reqd', 1);
    }
    
    // Refresh the form to apply changes
    frm.refresh_fields();
}

/**
 * Calculate the total amount
 * @param {Object} frm - The form object
 */
function calculate_total(frm) {
    let base_fare = flt(frm.doc.base_fare) || 0;
    let taxes = flt(frm.doc.taxes) || 0;
    let fees = flt(frm.doc.fees) || 0;
    
    frm.set_value('total_amount', base_fare + taxes + fees);
}
