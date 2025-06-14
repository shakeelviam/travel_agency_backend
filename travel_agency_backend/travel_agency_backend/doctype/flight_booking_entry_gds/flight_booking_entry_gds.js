// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

// Import flt function for number handling
const flt = frappe.utils.flt;

frappe.ui.form.on('Flight Booking Entry GDS', {
    refresh: function(frm, cdt, cdn) {
        // Ensure supplier_cost is set correctly on form load
        if (locals[cdt][cdn]) {
            calculate_supplier_cost(frm, cdt, cdn);
            calculate_total(frm, cdt, cdn);
        }
    },
    
    base_fare: function(frm, cdt, cdn) {
        calculate_supplier_cost(frm, cdt, cdn);
    },
    
    taxes: function(frm, cdt, cdn) {
        calculate_supplier_cost(frm, cdt, cdn);
    },
    trip_type: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        
        // Get the grid row using the grid_rows object
        const grid_rows = cur_frm.fields_dict[row.parentfield].grid.grid_rows;
        let grid_row;
        
        // Find the grid row by docname
        for (let i=0; i<grid_rows.length; i++) {
            if (grid_rows[i].doc.name === cdn) {
                grid_row = grid_rows[i];
                break;
            }
        }
        
        if (!grid_row) return;
        
        // Toggle return_sector and return_date fields based on trip_type
        if (row.trip_type === "One Way") {
            // Hide return fields for One Way trips
            grid_row.toggle_editable("return_sector", false);
            grid_row.toggle_display("return_sector", false);
            grid_row.toggle_editable("return_date", false);
            grid_row.toggle_display("return_date", false);
            
            // Clear return values
            frappe.model.set_value(cdt, cdn, "return_sector", "");
            frappe.model.set_value(cdt, cdn, "return_date", "");
        } else {
            // Show return fields for Round Trip
            grid_row.toggle_editable("return_sector", true);
            grid_row.toggle_display("return_sector", true);
            grid_row.toggle_editable("return_date", true);
            grid_row.toggle_display("return_date", true);
        }
    },
    
    form_render: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        
        // Apply the same logic on form render
        if (row) {
            // Get the grid row using the grid_rows object
            const grid_rows = cur_frm.fields_dict[row.parentfield].grid.grid_rows;
            let grid_row;
            
            // Find the grid row by docname
            for (let i=0; i<grid_rows.length; i++) {
                if (grid_rows[i].doc.name === cdn) {
                    grid_row = grid_rows[i];
                    break;
                }
            }
            
            if (!grid_row) return;
            
            // Toggle return_sector and return_date fields based on trip_type
            if (row.trip_type === "One Way") {
                // Hide return fields for One Way trips
                grid_row.toggle_editable("return_sector", false);
                grid_row.toggle_display("return_sector", false);
                grid_row.toggle_editable("return_date", false);
                grid_row.toggle_display("return_date", false);
            } else {
                // Show return fields for Round Trip
                grid_row.toggle_editable("return_sector", true);
                grid_row.toggle_display("return_sector", true);
                grid_row.toggle_editable("return_date", true);
                grid_row.toggle_display("return_date", true);
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

// Function to calculate supplier cost from base_fare + taxes
function calculate_supplier_cost(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    let base_fare = flt(row.base_fare) || 0;
    let taxes = flt(row.taxes) || 0;
    
    // Calculate supplier_cost
    let supplier_cost = base_fare + taxes;
    
    // Ensure we're not setting the same value (to avoid unnecessary triggers)
    if (flt(row.supplier_cost) !== supplier_cost) {
        frappe.model.set_value(cdt, cdn, 'supplier_cost', supplier_cost);
        
        // Log for debugging
        console.log('Updated supplier_cost:', supplier_cost, 'from base_fare:', base_fare, 'and taxes:', taxes);
    }
}

// Function to calculate total amount
function calculate_total(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const supplier_cost = flt(row.supplier_cost) || 0;
    const markup = flt(row.markup) || 0;
    const service_fee = flt(row.service_fee) || 0;
    
    // Calculate total amount
    const total_amount = supplier_cost + markup + service_fee;
    
    // Ensure we're not setting the same value (to avoid unnecessary triggers)
    if (flt(row.total_amount) !== total_amount) {
        // Update the total amount field
        frappe.model.set_value(cdt, cdn, 'total_amount', total_amount);
        
        // Log for debugging
        console.log('Updated total_amount:', total_amount, 'from supplier_cost:', supplier_cost, 'markup:', markup);
    }
}
