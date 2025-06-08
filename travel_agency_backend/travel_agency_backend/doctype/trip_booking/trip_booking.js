frappe.ui.form.on("Trip Booking", {
  refresh: function (frm) {
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

            const [section, table, supplier_field_on_parent] = selected;

            // Set the supplier on the PARENT document
            if (supplier_field_on_parent && values.supplier) {
              frm.set_value(supplier_field_on_parent, values.supplier);
            } else if (supplier_field_on_parent && !values.supplier) {
              // Clear the parent supplier field if no supplier was selected (e.g., if reqd:0 for supplier)
              frm.set_value(supplier_field_on_parent, null);
            }

            frm.set_df_property(section, "hidden", 0);
            frm.set_df_property(table, "hidden", 0);
            if (supplier_field_on_parent) frm.set_df_property(supplier_field_on_parent, "hidden", 0);
            // It's good to refresh the specific supplier field on parent as well
            let fields_to_refresh = [section, table];
            if (supplier_field_on_parent) fields_to_refresh.push(supplier_field_on_parent);
            frm.refresh_fields(fields_to_refresh);

            const exists = (frm.doc[table] || []).some(
              (row) => row.service_type === values.service_type
            );

            if (!exists) {
              // Add only service_type to the child table row, or other fields that belong in the child row.
              // Supplier is now set on the parent.
              let child_row_data = { 
                service_type: values.service_type
                // Add other child-specific fields here if necessary
              };
              console.log("Adding child row with data:", child_row_data, "to table:", table); // Debug
              frm.add_child(table, child_row_data);
              frm.refresh_field(table);
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
  },

  validate: function (frm) {
    calculate_totals(frm); // This is good for client-side UI update before save
  },
  after_save: function(frm) {
    // Potentially refresh or check status after save if needed
    // The create buttons logic is now part of the main refresh handler below
  }
  // IMPORTANT: The main refresh handler continues below and includes the create button logic.
});

// The following is now integrated into the main refresh handler above.
// frappe.ui.form.on("Trip Booking", {
//     refresh: function(frm) { ... }
// });

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
  console.log("calculate_totals called for form."); // Debug
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
  
  frm.set_value('total_amount', total);
}


