frappe.ui.form.on("Trip Booking", {
  refresh: function (frm) {
    // Clear existing custom buttons to avoid duplicates on refresh
    frm.clear_custom_buttons(); // More robust way to clear all custom buttons

    const serviceMap = {
      "Flight GDS": ["flight_gds_section", "flight_booking_entry_gds", "flight_gds_supplier"],
      "Flight Online Airlines": ["flight_online_section", "flight_booking_entry_online", "flight_online_supplier"],
      "Flight Booking GDS Multi City": ["flight_gds_multicity_section", "flight_booking_entry_gds_multicity", "flight_gds_supplier_multicity"],
      "Flight Booking Online Airlines Multi City": ["flight_online_multicity_section", "flight_booking_entry_online_multicity", "flight_online_supplier_multicity"],
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

    // Add Service in draft state
    if (frm.doc.docstatus === 0) {
      frm.add_custom_button("Add Service", () => {
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
            const table_exists = (frm.doc[table] || []).length > 0;
            
            if (!table_exists) {
              // Unhide the section and table
              frm.set_df_property(section, "hidden", 0);
              frm.set_df_property(table, "hidden", 0);
              
              // Unhide and set the supplier field
              if (supplier_field) {
                frm.set_df_property(supplier_field, "hidden", 0);
                frm.set_value(supplier_field, values.supplier);
              }
              
              // Add a child row to the appropriate table
              let child = frm.add_child(table);
              child.service_type = values.service_type;
              if (child.supplier) child.supplier = values.supplier;
              frm.refresh_field(table);
              
              // Also add to selected_services if not already there
              const service_exists = (frm.doc.selected_services || []).some(
                (row) => row.select_wbjn === values.service_type
              );
              
              // Service type in selected_services should match the options in selected_service.json
              // Map Service Type to appropriate selected_services value
              let selected_service_value = values.service_type;
              
              // Handle mapping based on the available options in Selected Service doctype
              // These are the options defined in selected_service.json: 
              // "Flight GDS\nFlight Online Airlines\nHotel Booking\nVisa Application Charges\nCar Rental Service\nInsurance Service"
              const serviceTypeToSelectWbjnMap = {
                "Flight GDS": "Flight GDS",
                "Flight Online Airlines": "Flight Online Airlines",
                "Flight Booking GDS Multi City": "Flight Booking GDS Multi City",
                "Flight Booking Online Airlines Multi City": "Flight Booking Online Airlines Multi City",
                "Hotel Booking": "Hotel Booking",
                "Visa Application Charges": "Visa Application Charges",
                "Car Rental Service": "Car Rental Service", 
                "Insurance Service": "Insurance Service"
              };
              
              // Try to find a match in our map, or use the original value
              for (const [key, value] of Object.entries(serviceTypeToSelectWbjnMap)) {
                if (values.service_type.includes(key)) {
                  selected_service_value = value;
                  console.log(`Mapped service type "${values.service_type}" to "${selected_service_value}"`);
                  break;
                }
              }
              
              // Debug notice if no mapping was found
              if (selected_service_value === values.service_type) {
                console.log(`No mapping found for "${values.service_type}", using as-is`);
              }
              
              if (!service_exists) {
                frm.add_child("selected_services", {
                  select_wbjn: selected_service_value
                });
                frm.refresh_field("selected_services");
              }
              
              frm.scroll_to_field(table);
            } else {
              frappe.msgprint(`${values.service_type} already added.`);
            }
          },
          "Add New Service"
        );
      });
    }

    // Add Create Invoice buttons if submitted
    if (frm.doc.docstatus === 1) {
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
        
        // If both invoice types exist, hide the Create group
        if (salesInvoiceExists && purchaseInvoiceExists) {
            // No need to add buttons as they've already been created
            frm.remove_custom_button(__('Sales Invoice'), createGroup);
            frm.remove_custom_button(__('Purchase Invoices'), createGroup);
        }
    }

    // Add row calculation triggers for supported types
    const supportedTables = [
      "flight_booking_entry_gds",
      "flight_booking_entry_online",
      "flight_booking_entry_gds_multicity",
      "flight_booking_entry_online_multicity",
      "hotel_booking_entry",
      "car_rental_booking_entry",
      "visa_booking_entry",
      "insurance_booking_entry"
    ];
    
    supportedTables.forEach(table => {
      // Initial calculation on refresh
      calculate_table_amounts(frm, table);
    });

    // Function to calculate amounts for a table
    function calculate_table_amounts(frm, table) {
      let rows = frm.doc[table] || [];
      let total = 0;
      
      rows.forEach(row => {
        if (row.supplier_cost) {
          const supplier_cost = flt(row.supplier_cost);
          const markup = flt(row.markup || 0);
          const commission = flt(row.commission || 0);
          
          // Calculate total amount based on cost model
          row.total_amount = supplier_cost + markup - commission;
          row.selling_price = row.total_amount;
          
          total += row.total_amount;
        }
      });
      
      // Update the table in the form
      frm.refresh_field(table);
      return total;
    }

    // Add event handlers for all booking tables
    supportedTables.forEach(table => {
      const doctype = frappe.model.unscrub(table);

      // Special handling for Flight Booking Entry GDS
      if (table === "flight_booking_entry_gds") {
        frappe.ui.form.on(doctype, {
          base_fare: function(frm, cdt, cdn) {
            let row = locals[cdt][cdn];
            let base_fare = flt(row.base_fare) || 0;
            let taxes = flt(row.taxes) || 0;
            
            console.log("Trip Booking: base_fare changed to", base_fare);
            
            // Calculate and set supplier_cost
            let supplier_cost = base_fare + taxes;
            frappe.model.set_value(cdt, cdn, 'supplier_cost', supplier_cost);
            
            console.log("Trip Booking: Updated supplier_cost to", supplier_cost);
            
            // Explicitly trigger row total calculation
            calculate_row_total(frm, cdt, cdn);
            
            // Refresh both the specific field and the entire child table
            frm.refresh_field('flight_booking_entry_gds');
          },
          taxes: function(frm, cdt, cdn) {
            let row = locals[cdt][cdn];
            let base_fare = flt(row.base_fare) || 0;
            let taxes = flt(row.taxes) || 0;
            
            console.log("Trip Booking: taxes changed to", taxes);
            
            // Calculate and set supplier_cost
            let supplier_cost = base_fare + taxes;
            frappe.model.set_value(cdt, cdn, 'supplier_cost', supplier_cost);
            
            console.log("Trip Booking: Updated supplier_cost to", supplier_cost);
            
            // Explicitly trigger row total calculation
            calculate_row_total(frm, cdt, cdn);
            
            // Refresh both the specific field and the entire child table
            frm.refresh_field('flight_booking_entry_gds');
          },
          supplier_cost: function(frm, cdt, cdn) {
            calculate_row_total(frm, cdt, cdn);
          },
          markup: function(frm, cdt, cdn) {
            calculate_row_total(frm, cdt, cdn);
          }
        });
      } else {
        frappe.ui.form.on(doctype, {
          supplier_cost: function(frm, cdt, cdn) {
            calculate_row_total(frm, cdt, cdn);
          },
          markup: function(frm, cdt, cdn) {
            calculate_row_total(frm, cdt, cdn);
          },
          commission: function(frm, cdt, cdn) {
            calculate_row_total(frm, cdt, cdn);
          }
        });
      }
    });

    // Calculate row totals 
    function calculate_row_total(frm, cdt, cdn) {
      let row = locals[cdt][cdn];
      const supplier_cost = flt(row.supplier_cost || 0);
      const markup = flt(row.markup || 0);
      const commission = flt(row.commission || 0);
      
      // Update the row
      row.total_amount = supplier_cost + markup - commission;
      row.selling_price = row.total_amount;
      
      // Refresh the row and calculate total
      refresh_field("total_amount", cdn, cdt);
      refresh_field("selling_price", cdn, cdt);
      
      // Calculate form totals
      calculate_totals(frm);
    }

    // Calculate totals across all tables
    function calculate_totals(frm) {
      console.log("calculate_totals called for form."); // Debug
      let total = 0;
      
      supportedTables.forEach(table => {
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
      
      frm.set_value('total_amount', total);
    }
  }
});

// Function to add "DONE" buttons to all child tables - REMOVED
