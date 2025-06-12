frappe.ui.form.on("Trip Booking", {
  refresh: function (frm) {
    // Calculate totals first to ensure amount is up to date
    calculate_totals(frm);
    
    // Make sure total_amount field is visible
    frm.set_df_property('total_amount', 'hidden', 0);
    frm.refresh_field('total_amount');
    
    // Clear existing custom buttons to avoid duplicates on refresh
    frm.clear_custom_buttons(); // More robust way to clear all custom buttons

    const serviceMap = {
      "Flight GDS": ["flight_gds_section", "flight_booking_entry_gds", "flight_gds_supplier"],
      "Flight Online Airlines": ["flight_online_section", "flight_booking_entry_online", "flight_online_supplier"],
      "Hotel Booking": ["hotel_section", "hotel_booking_entry", "hotel_supplier"],
      "Visa Application Charges": ["visa_section", "visa_booking_entry", "visa_supplier"],
      "Insurance Service": ["insurance_section", "insurance_booking_entry", "insurance_supplier"],
      "Car Rental Service": ["car_rental_section", "car_rental_booking_entry", "car_rental_supplier"],
    };

    // Show relevant UI sections for each table with data
    Object.values(serviceMap).forEach(([section, table, supplier]) => {
      if ((frm.doc[table] || []).length > 0) {
        frm.set_df_property(section, "hidden", 0);
        frm.set_df_property(table, "hidden", 0);
        if (supplier) frm.set_df_property(supplier, "hidden", 0);
      }
    });

    // Add Service in draft state - make it prominent
    if (frm.doc.docstatus === 0) {
      frm.add_custom_button(__("Add Service"), () => {
        frappe.prompt(
          [
            {
              fieldname: "service_type",
              label: "Select Service",
              fieldtype: "Link",
              options: "Service Type",
              reqd: 1,
            },
            {
              fieldname: "supplier",
              label: "Select Supplier",
              fieldtype: "Link",
              options: "Supplier", // Assuming 'Supplier' is your supplier DocType
              reqd: 1, // Make it required if necessary
            }
          ],
          (values) => {
            console.log("Dialog values:", values); // Debug: Check values from prompt
            const selected = serviceMap[values.service_type];
            if (!selected) {
              frappe.msgprint("Service not supported.");
              return;
            }

            const [section, table, supplier_field] = selected;

            // Show the section and table
            frm.set_df_property(section, "hidden", 0);
            frm.set_df_property(table, "hidden", 0);

            // Show supplier field if it exists
            if (supplier_field) {
              frm.set_df_property(supplier_field, "hidden", 0);
              frm.set_value(supplier_field, values.supplier);
            }

            // Add a new row to the table
            const new_row = frm.add_child(table);
            new_row.supplier = values.supplier; // Set supplier in the row too
            if (table === "flight_booking_entry_gds" || table === "flight_booking_entry_online") {
              // Set trip_type for flight bookings
              new_row.trip_type = "One Way"; // Default to One Way
            }

            frm.refresh_field(table);
            // Focus on the new row in grid
            setTimeout(() => {
              const table_field = frm.get_field(table);
              if (table_field && table_field.grid) {
                table_field.grid.grid_rows[table_field.grid.grid_rows.length - 1].toggle_view();
              }
            }, 100);
          },
          "Add New Service"
        );
      }, __("Actions")).addClass('btn-primary');
    }

    // Add Create Invoice buttons if submitted
    if (frm.doc.docstatus === 1) {
        // Check if invoices already exist
        const salesInvoiceExists = frm.doc.sales_invoice_id;
        const purchaseInvoiceExists = frm.doc.purchase_invoice_ids && frm.doc.purchase_invoice_ids.length > 0;
        
        // Show Sales Invoice button only if not already created
        if (!salesInvoiceExists) {
            frm.add_custom_button(__('Create Sales Invoice'), function() {
                frappe.model.open_mapped_doc({
                    method: "travel_agency_backend.travel_agency_backend.doctype.trip_booking.trip_booking.make_sales_invoice",
                    frm: frm
                });
            }, __("Create"));
        }
        
        // Show Purchase Invoice button only if not already created
        if (!purchaseInvoiceExists) {
            frm.add_custom_button(__('Create Purchase Invoice'), function() {
                frappe.model.open_mapped_doc({
                    method: "travel_agency_backend.travel_agency_backend.doctype.trip_booking.trip_booking.make_purchase_invoice",
                    frm: frm
                });
            }, __("Create"));
        }
    }
    
    // Add Manage Services button in both draft and submitted states
    if (frm.doc.docstatus <= 1) {
        frm.add_custom_button(__('Manage Services'), function() {
          let services = [];
          
          // Get current services
          (frm.doc.selected_services || []).forEach(service => {
            if (service.select_wbjn) {
              services.push(service.select_wbjn);
            }
          });
          
          // Create dialog with checkboxes for services
          let d = new frappe.ui.Dialog({
            title: __('Manage Services'),
            fields: [
              {
                fieldname: 'checkbox_list_html',
                fieldtype: 'HTML',
                options: `
                  <div class="checkbox-list" style="max-height: 200px; overflow-y: auto;">
                    <!-- Checkboxes will be inserted here -->
                  </div>
                `
              }
            ],
            primary_action_label: __('Update'),
            primary_action: function() {
              // Collect checked services
              let selected = [];
              d.$wrapper.find('.checkbox-list input:checked').each(function() {
                selected.push($(this).val());
              });
              
              // Update selected_services
              frm.clear_table('selected_services');
              selected.forEach(service_type => {
                let row = frm.add_child('selected_services');
                row.select_wbjn = service_type;
              });
              
              frm.refresh_field('selected_services');
              d.hide();
              
              // Show/hide sections based on selection
              Object.entries(serviceMap).forEach(([service_type, [section, table, supplier]]) => {
                const isSelected = selected.includes(service_type);
                frm.set_df_property(section, 'hidden', isSelected ? 0 : 1);
                frm.set_df_property(table, 'hidden', isSelected ? 0 : 1);
                if (supplier) frm.set_df_property(supplier, 'hidden', isSelected ? 0 : 1);
              });
            }
          });
          
          d.show();
          
          // Populate service checkboxes
          let serviceList = Object.keys(serviceMap);
          let checkboxContainer = d.$wrapper.find('.checkbox-list');
          checkboxContainer.empty();
          
          serviceList.forEach(service => {
            let isSelected = services.some(s => s === service);
            checkboxContainer.append(`
              <div class="checkbox">
                <label>
                  <input type="checkbox" value="${service}" ${isSelected ? 'checked' : ''}>
                  ${__(service)}
                </label>
              </div>
            `);
          });
        });
    }

    // Add handlers for all child tables
    const child_doctype_map = {
      "flight_booking_entry_gds": "Flight Booking Entry GDS",
      "flight_booking_entry_online": "Flight Booking Entry Online",
      "hotel_booking_entry": "Hotel Booking Entry",
      "visa_booking_entry": "Visa Booking Entry",
      "car_rental_booking_entry": "Car Rental Booking Entry",
      "insurance_booking_entry": "Insurance Booking Entry"
    };

    const booking_tables = [
      "flight_booking_entry_gds",
      "flight_booking_entry_online",
      "hotel_booking_entry",
      "visa_booking_entry",
      "car_rental_booking_entry",
      "insurance_booking_entry"
    ];

    // Iterate over the map to use actual Child DocType names for event handlers
    Object.keys(child_doctype_map).forEach(table_fieldname => {
      const child_doctype_name = child_doctype_map[table_fieldname];
      frappe.ui.form.on(child_doctype_name, {
        supplier_cost: function(frm, cdt, cdn) {
          calculate_row_total(frm, cdt, cdn);
        },
        markup: function(frm, cdt, cdn) {
          calculate_row_total(frm, cdt, cdn);
        }
      });
    });

    function calculate_row_total(frm, cdt, cdn) {
      console.log("calculate_row_total called for:", cdt, cdn); // Debug
      try {
        const row = locals[cdt][cdn];
        const supplier_cost = flt(row.supplier_cost) || 0;
        const markup = flt(row.markup) || 0;
        
        row.total_amount = supplier_cost + markup;
        row.selling_price = row.total_amount;
        
        frm.refresh_field('total_amount', row.name, row.parentfield);
        frm.refresh_field('selling_price', row.name, row.parentfield);
        
        calculate_totals(frm);
      } catch (e) {
        console.error('Error in calculate_row_total:', e);
      }
    }

    // Function to fetch passenger details
    function fetch_passenger_details(frm, cdt, cdn) {
      const row = locals[cdt][cdn];
      if (row.passenger) {
        frappe.db.get_value('Passenger', row.passenger, 'full_name', function(r) {
          if (r && r.full_name) {
            // Set the passenger_name field directly
            frappe.model.set_value(cdt, cdn, 'passenger_name', r.full_name);
            
            // Also update the display in the grid
            setTimeout(function() {
              const grid_row = cur_frm.get_field(row.parentfield).grid.grid_rows_by_docname[cdn];
              if (grid_row) {
                grid_row.refresh();
              }
            }, 100);
          }
        });
      }
    }

    // Add passenger field handlers to all child tables
    const child_tables = [
      'hotel_booking_entry',
      'visa_booking_entry', 
      'car_rental_booking_entry',
      'flight_booking_entry_gds',
      'flight_booking_entry_online',
      'insurance_booking_entry'
    ];

    child_tables.forEach(table => {
      frappe.ui.form.on(table, {
        passenger: function(frm, cdt, cdn) {
          fetch_passenger_details(frm, cdt, cdn);
        },
        form_render: function(frm, cdt, cdn) {
          fetch_passenger_details(frm, cdt, cdn);
        }
      });
    });

    function calculate_totals(frm) {
      console.log("calculate_totals called for form.");
      let total = 0;
      
      booking_tables.forEach(table => {
        (frm.doc[table] || []).forEach(row => {
          if (row.supplier_cost) {
            const supplier_cost = flt(row.supplier_cost);
            const markup = flt(row.markup || 0);
            row.total_amount = supplier_cost + markup;
            row.selling_price = row.total_amount;
            total += row.total_amount;
          }
        });
        frm.refresh_field(table);
      });
      
      // Set the total and ensure it's refreshed/visible
      frm.set_value('total_amount', total);
      frm.refresh_field('total_amount');
    }
  },
  
  // Add custom handlers for each child table to keep selected_services in sync
  validate: function(frm) {
    updateSelectedServices(frm);
  },
  
  after_save: function(frm) {
    updateSelectedServices(frm);
  }
});

// Update selected_services based on child tables
function updateSelectedServices(frm) {
  // Skip if form is being loaded
  if (frm.__islocal) return;
  
  // Map of child tables to service types
  const tableToServiceMap = {
    "flight_booking_entry_gds": "Flight GDS",
    "flight_booking_entry_online": "Flight Online Airlines",
    "hotel_booking_entry": "Hotel Booking",
    "visa_booking_entry": "Visa Application Charges",
    "car_rental_booking_entry": "Car Rental Service",
    "insurance_booking_entry": "Insurance Service"
  };
  
  // Check each table for entries
  for (const [table, service_type] of Object.entries(tableToServiceMap)) {
    const hasEntries = frm.doc[table] && frm.doc[table].length > 0;
    
    // Add service type if table has entries and not already in selected_services
    if (hasEntries) {
      const serviceExists = (frm.doc.selected_services || []).some(s => s.select_wbjn === service_type);
      
      if (!serviceExists) {
        console.log(`Adding ${service_type} to selected_services based on entries in ${table}`);
        frm.add_child("selected_services", {
          select_wbjn: service_type
        });
        frm.refresh_field("selected_services");
      }
    }
  }
}
