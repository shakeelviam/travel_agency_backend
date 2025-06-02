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
    compute_total_amount(frm);
  },
});

function compute_total_amount(frm) {
  let grand_total = 0;
  const tables = [
    "flight_booking_entry_gds",
    "flight_booking_entry_online",
    "hotel_booking_entry",
    "visa_booking_entry",
    "insurance_booking_entry",
    "car_rental_booking_entry",
  ];

  tables.forEach((table) => {
    let table_total = 0;

    (frm.doc[table] || []).forEach((row) => {
      const supplier_cost = row.supplier_cost_payable || row.net_fare || 0;
      const markup = row.markup || 0;
      const commission = row.service_fee || row.commission || 0;
      const row_total = supplier_cost + markup + commission;

      row.total_amount = row_total;
      row.selling_price = row_total;
      table_total += row_total;
    });

    frm.refresh_field(table);
    grand_total += table_total;
  });

  frm.set_value("total_amount", grand_total);
}
