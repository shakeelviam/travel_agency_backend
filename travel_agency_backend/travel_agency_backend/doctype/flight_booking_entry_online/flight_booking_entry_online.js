// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

// Import flt function for number handling
const flt = frappe.utils.flt;

frappe.ui.form.on('Flight Booking Entry Online', {
    refresh: function(frm) {
        if (!frm.doc.__islocal) {
            toggle_fields_by_trip_type(frm);
            setup_sector_auto_numbering(frm);
        }
    },
    
    onload: function(frm) {
        toggle_fields_by_trip_type(frm);
    },
    
    trip_type: function(frm, cdt, cdn) {
        toggle_fields_by_trip_type(frm, cdt, cdn);
    },
    
    form_render: function(frm, cdt, cdn) {
        toggle_fields_by_trip_type(frm, cdt, cdn);
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
    const supplier_cost = flt(row.supplier_cost || 0);
    const markup = flt(row.markup || 0);
    const service_fee = flt(row.service_fee || 0);
    
    const total_amount = supplier_cost + markup + service_fee;
    frappe.model.set_value(cdt, cdn, 'total_amount', total_amount);
}

// Setup auto-numbering for multi-city sectors
function setup_sector_auto_numbering(frm) {
    if (!frm) return;
    
    // Only setup if this is a multi-city trip
    if (frm.doc.trip_type !== "Multi City") return;
    
    // Add event handlers for the sectors table
    frm.fields_dict.sectors.grid.wrapper.on('grid-row-render', function(e) {
        renumber_sectors(frm);
    });
    
    frm.fields_dict.sectors.grid.wrapper.on('grid-row-removed', function(e) {
        renumber_sectors(frm);
    });
    
    // Initial numbering
    renumber_sectors(frm);
}

// Renumber all sectors in sequence
function renumber_sectors(frm) {
    if (!frm || !frm.doc.sectors) return;
    
    // Update segment numbers
    frm.doc.sectors.forEach((sector, idx) => {
        if (sector.segment_number !== (idx + 1)) {
            frappe.model.set_value(sector.doctype, sector.name, 'segment_number', idx + 1);
        }
    });
    
    frm.refresh_field('sectors');
}

// Show/hide fields based on trip type
function toggle_fields_by_trip_type(frm, cdt, cdn) {
    // Setup auto-numbering for sectors if this is a multi-city trip
    if (frm && frm.doc && frm.doc.trip_type === "Multi City" && !cdt) {
        setup_sector_auto_numbering(frm);
    }
    // Handle both standalone form and grid form
    if (cdt && cdn) {
        // Grid form (child table)
        const row = locals[cdt][cdn];
        const grid_rows = cur_frm.fields_dict[row.parentfield]?.grid?.grid_rows;
        let grid_row = grid_rows?.find(gr => gr.doc.name === cdn);
        
        if (!grid_row) return;
        
        const is_return = row.trip_type === "Return";
        const is_multi_city = row.trip_type === "Multi City";
        const is_single_trip = !is_return && !is_multi_city;

        // Return trip fields
        grid_row.toggle_editable("return_sector", is_return);
        grid_row.toggle_display("return_sector", is_return);
        grid_row.toggle_editable("return_date", is_return);
        grid_row.toggle_display("return_date", is_return);
        
        // Single/Return trip fields
        const single_trip_fields = ["from_sector", "to_sector"];
        single_trip_fields.forEach(field => {
            if (grid_row.fields_dict[field]) {
                grid_row.toggle_display(field, !is_multi_city);
                grid_row.toggle_editable(field, !is_multi_city);
            }
        });

        // Clear fields based on trip type
        if (!is_return) {
            frappe.model.set_value(cdt, cdn, "return_sector", "");
            frappe.model.set_value(cdt, cdn, "return_date", "");
        }
        
        if (is_multi_city) {
            // Clear single/return trip fields
            single_trip_fields.concat(["return_sector", "return_date"]).forEach(field => {
                frappe.model.set_value(cdt, cdn, field, "");
            });
        } else {
            // Clear multi-city fields
            if (row.sectors && row.sectors.length) {
                frappe.model.set_value(cdt, cdn, "sectors", []);
            }
        }
    } else {
        // Standalone form
        if (!frm) return;
        
        const is_return = frm.doc.trip_type === "Return";
        const is_multi_city = frm.doc.trip_type === "Multi City";
        const is_single_trip = !is_return && !is_multi_city;

        // Return trip fields
        frm.toggle_display(["return_sector", "return_date"], is_return);
        frm.toggle_reqd(["return_sector", "return_date"], is_return);
        
        // Single/Return trip fields
        const single_trip_fields = ["from_sector", "to_sector"];
        frm.toggle_display(single_trip_fields, !is_multi_city);
        frm.toggle_reqd(single_trip_fields, !is_multi_city && !is_return);
        
        // Multi-city fields
        frm.toggle_display(["multi_city_section", "sectors"], is_multi_city);
        frm.toggle_reqd("sectors", is_multi_city);

        // Clear fields based on trip type
        if (!is_return && frm.doc.return_sector) {
            frm.set_value("return_sector", "");
            frm.set_value("return_date", "");
        }
        
        if (is_multi_city) {
            // Clear single/return trip fields
            single_trip_fields.concat(["return_sector", "return_date"]).forEach(field => {
                if (frm.doc[field]) frm.set_value(field, "");
            });
            
            // Add at least one sector if none exist
            if (!frm.doc.sectors || !frm.doc.sectors.length) {
                frm.add_child('sectors', {
                    segment_number: 1
                });
                frm.refresh_field('sectors');
            }
        } else if (frm.doc.sectors && frm.doc.sectors.length) {
            // Clear multi-city fields
            frm.set_value("sectors", []);
        }
    }
}
