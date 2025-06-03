frappe.ui.form.on("Trip Booking", {
  refresh: function (frm) {
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
          ],
          (values) => {
            const selected = serviceMap[values.service_type];
            if (!selected) {
              frappe.msgprint("Service not supported.");
              return;
            }

            const [section, table, supplier_field] = selected;
            frm.set_df_property(section, "hidden", 0);
            frm.set_df_property(table, "hidden", 0);
            if (supplier_field) frm.set_df_property(supplier_field, "hidden", 0);
            frm.refresh_fields([section, table, supplier_field]);

            const exists = (frm.doc[table] || []).some(
              (row) => row.service_type === values.service_type
            );

            if (!exists) {
              frm.add_child(table, { service_type: values.service_type });
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
  },

  validate: function (frm) {
    calculate_totals(frm);
  }
});

// Add handlers for all child tables
const booking_tables = [
  "flight_booking_entry_gds",
  "flight_booking_entry_online",
  "hotel_booking_entry",
  "visa_booking_entry",
  "car_rental_booking_entry",
  "insurance_booking_entry"
];

booking_tables.forEach(table => {
  frappe.ui.form.on(table, {
    supplier_cost: function(frm, cdt, cdn) {
      calculate_row_total(frm, cdt, cdn);
    },
    markup: function(frm, cdt, cdn) {
      calculate_row_total(frm, cdt, cdn);
    }
  });
});

function calculate_row_total(frm, cdt, cdn) {
  try {
    const row = locals[cdt][cdn];
    const supplier_cost = flt(row.supplier_cost) || 0;
    const markup = flt(row.markup) || 0;
    
    row.total_amount = supplier_cost + markup;
    row.selling_price = row.total_amount;
    
    refresh_field('total_amount', row.name, row.parentfield);
    refresh_field('selling_price', row.name, row.parentfield);
    
    calculate_totals(frm);
  } catch (e) {
    console.error('Error in calculate_row_total:', e);
  }
}

// Function to fetch passenger details
function fetch_passenger_details(frm, cdt, cdn) {
  const row = locals[cdt][cdn];
  if (row.passenger) {
    frappe.db.get_doc('Passenger', row.passenger)
      .then(doc => {
        if (doc.full_name) {
          // Update the passenger field's display with full name
          $(`.grid-row[data-idx="${row.idx}"] .grid-static-col[data-fieldname="passenger"]`)
            .text(doc.full_name);
        }
      })
      .catch(err => {
        console.error('Error fetching passenger details:', err);
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
